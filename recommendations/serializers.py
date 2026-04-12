from rest_framework import serializers

from games.serializers import OpportunityFeedItemSerializer


class RecommendedOpportunityFeedItemSerializer(OpportunityFeedItemSerializer):
    recommendation_score = serializers.FloatField()
    recommendation_reasons = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    is_recommended = serializers.BooleanField(default=False)

