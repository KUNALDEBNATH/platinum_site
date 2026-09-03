from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Enquiry, Appointment, Feedback, Profile


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = 'profile'


class CustomUserAdmin(UserAdmin):
    model = User
    inlines = (ProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (
        (None, {'fields': ('role',)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        (None, {'fields': ('role',)}),
    )


admin.site.register(User, CustomUserAdmin)
admin.site.register(Enquiry)
admin.site.register(Appointment)
admin.site.register(Feedback)
