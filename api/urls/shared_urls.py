from rest_framework.routers import DefaultRouter
from api.views.shared_views import (
    TeamViewSet,
    GameCategoryViewSet,
    CompetitionViewSet,
    RefereeProfileViewSet
)

router = DefaultRouter()

router.register("teams", TeamViewSet, basename="teams")
router.register("game_categories", GameCategoryViewSet, basename="game_categories")
router.register("competitions", CompetitionViewSet, basename="competitions")
router.register("referees", RefereeProfileViewSet, basename="referees")
urlpatterns = router.urls
