# Chatgpt Prompts used to assist the creation of this file:
# Prompt1: Create Django viewsets for managing events and referee participation.
# Prompt2: Implement logic to allow referees to join and leave events with conflict checks and waitlisting.


from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from django.db import models
from django.utils.timezone import now

from games.models import Event, EventParticipation, Game     # <-- IMPORTANT
from users.models import RefereeProfile

from api.serializers.event_serializers import EventSerializer
from api.serializers.event_participation_serializers import EventParticipationSerializer





class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all().order_by("start_date")
    serializer_class = EventSerializer

    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        event = self.get_object()
        referee_id = request.data.get("referee_id")

        if not referee_id:
            return Response({"error": "referee_id is required"}, status=400)

        # Validate referee
        try:
            referee = RefereeProfile.objects.get(id=referee_id)
        except RefereeProfile.DoesNotExist:
            return Response({"error": "Referee not found"}, status=404)

        # -------------------------
        # RULE 1: Prevent game conflicts
        # -------------------------
        event_start = event.start_date
        event_end = event.end_date

        game_conflict = Game.objects.filter(
            models.Q(crew_chief=referee) |
            models.Q(umpire1=referee) |
            models.Q(umpire2=referee),
            date__range=[event_start, event_end]
        ).exists()

        if game_conflict:
            return Response(
                {"error": "You have a game during this event."},
                status=400
            )

        # -------------------------
        # RULE 2: Prevent event time conflicts
        # -------------------------
        overlap = EventParticipation.objects.filter(
            referee=referee,
            event__start_date__lte=event.end_date,
            event__end_date__gte=event.start_date,
            status="confirmed"
        ).exists()

        if overlap:
            return Response(
                {"error": "You are already in another event at this time."},
                status=400
            )

        # -------------------------
        # RULE 3: Determine if event is full
        # -------------------------
        confirmed_count = event.participants.filter(status="confirmed").count()
        max_required = event.referees_required

        # If full → add to waitlist
        if confirmed_count >= max_required:
            participation, created = EventParticipation.objects.get_or_create(
                event=event,
                referee=referee,
                defaults={"status": "waitlist"}
            )

            if not created:
                return Response({"error": "Already joined this event"}, status=400)

            return Response(
                {"message": "Event is full — you have been added to the waitlist."},
                status=201
            )

        # -------------------------
        # SPOT AVAILABLE → CONFIRM
        # -------------------------
        participation, created = EventParticipation.objects.get_or_create(
            event=event,
            referee=referee,
            defaults={"status": "confirmed"}
        )

        if not created:
            return Response({"error": "Already joined this event"}, status=400)

        return Response(
            {"message": "Successfully joined event as confirmed participant."},
            status=201
        )

    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        event = self.get_object()
        referee_id = request.data.get("referee_id")

        if not referee_id:
            return Response({"error": "referee_id is required"}, status=400)

        try:
            participation = EventParticipation.objects.get(event=event, referee_id=referee_id)
        except EventParticipation.DoesNotExist:
            return Response({"error": "You are not in this event"}, status=404)

        was_confirmed = participation.status == "confirmed"

        participation.delete()

        # If the leaving referee was confirmed → replace with first waitlist entry
        if was_confirmed:
            next_waitlisted = event.participants.filter(status="waitlist").order_by("joined_at").first()

            if next_waitlisted:
                next_waitlisted.status = "confirmed"
                next_waitlisted.save()

                return Response({
                    "message": "You left the event. A waitlisted referee was promoted."
                })

        return Response({"message": "You left the event."})


    @action(detail=True, methods=["get"])
    def participants(self, request, pk=None):
        event = self.get_object()
        participations = event.participants.all()  # via related_name
        return Response(
            EventParticipationSerializer(participations, many=True).data
        )

