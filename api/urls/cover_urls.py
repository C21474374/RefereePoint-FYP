from rest_framework.routers import DefaultRouter
from api.views.cover_views import CoverRequestViewSet

router = DefaultRouter()
router.register(r'', CoverRequestViewSet, basename='cover_requests')

urlpatterns = router.urls
