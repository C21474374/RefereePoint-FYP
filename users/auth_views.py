from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class ApprovalAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Blocks token login for accounts pending manual approval.
    """

    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user
        if user and not user.is_staff and not user.is_superuser:
            if not user.doa_approved:
                raise AuthenticationFailed(
                    "Your account is pending admin approval. Please wait until approval is completed."
                )

        return data


class ApprovalAwareTokenObtainPairView(TokenObtainPairView):
    serializer_class = ApprovalAwareTokenObtainPairSerializer
