from django.urls import path

from .views import RecommendedOpportunityFeedAPIView

urlpatterns = [
    path(
        "opportunities/",
        RecommendedOpportunityFeedAPIView.as_view(),
        name="recommended-opportunity-feed",
    ),
]

