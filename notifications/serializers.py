from rest_framework import serializers

from .models import UserNotification


class UserNotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(
        source="get_notification_type_display",
        read_only=True,
    )
    actor_name = serializers.SerializerMethodField()

    def get_actor_name(self, obj: UserNotification):
        if not obj.actor:
            return None
        full_name = obj.actor.get_full_name().strip()
        return full_name or obj.actor.email

    class Meta:
        model = UserNotification
        fields = [
            "id",
            "notification_type",
            "notification_type_display",
            "title",
            "message",
            "link_path",
            "metadata",
            "is_read",
            "created_at",
            "read_at",
            "actor_name",
        ]
