# api/models.py
from django.db import models
from django.conf import settings # If using settings.AUTH_USER_MODEL later
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin # If swapping AUTH_USER_MODEL
from django.core.exceptions import ValidationError # For custom validation


# --- Existing Models (User, Department) ---
class User(models.Model):
    ROLE_CHOICES = [
        ('employee', 'Employee'),
        ('hr_manager', 'HR Manager'),
        ('admin', 'Administrator'),
    ]
    clerk_id = models.CharField(max_length=255, unique=True, primary_key=True)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.email

class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    # Ensure manager FK links to your User model correctly
    manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_department')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


# --- Updated EmployeeProfile Model ---
class EmployeeProfile(models.Model):
    ONBOARDING_STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Scheduled', 'Scheduled'), # E.g., Offer accepted, start date set
        ('InProgress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'), # If hire doesn't proceed
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='profile')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    job_title = models.CharField(max_length=100)
    hire_date = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)

    # New Onboarding Fields
    onboarding_status = models.CharField(
        max_length=20,
        choices=ONBOARDING_STATUS_CHOICES,
        default='Pending', # Default for new profiles
        null=True, blank=True # Allow null initially
    )
    onboarding_start_date = models.DateField(null=True, blank=True) # Tentative or actual start date

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile for {self.user.email}"

# --- Existing Salary and TitleHistory ---
class Salary(models.Model):
    employee = models.ForeignKey(EmployeeProfile, on_delete=models.CASCADE, related_name='salaries')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    effective_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_current = models.BooleanField(default=True)

    class Meta:
        ordering = ['-effective_date', '-id'] # Ensure unique ordering

    def __str__(self):
        return f"{self.employee.user.email} - {self.amount} as of {self.effective_date}"

class TitleHistory(models.Model):
    employee = models.ForeignKey(EmployeeProfile, on_delete=models.CASCADE, related_name='title_history')
    job_title = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date', '-id']

    def __str__(self):
        return f"{self.employee.user.email} - {self.job_title} starting {self.start_date}"

# --- New Payroll Models ---
class PayRun(models.Model):
    """ Represents a scheduled or processed payroll period. """
    STATUS_CHOICES = [
        ('Pending', 'Pending'), # Scheduled but not processed
        ('Processing', 'Processing'), # In progress
        ('Completed', 'Completed'),
        ('Failed', 'Failed'),
    ]
    start_date = models.DateField()
    end_date = models.DateField()
    pay_date = models.DateField() # Date employees get paid
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True) # When completed/failed

    class Meta:
        ordering = ['-pay_date', '-id']

    def clean(self):
        # Basic validation
        if self.end_date < self.start_date:
            raise ValidationError("End date cannot be before start date.")
        if self.pay_date < self.end_date:
            raise ValidationError("Pay date cannot be before period end date.")

    def __str__(self):
        return f"Pay Run: {self.start_date} to {self.end_date} (Pay Date: {self.pay_date}) - {self.status}"


class PayStub(models.Model):
    """ Represents an individual's pay details for a specific run. """
    pay_run = models.ForeignKey(PayRun, on_delete=models.CASCADE, related_name='paystubs')
    employee = models.ForeignKey(EmployeeProfile, on_delete=models.PROTECT, related_name='paystubs') # Protect stubs if employee deleted? Decide policy.
    # Financial Details - ensure appropriate security/encryption in a real app
    gross_pay = models.DecimalField(max_digits=12, decimal_places=2)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0.00) # Simplified
    net_pay = models.DecimalField(max_digits=12, decimal_places=2) # Often calculated gross - deductions
    # Pay date redundant? Already on PayRun? Can be useful for display.
    # pay_date = models.DateField() # Inherited from pay_run usually

    created_at = models.DateTimeField(auto_now_add=True) # When stub was generated

    class Meta:
        ordering = ['-pay_run__pay_date', '-id']
        # Prevent duplicate stubs for the same employee in the same run
        unique_together = ('pay_run', 'employee')

    def clean(self):
        # Basic calculation check (can be done on save)
        if self.gross_pay - self.deductions != self.net_pay:
            # Optionally auto-calculate net_pay here or raise error
            # self.net_pay = self.gross_pay - self.deductions
             raise ValidationError("Net pay does not match gross pay minus deductions.")

    def __str__(self):
        return f"Paystub for {self.employee.user.email} - Run {self.pay_run.id} (Pay Date: {self.pay_run.pay_date})"
