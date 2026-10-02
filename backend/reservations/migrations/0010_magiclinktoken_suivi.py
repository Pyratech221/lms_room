import secrets

from django.db import migrations, models


def remplir_suivi(apps, schema_editor):
    """Donne un identifiant de suivi aux liens deja en base.

    Ils expirent en 15 minutes, mais les supprimer deconnecterait quelqu'un en train
    de se connecter au moment du deploiement.
    """
    MagicLinkToken = apps.get_model('reservations', 'MagicLinkToken')
    for jeton in MagicLinkToken.objects.filter(suivi=''):
        jeton.suivi = secrets.token_urlsafe(24)
        jeton.save(update_fields=['suivi'])


class Migration(migrations.Migration):

    dependencies = [
        ('reservations', '0009_renommer_wetlands_en_wiaco'),
    ]

    operations = [
        migrations.AddField(
            model_name='magiclinktoken',
            name='suivi',
            field=models.CharField(default='', max_length=64),
            preserve_default=False,
        ),
        migrations.RunPython(remplir_suivi, migrations.RunPython.noop),
        # L'unicité pose déjà son propre index. Ajouter le champ avec db_index=True puis
        # passer à unique=True ferait créer deux fois le même index sous PostgreSQL.
        migrations.AlterField(
            model_name='magiclinktoken',
            name='suivi',
            field=models.CharField(max_length=64, unique=True),
        ),
    ]
