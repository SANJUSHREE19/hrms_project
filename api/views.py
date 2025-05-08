# api/views.py
import os
from decimal import Decimal
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.response import Response
from rest_framework import status, generics, viewsets, mixins
from rest_framework.permissions import AllowAny
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction

# Import Permission utilities and decorators
from .auth_utils import IsClerkEmployee, IsClerkHr, IsClerkAdmin
from .auth_utils import clerk_auth_employee, clerk_auth_hr, clerk_auth_admin

# Import Models
from .models import (
    User, Department, EmployeeProfile, Salary, TitleHistory, PayRun, PayStub
)
# Import Serializers
from .serializers import (
    UserSerializer, DepartmentSerializer, EmployeeProfileSerializer,
    SalarySerializer, TitleHistorySerializer, EmployeeProfileBasicSerializer,
    PayRunSerializer, PayStubAdminSerializer, PayStubEmployeeSerializer
)


# --- User Synchronization Endpoint ---
@api_view(['POST'])
@permission_classes([AllowAny]) # Assumes webhook verification will be added for production
def sync_clerk_user(request):
    data = request.data.get('data')
    print(f"Received data: {data}")
    event_type = request.data.get('type')
    if not data:
        return Response({"error": "Invalid payload"}, status=status.HTTP_400_BAD_REQUEST)

    clerk_id = data.get('id')
    email = next((e['email_address'] for e in data.get('email_addresses', []) if e.get('verification', {}).get('status') == 'verified'), None)
    first_name = data.get('first_name', '')
    last_name = data.get('last_name', '')
    role = 'employee' # Default role

    if not clerk_id or not email:
         return Response({"error": "Missing clerk_id or verified email"}, status=status.HTTP_400_BAD_REQUEST)

    if event_type in ['user.created', 'user.updated']:
        user, created = User.objects.update_or_create(
            clerk_id=clerk_id,
            defaults={
                'email': email,
                'first_name': first_name,
                'last_name': last_name,
                'role': role,
                'is_active': True
            }
        )
        # Ensure profile exists
        EmployeeProfile.objects.get_or_create(
            user=user,
            defaults={'job_title': 'Pending Assignment'}
        )
        serializer = UserSerializer(user)
        return Response({"message": f"User {'created' if created else 'updated'} successfully", "user": serializer.data}, status=status.HTTP_200_OK)

    elif event_type == 'user.deleted':
        deleted_count, _ = User.objects.filter(clerk_id=clerk_id).delete()
        if deleted_count > 0:
             return Response({"message": "User deleted successfully"}, status=status.HTTP_200_OK)
        else:
             return Response({"message": "User not found to delete"}, status=status.HTTP_404_NOT_FOUND)

    return Response({"message": "Event type not handled"}, status=status.HTTP_200_OK)


