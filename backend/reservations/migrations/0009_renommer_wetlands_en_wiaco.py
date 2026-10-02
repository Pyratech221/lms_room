from django.db import migrations


def renommer(apps, schema_editor):
    """WETLANDS devient WIACO. Les reservations suivent : elles pointent sur l'ONG, pas sur son nom."""
    Ong = apps.get_model('reservations', 'Ong')
    Ong.objects.filter(nom='WETLANDS').update(nom='WIACO')


def revenir(apps, schema_editor):
    Ong = apps.get_model('reservations', 'Ong')
    Ong.objects.filter(nom='WIACO').update(nom='WETLANDS')


class Migration(migrations.Migration):

    dependencies = [('reservations', '0008_alter_salle_options_utilisateur_nom')]

    operations = [migrations.RunPython(renommer, revenir)]
