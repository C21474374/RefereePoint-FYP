from django.conf import settings
from django.contrib.auth import get_user_model, login


class DevAutoLoginMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if settings.DEBUG and not request.user.is_authenticated:
            User = get_user_model()
            test_user = User.objects.filter(email="testreferee1@gmail.com").first()

            if test_user:
                test_user.backend = "django.contrib.auth.backends.ModelBackend"
                login(request, test_user)

        response = self.get_response(request)
        return response