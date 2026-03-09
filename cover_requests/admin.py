from django.contrib import admin
from .models import CoverRequest


@admin.register(CoverRequest)
class CoverRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'game', 'requested_by', 'replaced_by', 'request_type', 'status', 'created_at')
    list_filter = ('status', 'request_type', 'created_at')
    search_fields = ('game__home_team__club__name', 'requested_by__email', 'reason')
    date_hierarchy = 'created_at'
    raw_id_fields = ('game', 'requested_by', 'referee_slot', 'replaced_by', 'approver')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    
    fieldsets = (
        (None, {'fields': ('game', 'requested_by', 'request_type', 'referee_slot', 'replaced_by')}),
        ('Status', {'fields': ('status', 'approver', 'reason')}),
        ('Fee', {'fields': ('custom_fee',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )
