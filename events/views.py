from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import RefereeProfile
from notifications.services import notify_event_joined, notify_event_left

from .models import Event, EventRefereeAssignment
from .serializers import EventCreateUpdateSerializer, EventSerializer


def _get_referee_profile_or_none(user):
    try:
        return RefereeProfile.objects.get(user=user)
    except RefereeProfile.DoesNotExist:
        return None


def _can_manage_event(user, event: Event):
    return user.is_staff or event.created_by_id == user.id


def _get_event_upload_types_for_user(user):
    if not user.is_authenticated:
        return set()
    return set(user.get_allowed_upload_event_types())


class EventListAPIView(generics.ListAPIView):
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = (
            Event.objects.select_related("venue", "created_by")
            .prefetch_related("referee_assignments__referee__user")
            .all()
            .order_by("start_date", "end_date")
        )

        today = timezone.localdate()

        upcoming = self.request.query_params.get("upcoming", "true").lower()
        if upcoming == "true":
            queryset = queryset.filter(end_date__gte=today)

        venue_id = self.request.query_params.get("venue")
        if venue_id:
            queryset = queryset.filter(venue_id=venue_id)

        event_type = self.request.query_params.get("event_type")
        if event_type:
            queryset = queryset.filter(event_type=event_type)

        joined = self.request.query_params.get("joined")
        if joined and hasattr(self.request.user, "referee_profile"):
            referee_profile = self.request.user.referee_profile
            if joined.lower() == "true":
                queryset = queryset.filter(referee_assignments__referee=referee_profile)
            elif joined.lower() == "false":
                queryset = queryset.exclude(referee_assignments__referee=referee_profile)

        return queryset.distinct()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class EventDetailAPIView(generics.RetrieveAPIView):
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    queryset = (
        Event.objects.select_related("venue", "created_by")
        .prefetch_related("referee_assignments__referee__user")
        .all()
    )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class EventCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        allowed_event_types = _get_event_upload_types_for_user(request.user)
        if not allowed_event_types:
            return Response(
                {
                    "detail": (
                        "Your account cannot upload events. "
                        "Only approved Club, School, and College roles can upload events."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        requested_event_type = request.data.get("event_type")
        if requested_event_type:
            event_type = str(requested_event_type).upper()
            if event_type not in allowed_event_types:
                return Response(
                    {
                        "detail": (
                            "You can only upload events for your own role type."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            if request.user.account_type in allowed_event_types:
                event_type = request.user.account_type
            elif request.user.is_team_manager and request.user.manager_scope in allowed_event_types:
                event_type = request.user.manager_scope
            else:
                event_type = sorted(allowed_event_types)[0]

        payload = request.data.copy()
        if "event_type" in payload:
            payload.pop("event_type")

        serializer = EventCreateUpdateSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        event = serializer.save(created_by=request.user, event_type=event_type)

        response_serializer = EventSerializer(event, context={"request": request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class EventUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response(
                {"detail": "Event not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not _can_manage_event(request.user, event):
            return Response(
                {"detail": "You can only update events you created."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = EventCreateUpdateSerializer(event, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        event = (
            Event.objects.select_related("venue", "created_by")
            .prefetch_related("referee_assignments__referee__user")
            .get(pk=pk)
        )
        response_serializer = EventSerializer(event, context={"request": request})
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response(
                {"detail": "Event not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not _can_manage_event(request.user, event):
            return Response(
                {"detail": "You can only update events you created."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = EventCreateUpdateSerializer(event, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        event = (
            Event.objects.select_related("venue", "created_by")
            .prefetch_related("referee_assignments__referee__user")
            .get(pk=pk)
        )
        response_serializer = EventSerializer(event, context={"request": request})
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class EventDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response(
                {"detail": "Event not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not _can_manage_event(request.user, event):
            return Response(
                {"detail": "You can only delete events you created."},
                status=status.HTTP_403_FORBIDDEN,
            )

        event.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class JoinEventAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            referee_profile = RefereeProfile.objects.get(user=request.user)
        except RefereeProfile.DoesNotExist:
            return Response(
                {"detail": "Only referees can join events."},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            try:
                event = (
                    Event.objects.select_for_update()
                    .get(pk=pk)
                )
            except Event.DoesNotExist:
                return Response(
                    {"detail": "Event not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if EventRefereeAssignment.objects.filter(
                event=event,
                referee=referee_profile,
            ).exists():
                return Response(
                    {"detail": "You have already joined this event."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if (
                event.referees_required > 0
                and event.referee_assignments.count() >= event.referees_required
            ):
                return Response(
                    {"detail": "This event is already full."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            EventRefereeAssignment.objects.create(
                event=event,
                referee=referee_profile,
            )
            try:
                notify_event_joined(event, referee_user=request.user)
            except Exception:
                pass

        event = (
            Event.objects.select_related("venue", "created_by")
            .prefetch_related("referee_assignments__referee__user")
            .get(pk=pk)
        )
        serializer = EventSerializer(event, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class LeaveEventAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            referee_profile = RefereeProfile.objects.get(user=request.user)
        except RefereeProfile.DoesNotExist:
            return Response(
                {"detail": "Only referees can leave events."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            event = (
                Event.objects.select_related("venue", "created_by")
                .prefetch_related("referee_assignments__referee__user")
                .get(pk=pk)
            )
        except Event.DoesNotExist:
            return Response(
                {"detail": "Event not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        assignment = EventRefereeAssignment.objects.filter(
            event=event,
            referee=referee_profile,
        ).first()

        if not assignment:
            return Response(
                {"detail": "You are not assigned to this event."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment.delete()
        try:
            notify_event_left(event, referee_user=request.user)
        except Exception:
            pass

        event.refresh_from_db()
        serializer = EventSerializer(event, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)
