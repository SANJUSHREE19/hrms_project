#settings.py
import os
from pathlib import Path
from dotenv import load_dotenv
import boto3 # Import boto3 to fetch parameters
import logging

logger = logging.getLogger(__name__)

load_dotenv() # Keep loading from .env for local dev, override below

BASE_DIR = Path(__file__).resolve().parent.parent
logger.error(f"DEBUG settings.py: BASE_DIR is {BASE_DIR}")

LOG_FILE_PATH_DEBUG = BASE_DIR / 'logs/django.log'

# --- Fetch Secrets from AWS Parameter Store ---
# Assumes EC2 instance has role with SSM GetParameter permissions
try:
    # MODIFIED: Specify your region
    ssm = boto3.client('ssm', region_name='us-east-1')

    def get_ssm_parameter(name, default=None):
        try:
            response = ssm.get_parameter(Name=name, WithDecryption=True)
            return response['Parameter']['Value']
        except Exception as e:
            logger.error(f"Warning: Could not fetch SSM parameter '{name}'. Error: {e}")
            if default is not None:
                logger.error(f"Using default value for {name}.")
                return default
            else:
                raise # Re-raise if no default and param is mandatory

    # Override settings from Parameter Store if available
    SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', get_ssm_parameter('/hrms/prod/django/secret_key'))
    CLERK_SECRET_KEY = os.getenv('CLERK_SECRET_KEY', get_ssm_parameter('/hrms/prod/clerk/secret_key'))
    CLERK_PUBLISHABLE_KEY = os.getenv('VITE_CLERK_PUBLISHABLE_KEY', get_ssm_parameter('/hrms/prod/clerk/publishable_key'))
    CLERK_ISSUER_URL = os.getenv('CLERK_ISSUER_URL', get_ssm_parameter('/hrms/prod/clerk/issuer_url'))
    CLERK_JWKS_URL = os.getenv('CLERK_JWKS_URL', get_ssm_parameter('/hrms/prod/clerk/jwks_url'))
    logger.info(f"DEBUG settings.py: CLERK_JWKS_URL is {CLERK_JWKS_URL} in try block")

    DB_NAME = os.getenv('DB_NAME', get_ssm_parameter('/hrms/prod/db/name'))
    DB_USER = os.getenv('DB_USER', get_ssm_parameter('/hrms/prod/db/user'))
    DB_PASSWORD = os.getenv('DB_PASSWORD', get_ssm_parameter('/hrms/prod/db/password'))
    DB_HOST = os.getenv('DB_HOST', get_ssm_parameter('/hrms/prod/db/host'))
    DB_PORT = os.getenv('DB_PORT', '3306') # Default MySQL port

    # Debug requires careful handling - fetch from SSM or use env var
    # Get DEBUG value - ensure it's treated as boolean
    debug_param = get_ssm_parameter('/hrms/prod/debug', default='False').strip().lower()
    DEBUG = debug_param in ['true', '1', 't', 'y', 'yes']

    # If your Nginx is correctly setting X-Forwarded-Proto, Django can use these
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = os.getenv('DJANGO_SECURE_SSL_REDIRECT', 'True').lower() == 'true' # True in prod
    SESSION_COOKIE_SECURE = os.getenv('DJANGO_SESSION_COOKIE_SECURE', 'True').lower() == 'true' # True in prod
    CSRF_COOKIE_SECURE = os.getenv('DJANGO_CSRF_COOKIE_SECURE', 'True').lower() == 'true' # True in prod
    # Allowed hosts - GET FROM SSM OR ENV VAR
    allowed_hosts_param = get_ssm_parameter(
        '/hrms/prod/allowed_hosts',
        default='localhost,ec2-54-165-184-90.compute-1.amazonaws.com,54.165.184.90'
    )
    ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_param.split(',') if host.strip()]


