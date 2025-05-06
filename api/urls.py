from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'departments', views.DepartmentViewSet)
router.register(r'salaries', views.SalaryViewSet, basename='salary')
router.register(r'titles', views.TitleHistoryViewSet, basename='titlehistory')
router.register(r'admin/users', views.UserViewSet, basename='admin-user')
router.register(r'payroll/runs', views.PayRunViewSet, basename='payrun')
router.register(r'payroll/stubs-admin', views.PayStubAdminViewSet, basename='paystub-admin')


urlpatterns = [
    path('', include(router.urls)),
    path('sync-user/', views.sync_clerk_user, name='sync-user'),
    path('me/', views.get_current_user_profile, name='get-current-user'),
    path('employees/', views.list_employees, name='list-employees'),
    path('manage/employee/<str:clerk_id>/', views.manage_employee_profile, name='manage-employee-profile'),
    path('hr/onboarding/pending/', views.list_pending_onboarding, name='list-pending-onboarding'),
    path('my/paystubs/', views.list_my_paystubs, name='my-paystubs'),
    path('hr/stats/', views.get_hr_stats, name='get-hr-stats'),
    path('admin/stats/', views.get_admin_stats, name='get-admin-stats'),
]
