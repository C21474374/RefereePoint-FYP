from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import RefereeProfile, User

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_referee_profile(sender, instance, created, **kwargs):
    if not created:
        return

    if instance.account_type != User.AccountType.REFEREE:
        return

    RefereeProfile.objects.get_or_create(user=instance)
