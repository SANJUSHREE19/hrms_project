from django.contrib import admin

# Register your models here.
# api/admin.py
from django.contrib import admin
# Ensure you import ALL the models you want to see
from .models import User, Department, EmployeeProfile, Salary, TitleHistory, PayRun, PayStub

# Optional: Define custom admin displays for better usability
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'clerk_id', 'first_name', 'last_name', 'role', 'is_active')
    search_fields = ('email', 'first_name', 'last_name', 'clerk_id')
    list_filter = ('role', 'is_active')

class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = ('get_user_email', 'job_title', 'department', 'hire_date') # Use custom method for email
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'job_title')
    list_filter = ('department',)
    raw_id_fields = ('user', 'department') # Makes linking easier

    @admin.display(ordering='user__email', description='User Email')
    def get_user_email(self, obj):
        return obj.user.email # Display related user email

class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'get_manager_email') # Use custom method
    search_fields = ('name', 'manager__email')
    raw_id_fields = ('manager',) # Use raw_id_fields for ForeignKey to User

    @admin.display(ordering='manager__email', description='Manager Email')
    def get_manager_email(self, obj):
         return obj.manager.email if obj.manager else None


class SalaryAdmin(admin.ModelAdmin):
    list_display = ('get_employee_email', 'amount', 'effective_date', 'is_current') # Custom method
    search_fields = ('employee__user__email',)
    list_filter = ('is_current', 'effective_date')
    raw_id_fields = ('employee',) # Use raw_id_fields for ForeignKey to EmployeeProfile

    @admin.display(ordering='employee__user__email', description='Employee Email')
    def get_employee_email(self, obj):
        return obj.employee.user.email if obj.employee else None


class TitleHistoryAdmin(admin.ModelAdmin):
    list_display = ('get_employee_email', 'job_title', 'start_date', 'end_date') # Custom method
    search_fields = ('employee__user__email', 'job_title')
    list_filter = ('start_date', )
    raw_id_fields = ('employee',)

    @admin.display(ordering='employee__user__email', description='Employee Email')
    def get_employee_email(self, obj):
         return obj.employee.user.email if obj.employee else None

class PayRunAdmin(admin.ModelAdmin):
     list_display = ('id', 'start_date', 'end_date', 'pay_date', 'status', 'processed_at')
     list_filter = ('status', 'pay_date')
     search_fields = ('id',)
     date_hierarchy = 'pay_date'

class PayStubAdmin(admin.ModelAdmin):
     list_display = ('id', 'get_employee_email', 'pay_run', 'net_pay')
     list_filter = ('pay_run__pay_date',)
     search_fields = ('employee__user__email', 'pay_run__id')
     raw_id_fields = ('employee', 'pay_run') # Use raw_id for FKs

     @admin.display(ordering='employee__user__email', description='Employee Email')
     def get_employee_email(self, obj):
         return obj.employee.user.email if obj.employee else None
     

# === Register your models with the admin site ===
# Make sure ALL these lines are present and uncommented
admin.site.register(User, UserAdmin)
admin.site.register(Department, DepartmentAdmin)
admin.site.register(EmployeeProfile, EmployeeProfileAdmin)
admin.site.register(Salary, SalaryAdmin)
admin.site.register(TitleHistory, TitleHistoryAdmin)
admin.site.register(PayRun, PayRunAdmin)
admin.site.register(PayStub, PayStubAdmin)
