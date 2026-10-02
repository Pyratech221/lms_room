from django.db import migrations


class Migration(migrations.Migration):
    """Le lien magique disparait : il ne reste que le code a six chiffres.

    Le jeton de lien n'a plus d'emploi, et le modele porte desormais le nom de ce
    qu'il contient. Les demandes en cours expirent en quinze minutes, leur perte de
    jeton est sans consequence.
    """

    dependencies = [
        ('reservations', '0011_magiclinktoken_code'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='magiclinktoken',
            name='token',
        ),
        migrations.RenameModel(
            old_name='MagicLinkToken',
            new_name='CodeConnexion',
        ),
    ]
