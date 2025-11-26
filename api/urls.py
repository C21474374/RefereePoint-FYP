from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameViewSet, UserViewSet

router = DefaultRouter()
router.register(r'games', GameViewSet)
router.register(r'users', UserViewSet)

urlpatterns = [
    path('', include(router.urls))
]
