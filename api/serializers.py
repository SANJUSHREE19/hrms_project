# api/serializers.py
from rest_framework import serializers
from .models import User, Department, EmployeeProfile, Salary, TitleHistory, PayRun, PayStub

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['clerk_id', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at']
        read_only_fields = ['clerk_id', 'email', 'created_at'] # Usually managed via Clerk sync or admin actions

class DepartmentSerializer(serializers.ModelSerializer):
    manager_email = serializers.EmailField(source='manager.email', read_only=True, allow_null=True)

    class Meta:
        model = Department
        fields = ['id', 'name', 'manager', 'manager_email', 'created_at', 'updated_at']
        read_only_fields = ['manager_email', 'created_at', 'updated_at']

class SalarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Salary
        fields = ['id', 'employee', 'amount', 'effective_date', 'is_current', 'created_at']
        read_only_fields = ['id', 'created_at']

class TitleHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TitleHistory
        fields = ['id', 'employee', 'job_title', 'start_date', 'end_date', 'created_at']
        read_only_fields = ['id', 'created_at']

class EmployeeProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    current_salary = SalarySerializer(read_only=True, source='salaries.first')
    current_title = TitleHistorySerializer(read_only=True, source='title_history.first')

    class Meta:
        model = EmployeeProfile
        fields = [
            'user', 'department', 'department_name', 'job_title', 'hire_date',
            'phone_number', 'address',
            'onboarding_status', 'onboarding_start_date', # <-- Added Onboarding Fields
            'current_salary', 'current_title',
            'updated_at'
        ]
        read_only_fields = [
             'user', 'department_name', 'current_salary', 'current_title', 'updated_at'
             # onboarding fields are potentially editable by HR
             ]

class EmployeeProfileBasicSerializer(serializers.ModelSerializer):
    # ... (no changes needed) ...
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    clerk_id = serializers.CharField(source='user.clerk_id', read_only=True)
    class Meta:
        model = EmployeeProfile
        fields = ['clerk_id', 'first_name', 'last_name', 'email', 'job_title', 'department_name']

class PayRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayRun
        fields = ['id', 'start_date', 'end_date', 'pay_date', 'status', 'created_at', 'processed_at']
        read_only_fields = ['id', 'status', 'created_at', 'processed_at'] # Status changed via action endpoint


# Basic serializer for PayStub list view (HR/Admin perspective)
class PayStubAdminSerializer(serializers.ModelSerializer):
    employee_email = serializers.EmailField(source='employee.user.email', read_only=True)
    employee_name = serializers.SerializerMethodField(read_only=True)
    pay_run_info = serializers.CharField(source='pay_run.__str__', read_only=True) # Or specific fields

    class Meta:
        model = PayStub
        fields = [
            'id', 'pay_run', 'pay_run_info', 'employee', 'employee_email', 'employee_name',
            'gross_pay', 'deductions', 'net_pay', 'created_at'
            ]
        read_only_fields = ['id', 'pay_run_info', 'employee_email', 'employee_name', 'created_at']
        # Employee/Run set on creation, financials might be editable pre-processing? Depends.

    def get_employee_name(self, obj):
         if obj.employee and obj.employee.user:
             return f"{obj.employee.user.first_name} {obj.employee.user.last_name}"
         return 'N/A'


# Serializer for Employee's view of their pay stubs (limited fields)
class PayStubEmployeeSerializer(serializers.ModelSerializer):
    # Hide sensitive/internal IDs from employee view
    pay_date = serializers.DateField(source='pay_run.pay_date', read_only=True)
    period_start_date = serializers.DateField(source='pay_run.start_date', read_only=True)
    period_end_date = serializers.DateField(source='pay_run.end_date', read_only=True)

    class Meta:
        model = PayStub
        fields = [
            'id', # ID of the stub itself is okay
            'pay_date', 'period_start_date', 'period_end_date',
            'gross_pay', 'deductions', 'net_pay'
             ]
        read_only_fields = fields # Employee view is read-only
