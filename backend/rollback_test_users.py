import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sales_project.settings')
django.setup()

from django.contrib.auth.models import User

def rollback_users():
    usernames = ['admin', 'salesmanager', 'director']
    for username in usernames:
        try:
            user = User.objects.get(username=username)
            user.delete()
            print(f"Successfully deleted user: {username}")
        except User.DoesNotExist:
            print(f"User {username} not found.")

if __name__ == "__main__":
    rollback_users()
