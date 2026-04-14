from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from games.models import RefereeAssignment
from games.serializers import GameSerializer
from users.models import RefereeProfile
from users.access import has_admin_approval_scope, has_referee_role
from notifications.services import (
    notify_cover_request_approved,
    notify_cover_request_claimed,
    notify_cover_request_created_for_admins,
    notify_cover_request_withdrawn,
)

from .models import CoverRequest
from .serializers import CoverRequestSerializer, CoverRequestCreateSerializer


def _expire_stale_cover_requests():
    """
    Auto-close active cover requests once the game date has passed.
    This keeps opportunity feeds clean without requiring a background worker.
    """
    today = timezone.localdate()
    CoverRequest.objects.filter(
        status__in=[CoverRequest.Status.PENDING, CoverRequest.Status.CLAIMED],
        game__date__lt=today,
    ).update(
        status=CoverRequest.Status.REJECTED,
        replaced_by=None,
        updated_at=timezone.now(),
    )


def _referee_role_required_response():
    return Response(
        {"detail": "Only referee-role accounts can access cover request pages."},
        status=status.HTTP_403_FORBIDDEN,
    )


class CoverRequestListAPIView(generics.ListAPIView):
    serializer_class = CoverRequestSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        if not has_referee_role(request.user) and not has_admin_approval_scope(request.user):
            return _referee_role_required_response()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        _expire_stale_cover_requests()
        queryset = (
            CoverRequest.objects.select_related(
                "game",
                "game__venue",
                "game__division",
                "game__home_team__club",
                "game__away_team__club",
                "requested_by",
                "approver",
                "original_referee",
                "original_referee__user",
                "replaced_by",
                "replaced_by__user",
                "referee_slot",
                "referee_slot__referee",
                "referee_slot__referee__user",
            )
            .all()
            .order_by("-created_at")
        )

        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)

        return queryset


class CoverRequestDetailAPIView(generics.RetrieveAPIView):
    queryset = (
        CoverRequest.objects.select_related(
            "game",
            "game__venue",
            "game__division",
            "game__home_team__club",
            "game__away_team__club",
            "requested_by",
            "approver",
            "original_referee",
            "original_referee__user",
            "replaced_by",
            "replaced_by__user",
            "referee_slot",
            "referee_slot__referee",
            "referee_slot__referee__user",
        )
        .all()
    )
    serializer_class = CoverRequestSerializer
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        if not has_referee_role(request.user) and not has_admin_approval_scope(request.user):
            return _referee_role_required_response()
        return super().retrieve(request, *args, **kwargs)


class MyCoverRequestListAPIView(generics.ListAPIView):
    serializer_class = CoverRequestSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        if not has_referee_role(request.user):
            return _referee_role_required_response()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        _expire_stale_cover_requests()
        return (
            CoverRequest.objects.select_related(
                "game",
                "game__venue",
                "game__division",
                "game__home_team__club",
                "game__away_team__club",
                "requested_by",
                "approver",
                "original_referee",
                "original_referee__user",
                "replaced_by",
                "replaced_by__user",
                "referee_slot",
                "referee_slot__referee",
                "referee_slot__referee__user",
            )
            .filter(
                Q(requested_by=self.request.user) |
                Q(replaced_by__user=self.request.user)
            )
            .order_by("-created_at")
        )


class PendingCoverRequestListAPIView(generics.ListAPIView):
    serializer_class = CoverRequestSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        if not has_referee_role(request.user):
            return _referee_role_required_response()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        _expire_stale_cover_requests()
        today = timezone.localdate()
        return (
            CoverRequest.objects.select_related(
                "game",
                "game__venue",
                "game__division",
                "game__home_team__club",
                "game__away_team__club",
                "requested_by",
                "approver",
                "original_referee",
                "original_referee__user",
                "replaced_by",
                "replaced_by__user",
                "referee_slot",
                "referee_slot__referee",
                "referee_slot__referee__user",
            )
            .filter(
                status=CoverRequest.Status.PENDING,
                game__date__gte=today,
            )
            .exclude(requested_by=self.request.user)
            .order_by("-created_at")
        )


