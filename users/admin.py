from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, RefereeProfile, RefereeAvailability


class RefereeProfileInline(admin.StackedInline):
    model = RefereeProfile
    can_delete = False
    verbose_name_plural = 'Referee Profile'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'first_name', 'last_name', 'is_active', 'is_staff', 'date_joined')
    list_filter = ('is_active', 'is_staff', 'is_superuser', 'date_joined')
    search_fields = ('email', 'first_name', 'last_name', 'bipin_number')
    ordering = ('-date_joined',)
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'phone_number', 'bipin_number')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login',)}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'password1', 'password2'),
        }),
    )
    inlines = [RefereeProfileInline]


@admin.register(RefereeProfile)
class RefereeProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'referee_number', 'grade')
    list_filter = ('grade',)
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'referee_number')
    raw_id_fields = ('user',)


@admin.register(RefereeAvailability)
class RefereeAvailabilityAdmin(admin.ModelAdmin):
    list_display = ('referee', 'date', 'start_time', 'end_time')
    list_filter = ('date',)
    search_fields = ('referee__user__email', 'referee__user__first_name', 'referee__user__last_name')
    date_hierarchy = 'date'
    raw_id_fields = ('referee',)