except Exception as e:
    logger.error(f"CRITICAL: Could not initialize settings from SSM. Error: {e}")
    # Define minimal fallbacks or raise an exception
    # Fallback (INSECURE - replace or ensure parameters are fetched)
    SECRET_KEY = os.getenv('DJANGO_SECRET_KEY',"GuessWhat?")
    CLERK_SECRET_KEY = os.getenv('CLERK_SECRET_KEY', "sk_test_8HFxPqpjfxZuMLeEElsX4t3tVBlEp9eZtW0QpMOWuO")
    CLERK_PUBLISHABLE_KEY = os.getenv('VITE_CLERK_PUBLISHABLE_KEY', "pk_test_YmFsYW5jZWQtcGFycm90LTIxLmNsZXJrLmFjY291bnRzLmRldiQ")
    CLERK_ISSUER_URL = os.getenv('CLERK_ISSUER_URL',"https://balanced-parrot-21.clerk.accounts.dev")
    logger.info(f"DEBUG settings.py: CLERK_ISSUER_URL is {CLERK_ISSUER_URL} in except block")
    CLERK_JWKS_URL = os.getenv('CLERK_JWKS_URL', "https://balanced-parrot-21.clerk.accounts.dev/.well-known/jwks.json")
    DEBUG = os.getenv('DEBUG', 'False').lower() in ['true', '1']
    # MODIFIED: Fallback ALLOWED_HOSTS to include EC2 details if SSM fails catastrophically
    ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'ec2-54-165-184-90.compute-1.amazonaws.com', '54.165.184.90']
    DB_NAME = os.getenv('DB_NAME', 'test_db')         # <-- Add this
    DB_USER = os.getenv('DB_USER', 'test_user')       # <-- Add this
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'test_pw') # <-- Add this
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', '3306')


if not CLERK_ISSUER_URL:
    # Fallback to derivation ONLY if explicit SSM param is missing
    if CLERK_PUBLISHABLE_KEY:
        try:
            # Ensure this derivation matches your Clerk domain structure exactly
            domain_part = CLERK_PUBLISHABLE_KEY.split('_test_')[-1].split('$')[0] if '_test_' in CLERK_PUBLISHABLE_KEY else CLERK_PUBLISHABLE_KEY.split('_live_')[-1].split('$')[0]
            CLERK_ISSUER_URL = f"https://{domain_part}.clerk.accounts.dev"
            logger.info(f"Derived CLERK_ISSUER_URL: {CLERK_ISSUER_URL} as it was not found in env/SSM.")
        except Exception as e:
            logger.error(f"Failed to derive CLERK_ISSUER_URL from PK: {e}")
            raise logger.error("CRITICAL: CLERK_ISSUER_URL could not be determined.")
    else:
        raise logger.error("CRITICAL: CLERK_ISSUER_URL not set and cannot derive from missing CLERK_PUBLISHABLE_KEY.")

if not CLERK_JWKS_URL:
    if CLERK_ISSUER_URL:
        CLERK_JWKS_URL = f"{CLERK_ISSUER_URL}/.well-known/jwks.json"
        logger.error(f"Derived CLERK_JWKS_URL: {CLERK_JWKS_URL} as it was not found in env/SSM.")
    else:
        raise logger.error("CRITICAL: CLERK_JWKS_URL not set and cannot derive from missing CLERK_ISSUER_URL.")
# CSRF Trusted Origins (Needed if Frontend/Backend on different domains)
# MODIFIED: Replace with your actual CloudFront domain name
CLOUDFRONT_DOMAIN_NAME = "d34aj6w546j7d5.cloudfront.net"
CSRF_TRUSTED_ORIGINS = [
    f"https://{CLOUDFRONT_DOMAIN_NAME}",
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# CORS Allowed Origins
CORS_ALLOWED_ORIGINS = [
    f"https://{CLOUDFRONT_DOMAIN_NAME}",
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_METHODS = False
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]
INSTALLED_APPS = [ # Ensure boto3 is not needed here usually
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles', # Ensure this is present for WhiteNoise/static files
    'rest_framework',
    'corsheaders',
    'api', # Your app
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware', # Added for serving static admin files easily
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'hrms_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'hrms_backend.wsgi.application'

# Database settings (Use variables populated from SSM/env)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': DB_NAME,
        'USER': DB_USER,
        'PASSWORD': DB_PASSWORD,
        'HOST': DB_HOST,
        'PORT': DB_PORT,
        'OPTIONS': {'init_command': "SET sql_mode='STRICT_TRANS_TABLES'"},
    }
}

# Password validation
# https://docs.djangoproject.com/en/stable/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
# https://docs.djangoproject.com/en/stable/topics/i18n/
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_L10N = True # Django 5.0 changes USE_L10N to False by default. Set to True if needed.
USE_TZ = True


