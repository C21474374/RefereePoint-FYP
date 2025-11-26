from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    GameViewSet,
    CoverRequestViewSet,
    EventViewSet,
)

router = DefaultRouter()

# Register your ViewSets
router.register(r'games', GameViewSet, basename='games')
router.register(r'cover_requests', CoverRequestViewSet, basename='cover_requests')
router.register(r'events', EventViewSet, basename='events')

urlpatterns = [
    path('', include(router.urls)),
]
