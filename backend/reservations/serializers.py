from rest_framework import serializers
from .models import Reservation, Salle, Equipement


class EquipementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipement
        fields = ['id', 'nom', 'icon']


class SalleSerializer(serializers.ModelSerializer):
    equipements = EquipementSerializer(many=True, read_only=True)

    class Meta:
        model = Salle
        fields = ['id', 'nom', 'capacite', 'description', 'equipements', 'necessite_priorite']


# Ce qu'une demande en attente d'autrui n'expose pas : seul son créneau reste public.
CHAMPS_CONFIDENTIELS = ('utilisateur', 'utilisateur_nom', 'utilisateur_email', 'utilisateur_ong', 'objet')


class ReservationSerializer(serializers.ModelSerializer):
    salle_nom = serializers.CharField(source='salle.nom', read_only=True)
    utilisateur_nom = serializers.CharField(source='utilisateur.nom', read_only=True)
    utilisateur_email = serializers.CharField(source='utilisateur.email', read_only=True)
    utilisateur_ong = serializers.CharField(source='utilisateur.ong.nom', read_only=True, default=None)

    def to_representation(self, instance):
        donnees = super().to_representation(instance)
        masque = self._doit_masquer(instance)
        if masque:
            for champ in CHAMPS_CONFIDENTIELS:
                donnees[champ] = None
        # Drapeau explicite : l'interface distingue ainsi un créneau masqué
        # d'une réservation simplement dépourvue d'objet.
        donnees['masque'] = masque
        return donnees

    def _doit_masquer(self, instance):
        if instance.statut != 'EN_ATTENTE':
            return False

        demandeur = getattr(self.context.get('request'), 'user', None)
        if demandeur is None or not demandeur.is_authenticated:
            return True  # par défaut on masque : mieux vaut taire que divulguer
        if demandeur.role == 'ADMIN' or instance.utilisateur_id == demandeur.pk:
            return False
        return True

    class Meta:
        model = Reservation
        fields = [
            'id', 'salle', 'salle_nom', 'utilisateur', 'utilisateur_nom', 'utilisateur_email',
            'utilisateur_ong',
            'date_heure_debut', 'date_heure_fin', 'objet', 'statut', 'date_creation',
        ]
        read_only_fields = ['id', 'utilisateur', 'statut', 'date_creation']