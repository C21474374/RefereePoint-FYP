from django.urls import path

from .views import (
    MarkAllNotificationsReadAPIView,
    MarkNotificationReadAPIView,
    NotificationListAPIView,
    RecentNotificationListAPIView,
)


urlpatterns = [
    path("", NotificationListAPIView.as_view(), name="notification-list"),
    path("recent/", RecentNotificationListAPIView.as_view(), name="notification-recent"),
    path("mark-all-read/", MarkAllNotificationsReadAPIView.as_view(), name="notification-mark-all-read"),
    path("<int:pk>/read/", MarkNotificationReadAPIView.as_view(), name="notification-mark-read"),
]
