from rest_framework.routers import DefaultRouter
from api.views.event_views import EventViewSet

router = DefaultRouter()
router.register(r'', EventViewSet, basename='events')

urlpatterns = router.urls
