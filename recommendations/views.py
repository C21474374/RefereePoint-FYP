from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import RefereeProfile

from .engine import build_ranked_opportunities_for_user
from .serializers import RecommendedOpportunityFeedItemSerializer


class RecommendedOpportunityFeedAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = RefereeProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response(
                {"detail": "Only referee accounts can access opportunity recommendations."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ranked_items = build_ranked_opportunities_for_user(
            user=request.user,
            profile=profile,
            query_params=request.query_params,
        )
        serializer = RecommendedOpportunityFeedItemSerializer(ranked_items, many=True)
        return Response(
            {
                "recommended_count": min(5, len(ranked_items)),
                "items": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
