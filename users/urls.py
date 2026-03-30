from django.urls import path
from . import views

urlpatterns = [
    path('referees/', views.list_referees, name='list_referees'),
    path('referees/<int:referee_id>/', views.referee_detail, name='referee_detail'),
    path('register/', views.RegisterUserView.as_view(), name='register-user'),
    path('me/', views.CurrentUserView.as_view(), name='current_user'),
    path('me/home/', views.UpdateHomeLocationView.as_view(), name='update_home_location'),
    path('approvals/pending/', views.PendingAccountApprovalsView.as_view(), name='pending-account-approvals'),
    path('approvals/<int:user_id>/', views.ApproveAccountView.as_view(), name='approve-account'),
    path('', views.list_users, name='list_users'),
]
