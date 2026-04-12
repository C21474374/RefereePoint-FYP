from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UserNotification
from .serializers import UserNotificationSerializer
from .services import ensure_referee_daily_reminders_for_user


def _parse_limit(raw_limit, default_value: int, max_value: int):
    if raw_limit in (None, "", "null"):
        return default_value

    try:
        value = int(raw_limit)
    except (TypeError, ValueError):
        return default_value

    if value <= 0:
        return default_value

    return min(value, max_value)


class NotificationListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ensure_referee_daily_reminders_for_user(request.user)

        limit = _parse_limit(request.query_params.get("limit"), 120, 300)
        queryset = UserNotification.objects.select_related("actor").filter(
            recipient=request.user
        )
        unread_count = queryset.filter(is_read=False).count()

        serializer = UserNotificationSerializer(queryset[:limit], many=True)
        return Response(
            {
                "items": serializer.data,
                "unread_count": unread_count,
            },
            status=status.HTTP_200_OK,
        )


class RecentNotificationListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ensure_referee_daily_reminders_for_user(request.user)

        limit = _parse_limit(request.query_params.get("limit"), 5, 20)
        queryset = UserNotification.objects.select_related("actor").filter(
            recipient=request.user
        )
        unread_count = queryset.filter(is_read=False).count()

        serializer = UserNotificationSerializer(queryset[:limit], many=True)
        return Response(
            {
                "items": serializer.data,
                "unread_count": unread_count,
            },
            status=status.HTTP_200_OK,
        )


class MarkAllNotificationsReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        updated_count = UserNotification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).update(
            is_read=True,
            read_at=now,
        )
        return Response({"updated": updated_count}, status=status.HTTP_200_OK)


class MarkNotificationReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = UserNotification.objects.get(pk=pk, recipient=request.user)
        except UserNotification.DoesNotExist:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["is_read", "read_at"])

        serializer = UserNotificationSerializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)
