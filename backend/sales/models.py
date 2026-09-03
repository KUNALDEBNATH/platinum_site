from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver


# Profile model to store role information without replacing AUTH_USER_MODEL
class Profile(models.Model):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('salesmanager', 'Sales Manager'),
        ('director', 'Director'),
        ('sales', 'Sales Executive'),
    )
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='sales')

    def __str__(self):
        return f"{self.user.username} ({self.role})"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_profile(sender, instance, created, **kwargs):
    if created:
        try:
            Profile.objects.create(user=instance)
        except Exception:
            # Avoid failing user creation for legacy installs; admin can create profile later
            pass


class User(AbstractUser):
    ROLE_CHOICES = (
        ('director', 'Director'),
        ('manager', 'Manager'),
        ('sales_executive', 'Sales Executive'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='sales_executive')

class Enquiry(models.Model):
    enquiry_id = models.CharField(max_length=20, unique=True)
    customer = models.CharField(max_length=100)
    vehicle = models.CharField(max_length=100)
    temperature = models.CharField(max_length=10)
    status = models.CharField(max_length=20)
    date = models.DateField()
    source = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.customer} - {self.vehicle}"


class Appointment(models.Model):
    appointment_id = models.CharField(max_length=20, unique=True)
    customer = models.CharField(max_length=100)
    vehicle = models.CharField(max_length=100)
    status = models.CharField(max_length=20)
    date = models.DateField()
    time = models.CharField(max_length=20)

    def __str__(self):
        return f"{self.customer} - {self.date} - {self.time}"


class Feedback(models.Model):
    feedback_id = models.CharField(max_length=20, unique=True)
    enquiry_id = models.CharField(max_length=20)
    customer = models.CharField(max_length=100)
    vehicle = models.CharField(max_length=100)
    status = models.CharField(max_length=20)
    date = models.DateField()
    rating = models.IntegerField(default=5)
    feedback_text = models.TextField(blank=True, default='')

    def __str__(self):
        return f"{self.customer} - {self.feedback_id}"