from django.contrib import admin
from .models import (
    UserRole,
    RefereeProfile,
    RefereeAvailabilityWeekly,
    RefereeUnavailableDate
)


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'role')
    list_filter = ('role',)
    search_fields = ('user__username', 'role')


@admin.register(RefereeProfile)
class RefereeProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'grade', 'experience_years', 'county')
    list_filter = ('grade', 'county')
    search_fields = ('user__username', 'user__email', 'county', 'grade')


@admin.register(RefereeAvailabilityWeekly)
class RefereeAvailabilityWeeklyAdmin(admin.ModelAdmin):
    list_display = ('referee', 'day_of_week', 'start_time', 'end_time', 'available')
    list_filter = ('day_of_week', 'available')
    search_fields = ('referee__user__username',)


@admin.register(RefereeUnavailableDate)
class RefereeUnavailableDateAdmin(admin.ModelAdmin):
    list_display = ('referee', 'date', 'start_time', 'end_time')
    list_filter = ('date',)
    search_fields = ('referee__user__username',)
