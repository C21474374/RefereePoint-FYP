from django.db import migrations


def remove_non_referee_profiles(apps, schema_editor):
    RefereeProfile = apps.get_model("users", "RefereeProfile")
    RefereeProfile.objects.exclude(user__account_type="REFEREE").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0012_user_verification_id_photo"),
    ]

    operations = [
        migrations.RunPython(remove_non_referee_profiles, migrations.RunPython.noop),
    ]

