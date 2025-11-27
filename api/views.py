# from rest_framework import viewsets, status
# from rest_framework.decorators import action
# from rest_framework.response import Response
# from django.db import models
# from django.utils.timezone import now

# from games.models import Game, CoverRequest, Event
# from users.models import RefereeProfile
# from .serializers import GameSerializer, CoverRequestSerializer, EventSerializer








# # COVER REQUEST VIEWSET 
# class CoverRequestViewSet(viewsets.ModelViewSet):
#     queryset = CoverRequest.objects.all().order_by('-created_at')
#     serializer_class = CoverRequestSerializer

#     @action(detail=True, methods=['post'])
#     def accept(self, request, pk=None):
#         cover = self.get_object()
#         new_referee_id = request.data.get('referee_id')

#         if cover.status != 'pending':
#             return Response({"error": "This cover request is not pending."}, status=400)

#         try:
#             new_ref = RefereeProfile.objects.get(id=new_referee_id)
#         except RefereeProfile.DoesNotExist:
#             return Response({"error": "Referee not found"}, status=404)

#         game = cover.game

#         # Replace correct slot
#         if cover.referee == game.crew_chief:
#             game.crew_chief = new_ref
#         elif cover.referee == game.umpire1:
#             game.umpire1 = new_ref
#         elif cover.referee == game.umpire2:
#             game.umpire2 = new_ref
#         else:
#             return Response({"error": "Referee is not assigned to this game."}, status=400)

#         # Save updates
#         game.save()
#         cover.status = 'accepted'
#         cover.accepted_by = new_ref
#         cover.save()

#         return Response({
#             "message": "Cover request accepted.",
#             "updated_game": GameSerializer(game).data,
#             "cover_request": CoverRequestSerializer(cover).data
#         })
