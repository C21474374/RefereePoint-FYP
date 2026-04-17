from django.urls import path

from .views import (
    RefereeEarningsAPIView,
    AdminMonthlyEarningsAPIView,
    ConfirmAdminMonthlyPaymentAPIView,
)


urlpatterns = [
    path("earnings/", RefereeEarningsAPIView.as_view(), name="referee-earnings"),
    path("admin/earnings/", AdminMonthlyEarningsAPIView.as_view(), name="admin-earnings"),
    path(
        "admin/earnings/confirm/",
        ConfirmAdminMonthlyPaymentAPIView.as_view(),
        name="admin-earnings-confirm",
    ),
]
