import secrets

from django.db import migrations, models


def remplir_code(apps, schema_editor):
    """Donne un code aux liens deja en base.

    Sans cela ils porteraient un code vide, que la verification accepterait pour peu
    qu'on lui envoie une chaine vide.
    """
    MagicLinkToken = apps.get_model('reservations', 'MagicLinkToken')
    for jeton in MagicLinkToken.objects.filter(code=''):
        jeton.code = f'{secrets.randbelow(1_000_000):06d}'
        jeton.save(update_fields=['code'])


class Migration(migrations.Migration):

    dependencies = [
        ('reservations', '0010_magiclinktoken_suivi'),
    ]

    operations = [
        migrations.AddField(
            model_name='magiclinktoken',
            name='code',
            field=models.CharField(default='', max_length=6),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='magiclinktoken',
            name='essais',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.RunPython(remplir_code, migrations.RunPython.noop),
    ]
