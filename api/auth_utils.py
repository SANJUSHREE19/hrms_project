# api/auth_utils.py
import os
import requests
import time
from functools import wraps
from jose import jwt # Using python-jose which handles jwk well
from jose.exceptions import JOSEError, JWTError
from django.core.cache import cache  # Use Django's cache instead of SimpleCache
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework import status
from dotenv import load_dotenv
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

from .models import User, EmployeeProfile
load_dotenv()

# --- Clerk Settings ---
CLERK_PUBLISHABLE_KEY = settings.CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY = settings.CLERK_SECRET_KEY

if not CLERK_PUBLISHABLE_KEY:
    raise ValueError("Clerk Publishable Key not found in environment variables (used to derive domain)")

# Extract the core domain part (e.g., dazzling-lemming-12.clerk.accounts.dev)
try:
    CLERK_ISSUER_URL = settings.CLERK_ISSUER_URL
    CLERK_JWKS_URL = settings.CLERK_JWKS_URL
except IndexError:
    raise ValueError("Could not derive Clerk domain from Publishable Key. Set CLERK_ISSUER_URL manually.")


# Function to get JWKs with caching
def get_jwks():
    jwks = cache.get('jwks')
    if jwks:
        return jwks
    try:
        response = requests.get(CLERK_JWKS_URL, timeout=10) # Added timeout
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        jwks_data = response.json()
        cache.set('jwks', jwks_data, timeout=3600) # Cache for 1 hour
        return jwks_data
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching JWKS: {e}")
        return None # Return None if fetch fails
    except ValueError as e: # Catches JSON decoding errors
        logger.error(f"Error decoding JWKS JSON: {e}")
        return None

# --- Verification Function ---
def verify_clerk_token(token):
    jwks = get_jwks()
    if not jwks:
        raise JWTError("Could not retrieve JWKS.")

    try:
        # Get the Key ID from the token header (unverified)
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header.get("kid"):
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
        if not rsa_key:
             raise JWTError("Unable to find appropriate key")

        # Decode and verify the token
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER_URL,
            # Audience might be the frontend API key/publishable key or specific identifier
            # Set audience validation based on Clerk settings if needed. Often can be omitted initially.
            # audience="YOUR_CLERK_AUDIENCE"
            options={
                 "verify_aud": False, # Set to True and add audience kwarg if needed
                 "verify_iat": True,
                 "verify_exp": True,
            }
        )
        # Additional checks? (e.g., minimum security level if using `acr` claim)
        return payload

    except JWTError as e:
        logger.error(f"Token validation error: {e}") # Log specific error
        raise # Re-raise the JWTError
    except Exception as e:
         logger.error(f"An unexpected error occurred during token verification: {e}")
         raise JWTError(f"Unexpected verification error: {e}")


