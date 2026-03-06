from django.contrib import admin
from .models import Club, Division, Team


@admin.register(Club)
class ClubAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(Division)
class DivisionAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'gender')
    list_filter = ('gender',)
    search_fields = ('name',)
    ordering = ('name', 'gender')


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('id', 'club', 'division')
    list_filter = ('division', 'club')
    search_fields = ('club__name', 'division__name')
    raw_id_fields = ('club', 'division')