class CreateCoverRequestAPIView(generics.CreateAPIView):
    serializer_class = CoverRequestCreateSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if not has_referee_role(request.user):
            return _referee_role_required_response()
        return super().create(request, *args, **kwargs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        cover_request = serializer.save()
        try:
            notify_cover_request_created_for_admins(
                cover_request,
                actor_user=self.request.user,
            )
        except Exception:
            # Notifications should not block successful cover-request creation.
            pass


class CancelCoverRequestAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if not has_referee_role(request.user):
            return _referee_role_required_response()

        try:
            cover_request = CoverRequest.objects.select_related(
                "requested_by",
            ).get(pk=pk)
        except CoverRequest.DoesNotExist:
            return Response(
                {"detail": "Cover request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if cover_request.requested_by_id != request.user.id:
            return Response(
                {"detail": "You can only cancel your own cover requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if cover_request.status != CoverRequest.Status.PENDING:
            return Response(
                {"detail": "Only pending cover requests can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cover_request.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OfferCoverAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not has_referee_role(request.user):
            return _referee_role_required_response()

        try:
            cover_request = CoverRequest.objects.select_related(
                "game",
                "requested_by",
                "original_referee",
                "original_referee__user",
                "referee_slot",
                "referee_slot__referee",
                "referee_slot__referee__user",
                "replaced_by",
                "replaced_by__user",
            ).get(pk=pk)
        except CoverRequest.DoesNotExist:
            return Response(
                {"detail": "Cover request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if cover_request.status != CoverRequest.Status.PENDING:
            return Response(
                {"detail": "This cover request is no longer open for claims."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cover_request.game.date < timezone.localdate():
            cover_request.status = CoverRequest.Status.REJECTED
            cover_request.replaced_by = None
            cover_request.save(update_fields=["status", "replaced_by", "updated_at"])
            return Response(
                {"detail": "This game date has passed, so the cover request is closed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cover_request.requested_by == request.user:
            return Response(
                {"detail": "You cannot cover your own request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            referee = RefereeProfile.objects.select_related("user").get(user=request.user)
        except RefereeProfile.DoesNotExist:
            return Response(
                {"detail": "Only referees can claim cover requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        original_referee = cover_request.original_referee or cover_request.referee_slot.referee

        if referee.id == original_referee.id:
            return Response(
                {"detail": "You cannot cover your own assignment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            cover_request.referee_slot.role == "CREW_CHIEF"
            and referee.grade == "INTRO"
        ):
            return Response(
                {"detail": "Intro referees cannot cover Crew Chief."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if cover_request.replaced_by is not None:
            return Response(
                {"detail": "Another referee has already claimed this game."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cover_request.replaced_by = referee
        cover_request.status = CoverRequest.Status.CLAIMED
        cover_request.save()
        try:
            notify_cover_request_claimed(cover_request, actor_user=request.user)
        except Exception:
            pass

        serializer = CoverRequestSerializer(cover_request)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WithdrawCoverClaimAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not has_referee_role(request.user):
            return _referee_role_required_response()

        try:
            cover_request = CoverRequest.objects.select_related(
                "replaced_by",
                "replaced_by__user",
            ).get(pk=pk)
        except CoverRequest.DoesNotExist:
            return Response(
                {"detail": "Cover request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if cover_request.status == CoverRequest.Status.APPROVED:
            return Response(
                {"detail": "Approved cover requests cannot be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cover_request.status != CoverRequest.Status.CLAIMED:
            return Response(
                {"detail": "Only claimed cover requests can be cancelled by the replacement referee."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not cover_request.replaced_by or cover_request.replaced_by.user_id != request.user.id:
            return Response(
                {"detail": "You can only cancel a claim that you made."},
                status=status.HTTP_403_FORBIDDEN,
            )

        cover_request.replaced_by = None
        cover_request.status = CoverRequest.Status.PENDING
        cover_request.save()
        try:
            notify_cover_request_withdrawn(cover_request, actor_user=request.user)
        except Exception:
            pass

        serializer = CoverRequestSerializer(cover_request)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MyUpcomingAssignmentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not has_referee_role(request.user):
            return _referee_role_required_response()

        try:
            referee_profile = RefereeProfile.objects.get(user=request.user)
        except RefereeProfile.DoesNotExist:
            return Response(
                {"detail": "Only referees can view assigned games."},
                status=status.HTTP_403_FORBIDDEN,
            )

        today = timezone.localdate()

        assignments = (
            RefereeAssignment.objects.select_related(
                "game",
                "game__venue",
                "game__division",
                "game__home_team__club",
                "game__away_team__club",
                "referee",
                "referee__user",
            )
            .filter(
                referee=referee_profile,
                game__date__gte=today,
            )
            .order_by("game__date", "game__time")
        )

        results = []

        for assignment in assignments:
            has_active_cover_request = assignment.cover_requests.filter(
                status__in=[
                    CoverRequest.Status.PENDING,
                    CoverRequest.Status.CLAIMED,
                ]
            ).exists()

            results.append(
                {
                    "assignment_id": assignment.id,
                    "role": assignment.role,
                    "role_display": assignment.get_role_display(),
                    "game_id": assignment.game.id,
                    "game_details": GameSerializer(assignment.game).data,
                    "has_active_cover_request": has_active_cover_request,
                }
            )

        return Response(results, status=status.HTTP_200_OK)


class ApproveCoverRequestAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            cover_request = CoverRequest.objects.select_related(
                "game",
                "requested_by",
                "original_referee",
                "original_referee__user",
                "referee_slot",
                "referee_slot__referee",
                "referee_slot__referee__user",
                "replaced_by",
                "replaced_by__user",
            ).get(pk=pk)
        except CoverRequest.DoesNotExist:
            return Response(
                {"detail": "Cover request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if cover_request.status == CoverRequest.Status.APPROVED:
            return Response(
                {"detail": "This request is already approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cover_request.status != CoverRequest.Status.CLAIMED:
            return Response(
                {"detail": "This cover request is not waiting for approval."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cover_request.replaced_by is None:
            return Response(
                {"detail": "There is no replacement referee to approve."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (request.user.is_staff or has_admin_approval_scope(request.user)):
            return Response(
                {"detail": "Only admins can approve cover requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        referee_assignment = cover_request.referee_slot
        replacement_referee = cover_request.replaced_by

        if (
            referee_assignment.role == "CREW_CHIEF"
            and replacement_referee.grade == "INTRO"
        ):
            return Response(
                {"detail": "Intro referees cannot cover Crew Chief."},
                status=status.HTTP_403_FORBIDDEN,
            )

        referee_assignment.referee = replacement_referee
        referee_assignment.save()

        cover_request.approver = request.user
        cover_request.status = CoverRequest.Status.APPROVED
        cover_request.save()
        try:
            notify_cover_request_approved(cover_request, actor_user=request.user)
        except Exception:
            pass

        serializer = CoverRequestSerializer(cover_request)
        return Response(serializer.data, status=status.HTTP_200_OK)