class HasClerkRole(BasePermission):
    message = 'Authentication failed or required role missing.'

    def __init__(self, allowed_roles=None):
        self.allowed_roles = list(allowed_roles) if allowed_roles else ['employee', 'hr_manager', 'admin']

    def has_permission(self, request, view):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            self.message = 'Unauthorized: Missing or invalid Authorization header.'
            logger.warning("HasClerkRole: Missing or invalid Authorization header.")
            return False
        token = auth_header.split(' ')[1]
        logger.debug(f"HasClerkRole: Token received: {token[:20]}...")
        try:
            logger.info("HasClerkRole: Attempting to verify token...")
            session_claims = verify_clerk_token(token)
            logger.info(f"HasClerkRole: Token verified. Claims: {session_claims}")
            clerk_user_id = session_claims.get('sub')
            logger.info(f"HasClerkRole: Extracted clerk_user_id: {clerk_user_id}")
            if not clerk_user_id:
                 self.message = 'Unauthorized: Invalid token claims (missing sub).'
                 logger.error(f"HasClerkRole: clerk_user_id is missing or None. Claims were: {session_claims}")
                 return False

            # Try fetching the user first
            try:
                logger.info(f"HasClerkRole: Attempting User.objects.get(clerk_id='{clerk_user_id}')")
                user = User.objects.get(clerk_id=clerk_user_id)
                logger.info(f"HasClerkRole: User {clerk_user_id} found in DB: {user.email}")
                if not user.is_active:
                     self.message = 'User account is inactive.'
                     logger.warning(f"HasClerkRole: User {user.email} is inactive.")
                     return False
                # User exists and is active, fall through to role check below

            # === START JIT Provisioning Block ===
            except User.DoesNotExist:
                logger.info(f"User {clerk_user_id} not found locally. Attempting JIT provisioning.")
                try:
                    # Extract details needed for creation from verified token
                    email = session_claims.get('email')
                    first_name = session_claims.get('given_name') or session_claims.get('firstName') or ''
                    last_name = session_claims.get('family_name') or session_claims.get('lastName') or ''

                    if not email:
                        # Cannot create user without email
                        self.message = 'Forbidden: Cannot create user profile, missing email claim in token.'
                        logger.error(f"JIT failed for {clerk_user_id} - Missing email claim. Available: {list(session_claims.keys())}")
                        return False # Fail permission check

                    # Create the local User record
                    user = User.objects.create(
                        clerk_id=clerk_user_id,
                        email=email,
                        first_name=first_name,
                        last_name=last_name,
                        role='employee',  # Assign default role
                        is_active=True
                    )
                    logger.info(f"Created new local user {user.email} via JIT.")

                    # Create the associated EmployeeProfile record
                    EmployeeProfile.objects.create(
                        user=user,
                        job_title='Pending Assignment'
                    )

                    # User is now created, continue to role check with this new 'user' object

                except Exception as jit_e:
                    # Catch potential errors during DB creation
                    logger.error(f"Failed JIT database provisioning for {clerk_user_id}: {jit_e}", exc_info=True)
                    self.message = 'Internal Server Error: Could not provision user profile during login.'
                    return False # Fail permission check if JIT DB operation fails
            # === END JIT Provisioning Block ===

            # --- Permission Granted So Far: Attach user to request ---
            # This 'user' object is either the one found or the one just created by JIT
            request.user_profile = user
            request.clerk_user_id = clerk_user_id
            request.session_claims = session_claims

            # --- Final Role Check ---
            if user.role not in self.allowed_roles:
                self.message = f'Forbidden: Role "{user.role}" does not have permission. Required: {self.allowed_roles}'
                return False # Role doesn't match requirement for this permission instance

            # --- All Checks Passed ---
            return True

        except JWTError as e:
            self.message = f'Unauthorized: Token validation failed - {e}'
            logger.error(f"HasClerkRole: JWTError during token validation: {e}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"Unexpected error in HasClerkRole permission check: {e}")
            self.message = 'Internal Server Error during authentication check.'
            logger.error(f"HasClerkRole: Unexpected error in permission check: {e}", exc_info=True) 
            return False


def clerk_auth_required(allowed_roles=None):
    if allowed_roles is None:
        allowed_roles = ['employee', 'hr_manager', 'admin']
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            # Use an INSTANCE here internally
            checker = HasClerkRole(allowed_roles=allowed_roles)
            if checker.has_permission(request, None):
                return view_func(request, *args, **kwargs)
            else:
                status_code = status.HTTP_401_UNAUTHORIZED
                if 'Forbidden' in checker.message or 'inactive' in checker.message:
                    status_code = status.HTTP_403_FORBIDDEN
                return Response({"detail": checker.message}, status=status_code)
        return _wrapped_view
    return decorator

# --- Create Specific Decorators using the factory ---
clerk_auth_employee = clerk_auth_required(allowed_roles=['employee', 'hr_manager', 'admin'])
clerk_auth_hr = clerk_auth_required(allowed_roles=['hr_manager', 'admin'])
clerk_auth_admin = clerk_auth_required(allowed_roles=['admin'])


# --- Convenience INSTANCES of Permission Class (for CBVs) ---
IsClerkEmployee = HasClerkRole(allowed_roles=['employee', 'hr_manager', 'admin'])
IsClerkHr = HasClerkRole(allowed_roles=['hr_manager', 'admin'])
IsClerkAdmin = HasClerkRole(allowed_roles=['admin'])
