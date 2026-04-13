from django.contrib import admin
from .models import Club, Division, Team


@admin.register(Club)
class ClubAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(Division)
class DivisionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'name',
        'gender',
        'requires_appointed_referees',
        'is_active',
    )
    list_filter = ('gender', 'requires_appointed_referees', 'is_active')
    search_fields = ('name',)
    ordering = ('name', 'gender')


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('id', 'club', 'division', 'is_active')
    list_filter = ('division', 'club', 'is_active')
    search_fields = ('club__name', 'division__name')
    raw_id_fields = ('club', 'division')
