# hrms_backend/urls.py
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls), # Django admin interface
    path('api/', include('api.urls')), # Include your API app's URLs
]
