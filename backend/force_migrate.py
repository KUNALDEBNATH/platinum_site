import os
import django
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sales_project.settings')
django.setup()

try:
    print("Starting migration...")
    call_command('migrate', interactive=False)
    print("Migration finished!")
except Exception as e:
    print(f"Error during migration: {e}")
