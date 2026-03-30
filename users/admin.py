from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, RefereeProfile, RefereeAvailability


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'email',
        'first_name',
        'last_name',
        'account_type',
        'is_team_manager',
        'manager_scope',
        'managed_team',
        'bipin_verified',
        'doa_approved',
        'is_active',
        'is_staff',
        'date_joined',
    )
    list_filter = (
        'account_type',
        'is_team_manager',
        'manager_scope',
        'bipin_verified',
        'doa_approved',
        'is_active',
        'is_staff',
        'is_superuser',
        'date_joined',
    )
    search_fields = (
        'email',
        'first_name',
        'last_name',
        'bipin_number',
        'organization_name',
        'managed_team__club__name',
        'managed_team__division__name',
    )
    ordering = ('-date_joined',)
    raw_id_fields = ('managed_team',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (
            'Personal Info',
            {'fields': ('first_name', 'last_name', 'phone_number', 'bipin_number')},
        ),
        (
            'Account Access',
            {
                'fields': (
                    'account_type',
                    'is_team_manager',
                    'manager_scope',
                    'managed_team',
                    'organization_name',
                    'verification_id_number',
                    'verification_id_photo',
                    'institution_head_phone',
                    'bipin_verified',
                    'doa_approved',
                )
            },
        ),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'email',
                'first_name',
                'last_name',
                'password1',
                'password2',
                'bipin_number',
                'account_type',
                'is_team_manager',
                'manager_scope',
                'managed_team',
                'organization_name',
                'verification_id_number',
                'verification_id_photo',
                'institution_head_phone',
                'bipin_verified',
                'doa_approved',
            ),
        }),
    )


@admin.register(RefereeProfile)
class RefereeProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'grade')
    list_filter = ('grade',)
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'user__bipin_number')
    raw_id_fields = ('user',)


@admin.register(RefereeAvailability)
class RefereeAvailabilityAdmin(admin.ModelAdmin):
    list_display = ('referee', 'day_of_week', 'start_time', 'end_time')
    list_filter = ('day_of_week',)
    search_fields = ('referee__user__email', 'referee__user__first_name', 'referee__user__last_name')
    raw_id_fields = ('referee',)
