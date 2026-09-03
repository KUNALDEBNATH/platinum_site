from django.urls import path

from .views import (
    UserRegistrationView,
    chat_api,
    create_appointment,
    create_enquiry,
    create_feedback,
    current_user,
    director_dashboard_api,
    get_appointments,
    get_audit_logs,
    get_enquiries,
    get_feedback,
    get_revenue_report,
    health_api,
    reset_chat_api,
    suggestions_api,
)

urlpatterns = [
    path('auth/me/', current_user, name='current_user'),
    path('enquiry/', get_enquiries, name='get_enquiries'),
    path('enquiry/create/', create_enquiry, name='create_enquiry'),
    path('appointment/', get_appointments, name='get_appointments'),
    path('appointment/create/', create_appointment, name='create_appointment'),
    path('feedback/', get_feedback, name='get_feedback'),
    path('feedback/create/', create_feedback, name='create_feedback'),
    path('director/revenue/', get_revenue_report, name='revenue_report'),
    path('admin/logs/', get_audit_logs, name='audit_logs'),
    path('chat/', chat_api, name='chat_api'),

    path('health/', health_api, name='health_api'),

    path('suggestions/', suggestions_api, name='suggestions_api'),

    path('reset/', reset_chat_api, name='reset_chat_api'),
    path('director/dashboard/', director_dashboard_api, name='director_dashboard_api'),
    path('register/', UserRegistrationView.as_view(), name='user-registration'),
]