# Static files (Served by Nginx/WhiteNoise, or only admin files if main frontend on S3)
STATIC_URL = 'static/'
# Define STATIC_ROOT - where collectstatic will place files
STATIC_ROOT = BASE_DIR / 'staticfiles' # Needs Whitenoise for easy serving
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Default primary key field type
# https://docs.djangoproject.com/en/stable/ref/settings/#default-auto-field
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Auth utils also needs clerk keys (Assuming CLERK_PUBLISHABLE_KEY is fetched correctly from SSM)
# Ensure CLERK_PUBLISHABLE_KEY format is like "pk_live_xxxxxxxxxxxxx" or "pk_test_xxxxxxxxxxx"
# and the part after the first underscore and before the second (if any, often a $) is the instance ID
# e.g. pk_live_clerk.yourdomain.com$string or pk_test_happy.frog.123
if CLERK_PUBLISHABLE_KEY and isinstance(CLERK_PUBLISHABLE_KEY, str):
    try:
        # This parsing logic might need adjustment based on your exact CLERK_PUBLISHABLE_KEY format
        # A common format is "pk_{env}_{instance_id_like_url}"
        # e.g., pk_live_clerk.example.com$ Vigo -> clerk.example.com
        # another example: pk_test_foo-bar-123.clerk.accounts.dev -> foo-bar-123.clerk.accounts.dev
        key_parts = CLERK_PUBLISHABLE_KEY.split('_')
        if len(key_parts) > 2: # e.g. pk_live_instance.domain.com
            clerk_instance_domain = key_parts[2].split('$')[0] # Remove potential suffix after $
            CLERK_ISSUER_URL = f"https://{clerk_instance_domain}"
            CLERK_JWKS_URL = f"{CLERK_ISSUER_URL}/.well-known/jwks.json"
        else:
            logger.error("Warning: CLERK_PUBLISHABLE_KEY format not as expected for deriving CLERK_ISSUER_URL. It might need manual setting or adjustment.")
            CLERK_ISSUER_URL = os.getenv('CLERK_ISSUER_URL', 'https://your-clerk-issuer-url.com') # Fallback
            CLERK_JWKS_URL = os.getenv('CLERK_JWKS_URL', f"{CLERK_ISSUER_URL}/.well-known/jwks.json") # Fallback
    except Exception as e:
        logger.error(f"Warning: Could not parse CLERK_PUBLISHABLE_KEY for CLERK_ISSUER_URL. Error: {e}")
        CLERK_ISSUER_URL = os.getenv('CLERK_ISSUER_URL', 'https://your-clerk-issuer-url.com') # Fallback
        CLERK_JWKS_URL = os.getenv('CLERK_JWKS_URL', f"{CLERK_ISSUER_URL}/.well-known/jwks.json") # Fallback
else:
    logger.error("Warning: CLERK_PUBLISHABLE_KEY is not set or not a string. CLERK_ISSUER_URL and CLERK_JWKS_URL may be incorrect.")
    CLERK_ISSUER_URL = os.getenv('CLERK_ISSUER_URL', 'https://your-clerk-issuer-url.com') # Fallback
    CLERK_JWKS_URL = os.getenv('CLERK_JWKS_URL', f"{CLERK_ISSUER_URL}/.well-known/jwks.json") # Fallback


# Logging configuration (Example - customize as needed)
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
            'level': 'DEBUG', # Keep console at DEBUG for now
        },
        'file': {
            'level': 'DEBUG', # Temporarily set file to DEBUG to capture everything
            'class': 'logging.FileHandler',
            # Ensure this path is writable by the user Gunicorn runs as
            'filename': BASE_DIR / 'logs/django.log', # Corrected path to be inside project if BASE_DIR is project root
             'formatter': 'verbose',
        },
    },
    'formatters': { # Define formatters first
         'verbose': {
             'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
             'style': '{',
         },
         'simple': {
             'format': '{levelname} {message}',
             'style': '{',
         },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO', # Root level
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        'api': { # Specific logger for your 'api' app
            'handlers': ['console', 'file'],
            'level': 'DEBUG', # Set to DEBUG to capture all levels (INFO, ERROR, etc.)
            'propagate': False, # Don't let it bubble up to root if handled here
        },
        'api.auth_utils': { # Even more specific for the module
            'handlers': ['console', 'file'],
            'level': 'DEBUG', # DEBUG for this module specifically
            'propagate': False,
        }
    },
}
# Create logs directory if it doesn't exist
LOG_DIR = BASE_DIR / 'logs'
if not LOG_DIR.exists():
    logger.error(f"DEBUG: Creating logs directory: {LOG_DIR.resolve()}")
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        logger.error(f"DEBUG: Successfully attempted mkdir for {LOG_DIR.resolve()}")
    except Exception as e:
        logger.error(f"DEBUG: ERROR creating log directory {LOG_DIR.resolve()}: {e}")
