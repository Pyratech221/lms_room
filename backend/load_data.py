import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from reservations.models import Salle, Equipement

# Créer les équipements
equipements_data = [
    {'nom': 'Écran de projection', 'icon': '🎬'},
    {'nom': 'Caméra d\'appel', 'icon': '📹'},
    {'nom': 'Tableau à rouleau papier', 'icon': '📋'},
    {'nom': 'Baffle audio', 'icon': '🔊'},
    {'nom': 'WiFi haute vitesse', 'icon': '📡'},
    {'nom': 'Climatisation', 'icon': '❄️'},
]

equipements = {}
for eq_data in equipements_data:
    eq, created = Equipement.objects.get_or_create(**eq_data)
    equipements[eq_data['nom']] = eq
    if created:
        print(f"Created: {eq_data['nom']}")
    else:
        print(f"Already exists: {eq_data['nom']}")

# Mettre à jour les salles avec leurs équipements
salles_data = [
    {
        'nom': 'Salle 1',
        'capacite': 21,
        'description': 'Grande salle de réunion',
        'equipements': ['Écran de projection', 'Caméra d\'appel', 'Tableau à rouleau papier']
    },
    {
        'nom': 'Salle 2',
        'capacite': 9,
        'description': 'Salle de réunion moyenne',
        'equipements': ['Écran de projection', 'Caméra d\'appel', 'Baffle audio']
    },
    {
        'nom': 'Salle 3',
        'capacite': 4,
        'description': 'Petite salle de réunion',
        'equipements': []
    },
    {
        'nom': 'Salle 4',
        'capacite': 5,
        'description': 'Salle de réunion compacte',
        'equipements': ['Écran de projection']
    },
]

for salle_data in salles_data:
    equipements_list = salle_data.pop('equipements')
    salle, created = Salle.objects.get_or_create(nom=salle_data['nom'], defaults=salle_data)
    
    if created:
        print(f"\nCreated: {salle_data['nom']} ({salle_data['capacite']} places)")
    else:
        print(f"\nUpdating: {salle_data['nom']}")
        # Mettre à jour les infos
        salle.capacite = salle_data['capacite']
        salle.description = salle_data['description']
        salle.save()
    
    # Ajouter les équipements
    salle.equipements.clear()
    for eq_name in equipements_list:
        salle.equipements.add(equipements[eq_name])
    print(f"  Equipment: {', '.join(equipements_list) if equipements_list else 'None'}")

print("\nData loaded successfully!")

