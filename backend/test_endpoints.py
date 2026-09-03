import os
import sys
import django
from django.test import Client
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sales_project.settings')
django.setup()

from django.contrib.auth.models import User
from sales.models import Profile

def verify():
    # create test director if not exists
    director_user, created = User.objects.get_or_create(username='test_director')
    if created:
        director_user.set_password('password123')
        director_user.save()
    Profile.objects.update_or_create(user=director_user, defaults={'role': 'director'})
    
    # create test admin if not exists
    admin_user, created = User.objects.get_or_create(username='test_admin', is_staff=True, is_superuser=True)
    if created:
        admin_user.set_password('password123')
        admin_user.save()
    Profile.objects.update_or_create(user=admin_user, defaults={'role': 'admin'})
    
    client = Client()
    
    # Test Director Revenue API
    response = client.post('/api/token/', {'username': 'test_director', 'password': 'password123'})
    token = response.json().get('access')
    
    response = client.get('/api/director/revenue/', HTTP_AUTHORIZATION=f'Bearer {token}')
    print("Director Revenue API Status:", response.status_code)
    print("Director Revenue Data:", json.dumps(response.json(), indent=2))
    
    # Test Admin Logs API
    response = client.post('/api/token/', {'username': 'test_admin', 'password': 'password123'})
    admin_token = response.json().get('access')
    
    response = client.get('/api/admin/logs/', HTTP_AUTHORIZATION=f'Bearer {admin_token}')
    print("Admin Logs API Status:", response.status_code)
    print("Admin Logs Data:", json.dumps(response.json(), indent=2))

if __name__ == '__main__':
    verify()