# --- Current User Endpoint ---
@api_view(['GET'])
@clerk_auth_employee # Decorator for FBV - sets request.user_profile
def get_current_user_profile(request):
    try:
        profile = EmployeeProfile.objects.select_related('user', 'department')\
                                     .prefetch_related('salaries', 'title_history')\
                                     .get(user=request.user_profile)
        serializer = EmployeeProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)
    except EmployeeProfile.DoesNotExist:
         return Response({'error': 'Employee profile not found for this user. Please contact Admin.'}, status=status.HTTP_404_NOT_FOUND)
    except AttributeError:
         # Only happens if decorator fails to attach user_profile
         return Response({'error': 'Authentication user profile not found in request.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
         return Response({'error': f'An unexpected error occurred: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- Employee Directory & Search ---
@api_view(['GET'])
@clerk_auth_employee # Decorator for FBV
def list_employees(request):
    try:
        queryset = EmployeeProfile.objects.select_related('user', 'department').filter(user__is_active=True).order_by('user__last_name', 'user__first_name')

        dept_id = request.query_params.get('department')
        title = request.query_params.get('title')
        search_term = request.query_params.get('search')

        if dept_id:
            try:
                queryset = queryset.filter(department__id=int(dept_id))
            except (ValueError, TypeError):
                 return Response({'error': 'Invalid department ID format.'}, status=status.HTTP_400_BAD_REQUEST)
        if title:
            queryset = queryset.filter(job_title__icontains=title)
        if search_term:
            queryset = queryset.filter(
                Q(user__first_name__icontains=search_term) |
                Q(user__last_name__icontains=search_term) |
                Q(user__email__icontains=search_term) |
                Q(job_title__icontains=search_term) |
                Q(department__name__icontains=search_term)
            )
        serializer = EmployeeProfileBasicSerializer(queryset, many=True)
        return Response(serializer.data)
    except Exception as e:
         return Response({'error': f'Could not retrieve employee list: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- Department Views (Admin CRUD, Employee View) ---
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.select_related('manager').all().order_by('name')
    serializer_class = DepartmentSerializer
    def get_permissions(self):
        if self.action in ['list', 'retrieve']: permissions_instances = [IsClerkEmployee]
        else: permissions_instances = [IsClerkAdmin]
        return permissions_instances

# --- HR Manager: Manage Employee Profile (HR/Admin Update) ---
@api_view(['GET', 'PUT'])
@clerk_auth_hr # Decorator for FBV - ensures user is HR/Admin and attaches request.user_profile
def manage_employee_profile(request, clerk_id):
    profile = get_object_or_404(EmployeeProfile.objects.select_related('user', 'department'), user__clerk_id=clerk_id)

    if request.method == 'GET':
        serializer = EmployeeProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = EmployeeProfileSerializer(profile, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
             hr_editable_profile_fields = [
                 'department', 'job_title', 'hire_date', 'phone_number', 'address',
                 'onboarding_status', 'onboarding_start_date'
             ]
             validated_data = serializer.validated_data
             original_job_title = profile.job_title
             fields_to_update = {}

             for field in hr_editable_profile_fields:
                 if field in validated_data:
                     current_value = getattr(profile, field)
                     new_value = validated_data[field]
                     is_foreign_key_changed = False
                     if field == 'department':
                          # Compare PKs for foreign keys, handling nulls
                         if (current_value is None and new_value is not None) or \
                            (current_value is not None and new_value is None) or \
                            (current_value is not None and new_value is not None and current_value.pk != new_value.pk):
                             is_foreign_key_changed = True

                     if is_foreign_key_changed or (field != 'department' and current_value != new_value) :
                           fields_to_update[field] = new_value

             if fields_to_update:
                 for field, value in fields_to_update.items():
                    setattr(profile, field, value)
                 # Only save fields that were actually updated
                 profile.save(update_fields=fields_to_update.keys())

                 # Title History Update Logic
                 new_job_title = fields_to_update.get('job_title')
                 if new_job_title and new_job_title != original_job_title:
                      latest_title_entry = TitleHistory.objects.filter(employee=profile).order_by('-start_date', '-id').first()
                      today = timezone.now().date()
                      if latest_title_entry and latest_title_entry.job_title != new_job_title:
                          if latest_title_entry.end_date is None:
                              end_date_update = today - timezone.timedelta(days=1)
                              if end_date_update < latest_title_entry.start_date: end_date_update = latest_title_entry.start_date
                              latest_title_entry.end_date = end_date_update
                              latest_title_entry.save(update_fields=['end_date'])
                          TitleHistory.objects.create(employee=profile, job_title=new_job_title, start_date=today)
                      elif not latest_title_entry:
                           start_date = profile.hire_date if profile.hire_date else today
                           TitleHistory.objects.create(employee=profile, job_title=new_job_title, start_date=start_date)

             # Return updated data
             refreshed_profile = EmployeeProfile.objects.get(pk=profile.pk)
             response_serializer = EmployeeProfileSerializer(refreshed_profile, context={'request': request})
             return Response(response_serializer.data)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# --- Salary Views (HR/Admin CRUD) ---
class SalaryViewSet(viewsets.ModelViewSet):
    serializer_class = SalarySerializer
    def dispatch(self, request, *args, **kwargs):
        checker = IsClerkHr
        if not checker.has_permission(request, self):
            status_code = status.HTTP_401_UNAUTHORIZED
            if hasattr(checker, 'message') and ('Forbidden' in checker.message or 'inactive' in checker.message or 'not found' in checker.message):
                status_code = status.HTTP_403_FORBIDDEN
            return Response({"detail": getattr(checker, 'message', "Permission Denied")}, status=status_code)
        return super().dispatch(request, *args, **kwargs)
    def get_queryset(self):
        queryset = Salary.objects.select_related('employee__user').all()
        clerk_id = self.request.query_params.get('clerk_id')
        if clerk_id: queryset = queryset.filter(employee__user__clerk_id=clerk_id)
        return queryset.order_by('-effective_date', '-id')
    @transaction.atomic
    def perform_create(self, serializer):
        employee_profile = serializer.validated_data['employee']
        Salary.objects.filter(employee=employee_profile, is_current=True).update(is_current=False)
        serializer.save(is_current=True)
    @transaction.atomic
    def perform_update(self, serializer):
        if serializer.validated_data.get('is_current', False):
            employee_profile = serializer.instance.employee
            Salary.objects.filter(employee=employee_profile, is_current=True).exclude(pk=serializer.instance.pk).update(is_current=False)
        serializer.save()

# --- Title History Views (Admin CRUD, Employee View) ---
class TitleHistoryViewSet(viewsets.ModelViewSet):
    serializer_class = TitleHistorySerializer
    def get_permissions(self):
        if self.action in ['list', 'retrieve']: permissions_instances = [IsClerkEmployee]
        else: permissions_instances = [IsClerkAdmin]
        return permissions_instances
    def get_queryset(self):
         queryset = TitleHistory.objects.select_related('employee__user').all()
         clerk_id = self.request.query_params.get('clerk_id')
         if clerk_id: queryset = queryset.filter(employee__user__clerk_id=clerk_id)
         return queryset.order_by('-start_date', '-id')

# --- Admin: User Management Views ---
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('email')
    serializer_class = UserSerializer
    lookup_field = 'clerk_id'
    def dispatch(self, request, *args, **kwargs):
        checker = IsClerkAdmin
        if not checker.has_permission(request, self):
            status_code = status.HTTP_401_UNAUTHORIZED
            if hasattr(checker, 'message') and ('Forbidden' in checker.message or 'inactive' in checker.message or 'not found' in checker.message):
                status_code = status.HTTP_403_FORBIDDEN
            return Response({"detail": getattr(checker, 'message', "Permission Denied")}, status=status_code)
        return super().dispatch(request, *args, **kwargs)
    def perform_update(self, serializer):
        instance = serializer.instance
        allowed_updates = {'role': serializer.validated_data.get('role', instance.role), 'is_active': serializer.validated_data.get('is_active', instance.is_active)}
        User.objects.filter(pk=instance.pk).update(**allowed_updates)
    def perform_destroy(self, instance):
         User.objects.filter(pk=instance.pk).update(is_active=False)


# --- Onboarding Views ---
@api_view(['GET'])
@clerk_auth_hr # Decorator for FBV
def list_pending_onboarding(request):
    try:
         pending_statuses = ['Pending', 'Scheduled', 'InProgress']
         queryset = EmployeeProfile.objects.select_related('user', 'department')\
                         .filter(onboarding_status__in=pending_statuses)\
                         .order_by('onboarding_start_date', 'user__last_name')
         serializer = EmployeeProfileSerializer(queryset, many=True, context={'request': request})
         return Response(serializer.data)
    except Exception as e:
         return Response({'error': f'Could not retrieve onboarding list: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- Payroll Views ---
class PayRunViewSet(viewsets.ModelViewSet):
    queryset = PayRun.objects.all().order_by('-pay_date', '-id')
    serializer_class = PayRunSerializer
    def dispatch(self, request, *args, **kwargs):
        checker = IsClerkHr
        if not checker.has_permission(request, self):
            status_code = status.HTTP_401_UNAUTHORIZED
            if hasattr(checker, 'message') and ('Forbidden' in checker.message or 'inactive' in checker.message or 'not found' in checker.message):
                status_code = status.HTTP_403_FORBIDDEN
            return Response({"detail": getattr(checker, 'message', "Permission Denied")}, status=status_code)
        return super().dispatch(request, *args, **kwargs)
    @action(detail=True, methods=['post'], url_path='process')
    @transaction.atomic
    def process_payroll(self, request, pk=None):
        pay_run = self.get_object();
        if pay_run.status != 'Pending': return Response({'error': 'Payroll can only be processed from Pending status.'}, status=status.HTTP_400_BAD_REQUEST)
        pay_run.status = 'Processing'; pay_run.save()
        try:
            profiles_to_pay = EmployeeProfile.objects.filter(user__is_active=True);
            if not profiles_to_pay.exists(): pay_run.status='Completed'; pay_run.processed_at = timezone.now(); pay_run.save(); return Response({'message': 'No eligible employees found...'}, status=status.HTTP_200_OK)
            stubs_created_count = 0
            for profile in profiles_to_pay:
                current_salary_obj = Salary.objects.filter(employee=profile, is_current=True).first()
                if not current_salary_obj: continue
                days_in_period=max(1, (...)); daily_rate = ...; estimated_gross = ...; estimated_deductions = ...; estimated_net = ...;
                PayStub.objects.create(pay_run=pay_run, employee=profile, gross_pay=estimated_gross.quantize(Decimal("0.01")), deductions=estimated_deductions.quantize(Decimal("0.01")), net_pay=estimated_net.quantize(Decimal("0.01")))
                stubs_created_count += 1
            pay_run.status = 'Completed'; pay_run.processed_at = timezone.now(); pay_run.save();
            return Response({'message': f'Payroll processed... {stubs_created_count} stubs generated.'}, status=status.HTTP_200_OK)
        except Exception as e: pay_run.status='Failed'; pay_run.processed_at=timezone.now(); pay_run.save(); return Response({'error': f'Error during processing: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PayStubAdminViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = PayStubAdminSerializer
    def dispatch(self, request, *args, **kwargs):
        checker = IsClerkHr
        if not checker.has_permission(request, self):
            status_code = status.HTTP_401_UNAUTHORIZED
            if hasattr(checker, 'message') and ('Forbidden' in checker.message or 'inactive' in checker.message or 'not found' in checker.message):
                status_code = status.HTTP_403_FORBIDDEN
            return Response({"detail": getattr(checker, 'message', "Permission Denied")}, status=status_code)
        return super().dispatch(request, *args, **kwargs)
    def get_queryset(self):
        queryset = PayStub.objects.select_related('pay_run', 'employee__user').all()
        pay_run_id = self.request.query_params.get('run_id'); employee_clerk_id = self.request.query_params.get('clerk_id');
        if pay_run_id:
            try:
                queryset = queryset.filter(pay_run__id=int(pay_run_id))
            except (ValueError, TypeError):
                pass
        if employee_clerk_id:
            queryset = queryset.filter(employee__user__clerk_id=employee_clerk_id)
        return queryset.order_by('-pay_run__pay_date', 'employee__user__last_name')


@api_view(['GET'])
@clerk_auth_employee # Decorator for FBV
def list_my_paystubs(request):
    try:
         employee_profile = get_object_or_404(EmployeeProfile, user=request.user_profile)
         queryset = PayStub.objects.select_related('pay_run')\
                        .filter(employee=employee_profile)\
                        .order_by('-pay_run__pay_date')
         serializer = PayStubEmployeeSerializer(queryset, many=True)
         return Response(serializer.data)
    except EmployeeProfile.DoesNotExist:
          return Response({'error': 'Could not find employee profile associated with your user.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
          return Response({'error': f'Could not retrieve your pay stubs: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- NEW HR Stats Endpoint ---
@api_view(['GET'])
@clerk_auth_hr # Decorator for FBV - requires HR or Admin role
def get_hr_stats(request):
    """ Returns key statistics for the HR Overview dashboard. """
    try:
        active_employees_count = EmployeeProfile.objects.filter(user__is_active=True).count()
        pending_onboarding_statuses = ['Pending', 'Scheduled', 'InProgress']
        pending_onboarding_count = EmployeeProfile.objects.filter(onboarding_status__in=pending_onboarding_statuses).count()
        pending_payruns_count = PayRun.objects.filter(status='Pending').count()

        stats = {
            "active_employees_count": active_employees_count,
            "pending_onboarding_count": pending_onboarding_count,
            "pending_payruns_count": pending_payruns_count,
            # Add more stats as needed (e.g., recent hires, upcoming reviews)
        }
        return Response(stats)

    except Exception as e:
        # Log the exception for debugging
        print(f"ERROR fetching HR stats: {e}")
        return Response({'error': f'Could not retrieve HR statistics: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@clerk_auth_admin # Decorator for FBV - requires Admin role
def get_admin_stats(request):
    """ Returns key statistics for the Admin Overview dashboard. """
    try:
        total_users_count = User.objects.count()
        active_users_count = User.objects.filter(is_active=True).count()
        department_count = Department.objects.count()
        # Could add more stats like pending payrolls, onboarding users etc.

        stats = {
            "total_users_count": total_users_count,
            "active_users_count": active_users_count,
            "department_count": department_count,
        }
        return Response(stats)

    except Exception as e:
        print(f"ERROR fetching Admin stats: {e}")
        return Response({'error': f'Could not retrieve Admin statistics: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
