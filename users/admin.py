from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin

from .models import (
    UserRole,
    RefereeProfile,
    RefereeAvailabilityWeekly,
    RefereeUnavailableDate
)

# ----------------------------------------------------
# INLINE: RefereeProfile inside User admin
# ----------------------------------------------------

class RefereeProfileInline(admin.StackedInline):
    model = RefereeProfile
    can_delete = False
    fk_name = 'user'
    verbose_name_plural = "Referee Profile"


# ----------------------------------------------------
# CUSTOM USER ADMIN (WORKS FOR NON-STAFF USERS)
# ----------------------------------------------------

class CustomUserAdmin(UserAdmin):
    inlines = (RefereeProfileInline,)
    list_display = ("username", "email", "first_name", "last_name", "is_staff", "is_active")

    def get_form(self, request, obj=None, **kwargs):
        """
        Allow editing ALL user accounts, even if not staff.
        """
        form = super().get_form(request, obj, **kwargs)
        return form

    def get_inline_instances(self, request, obj=None):
        """
        Allows showing inline RefereeProfile when the user exists.
        """
        if not obj:
            return []
        return super().get_inline_instances(request, obj)


# Replace default User admin
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)


# ----------------------------------------------------
# USER ROLE
# ----------------------------------------------------

@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'role')
    list_filter = ('role',)
    search_fields = ('user__username', 'user__email')


# ----------------------------------------------------
# REFEREE PROFILE
# ----------------------------------------------------

@admin.register(RefereeProfile)
class RefereeProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'grade', 'experience_years', 'county')
    list_filter = ('grade', 'county')
    search_fields = ('user__username', 'user__email', 'county', 'grade')
    autocomplete_fields = ('user',)


# ----------------------------------------------------
# WEEKLY AVAILABILITY
# ----------------------------------------------------

@admin.register(RefereeAvailabilityWeekly)
class RefereeAvailabilityWeeklyAdmin(admin.ModelAdmin):
    list_display = ('referee', 'day_of_week', 'start_time', 'end_time', 'available')
    list_filter = ('day_of_week', 'available')
    search_fields = ('referee__user__username',)
    autocomplete_fields = ('referee',)


# ----------------------------------------------------
# UNAVAILABLE DATE
# ----------------------------------------------------

@admin.register(RefereeUnavailableDate)
class RefereeUnavailableDateAdmin(admin.ModelAdmin):
    list_display = ('referee', 'date', 'start_time', 'end_time')
    list_filter = ('date',)
    search_fields = ('referee__user__username',)
    autocomplete_fields = ('referee',)
