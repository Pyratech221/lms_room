import logging
import secrets

from django.shortcuts import render

# Create your views here.
from django.contrib.auth import login, logout
from django.conf import settings
from django.middleware.csrf import get_token
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from .models import CodeConnexion, Utilisateur, Ong
from .ms_graph_mail import envoyer_email, ErreurEnvoiEmail
from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from django.db import IntegrityError
from django.db.models import Q
from .models import Reservation, Salle
from .serializers import ReservationSerializer, SalleSerializer
from rest_framework.exceptions import PermissionDenied, NotFound

logger = logging.getLogger(__name__)


# Calendrier de priorité — jour de la semaine (0=lundi ... 6=dimanche) → nom de l'ONG prioritaire
PRIORITE_SALLE_1 = {
    0: 'RAMPAO',     # lundi
    1: 'WIACO',      # mardi
    2: 'BirdLife',   # mercredi
    3: 'PRCM',       # jeudi
}

def determiner_statut_initial(salle, utilisateur, date_heure_debut):
    """Statut d'une réservation à sa création.

    Salle soumise à priorité (Salle 1) :
      - vendredi : aucune ONG n'est prioritaire, la réservation est validée ;
      - ONG prioritaire du jour : validée ;
      - tout autre cas : mise en attente de la validation d'un administrateur.
    """
    if not salle.necessite_priorite:
        return 'VALIDE'

    jour_semaine = date_heure_debut.weekday()

    if jour_semaine == 4:  # vendredi
        return 'VALIDE'

    ong_prioritaire = PRIORITE_SALLE_1.get(jour_semaine)
    ong_demandeur = utilisateur.ong.nom if utilisateur.ong else None

    # `ong_prioritaire` est None le week-end : sans ce garde-fou, un utilisateur
    # sans ONG (None == None) serait validé automatiquement ces jours-là.
    if ong_prioritaire is not None and ong_demandeur == ong_prioritaire:
        return 'VALIDE'

    return 'EN_ATTENTE'


class JetonCsrf(APIView):
    """Expose le jeton CSRF pour un frontend hébergé sur un autre domaine.

    Dans ce cas le cookie csrftoken appartient au domaine du backend et reste
    illisible par le JavaScript du frontend : il doit donc lui être transmis
    explicitement pour être renvoyé dans l'en-tête X-CSRFToken.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({'csrf_token': get_token(request)})


def _acces_autorise(email):
    """Qui a le droit de demander un code ?

    Les quatre ONG partenaires, par leur domaine de messagerie. Et les comptes déjà
    enregistrés : les administrateurs et les personnes inscrites par un administrateur
    n'ont pas forcément une adresse à ce domaine, et doivent continuer à entrer.

    Une adresse inconnue à un domaine inconnu ne crée donc plus de compte toute seule.
    """
    if Utilisateur.objects.filter(email=email).exists():
        return True
    return Ong.objects.filter(domaine_email=email.split('@')[-1]).exists()


class DemandeCodeConnexion(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email or '@' not in email:
            return Response({'detail': 'Email invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        if not _acces_autorise(email):
            # Message explicite plutôt qu'une réponse évasive : l'application sert quatre
            # organisations connues, et laisser quelqu'un attendre un code qui n'arrivera
            # jamais coûte plus que cela ne protège.
            return Response(
                {'detail': "Cette adresse n'appartient à aucune des ONG partenaires. "
                           "Demandez à un administrateur de vous inscrire."},
                status=status.HTTP_403_FORBIDDEN,
            )

        demande = CodeConnexion.generer(email)

        try:
            envoyer_email(
                destinataire=email,
                sujet="Votre code de connexion — La Maison de la Conservation",
                corps_texte=(
                    "Saisissez ce code dans la fenêtre où vous avez demandé à vous "
                    "connecter (valable 15 minutes) :\n\n"
                    f"    {demande.code}\n\n"
                    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n"
                ),
            )
        except ErreurEnvoiEmail:
            logger.exception("Échec de l'envoi du code de connexion à %s", email)

        # « suivi » ne permet pas de se connecter : il identifie la demande pour que la
        # vérification ne repose pas sur six chiffres seuls.
        return Response({
            'detail': 'Un code de connexion vous a été envoyé.',
            'suivi': demande.suivi,
        })


def _ouvrir_session(request, demande):
    """Consomme une demande validée et ouvre la session."""
    utilisateur, _ = Utilisateur.objects.get_or_create(
        email=demande.email,
        defaults={'ong': Ong.objects.filter(domaine_email=demande.email.split('@')[-1]).first()},
    )

    demande.marquer_utilise()
    login(request, utilisateur, backend='django.contrib.auth.backends.ModelBackend')

    return Response({
        'email': utilisateur.email,
        'ong': utilisateur.ong.nom if utilisateur.ong else None,
        'role': utilisateur.role,
    })


class VerifierCodeConnexion(APIView):
    """Connexion par le code reçu dans le mail, sans quitter la fenêtre en cours.

    Six chiffres se devinent en un million d'essais. C'est pourquoi la vérification
    exige aussi l'identifiant de suivi — connu de la seule fenêtre qui a fait la
    demande — et que chaque demande s'éteint au bout de CodeConnexion.ESSAIS_MAX
    codes faux.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        suivi = (request.data.get('suivi') or '').strip()
        code = (request.data.get('code') or '').strip()

        if not suivi or not code:
            return Response({'detail': 'Code manquant.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            demande = CodeConnexion.objects.get(suivi=suivi)
        except CodeConnexion.DoesNotExist:
            return Response({'detail': 'Demande inconnue.'}, status=status.HTTP_400_BAD_REQUEST)

        if not demande.est_valide():
            return Response(
                {'detail': 'Ce code a expiré ou a déjà été utilisé. Redemandez-en un.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not secrets.compare_digest(code, demande.code):
            demande.enregistrer_echec()
            restants = demande.ESSAIS_MAX - demande.essais
            if restants <= 0:
                return Response(
                    {'detail': 'Trop de codes erronés. Redemandez un code de connexion.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {'detail': f'Code incorrect. Il vous reste {restants} essai(s).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return _ouvrir_session(request, demande)


class Deconnexion(APIView):
    """Ferme réellement la session côté serveur (le simple retour vers /login ne suffit pas)."""

    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response({'detail': 'Déconnecté.'})


def notifier_demande_en_attente(reservation):
    """Prévient les administrateurs qu'une réservation attend leur validation.

    Un échec d'envoi ne doit jamais faire échouer la création de la réservation :
    l'erreur est journalisée et la demande reste consultable dans l'application.
    """
    destinataires = list(
        Utilisateur.objects.filter(role='ADMIN', is_active=True)
        .exclude(email='')
        .values_list('email', flat=True)
    )
    if not destinataires:
        logger.warning(
            "Réservation %s en attente mais aucun administrateur à notifier.", reservation.pk
        )
        return

    ong = reservation.utilisateur.ong.nom if reservation.utilisateur.ong else 'sans ONG'
    debut = timezone.localtime(reservation.date_heure_debut)
    fin = timezone.localtime(reservation.date_heure_fin)

    corps = (
        "Une demande de réservation attend votre validation.\n\n"
        f"Salle     : {reservation.salle.nom}\n"
        f"Date      : {debut:%d/%m/%Y} de {debut:%H:%M} à {fin:%H:%M}\n"
        f"Demandeur : {reservation.utilisateur.email} ({ong})\n"
        f"Objet     : {reservation.objet or 'non précisé'}\n\n"
        f"Valider ou refuser la demande : {settings.FRONTEND_URL}/accueil"
    )

    for email in destinataires:
        try:
            envoyer_email(
                destinataire=email,
                sujet=f"Demande de réservation à valider — {reservation.salle.nom}",
                corps_texte=corps,
            )
        except ErreurEnvoiEmail:
            logger.exception("Échec de la notification de la demande %s à %s", reservation.pk, email)


class _BeneficiaireMixin:
    def _determiner_beneficiaire(self, request):
        """Pour qui la reservation est-elle posee ?

        Un utilisateur reserve pour lui-meme. Un administrateur reserve toujours pour
        quelqu'un d'autre : il saisit nom et email. Le compte est cree au besoin, si bien
        que la personne retrouvera sa reservation en se connectant.
        """
        if request.user.role != 'ADMIN':
            return request.user, None

        nom = (request.data.get('pour_nom') or '').strip()
        email = (request.data.get('pour_email') or '').strip().lower()

        if not nom or '@' not in email:
            return None, Response(
                {'detail': "Indiquez le nom et l'email de la personne pour qui vous reservez."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if email == request.user.email.lower():
            return None, Response(
                {'detail': "Un administrateur reserve pour les autres, pas pour lui-meme."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        beneficiaire, _ = Utilisateur.objects.get_or_create(
            email=email,
            defaults={
                'nom': nom[:120],
                'ong': Ong.objects.filter(domaine_email=email.split('@')[-1]).first(),
            },
        )
        if not beneficiaire.nom:
            beneficiaire.nom = nom[:120]
            beneficiaire.save(update_fields=['nom'])
        return beneficiaire, None


class CreerReservation(_BeneficiaireMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ReservationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        salle = serializer.validated_data['salle']
        date_heure_debut = serializer.validated_data['date_heure_debut']

        beneficiaire, refus = self._determiner_beneficiaire(request)
        if refus is not None:
            return refus

        statut = determiner_statut_initial(salle, beneficiaire, date_heure_debut)

        try:
            reservation = serializer.save(utilisateur=beneficiaire, statut=statut)
        except IntegrityError:
            return Response(
                {'detail': 'Ce créneau est déjà réservé sur cette salle.'},
                status=status.HTTP_409_CONFLICT,
            )

        if reservation.statut == 'EN_ATTENTE':
            notifier_demande_en_attente(reservation)

        return Response(
            ReservationSerializer(reservation, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class MonProfil(APIView):
    """Nom affiche, demande a la premiere connexion."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        nom = (request.data.get('nom') or '').strip()
        if len(nom) < 2:
            return Response({'detail': 'Indiquez votre nom.'}, status=status.HTTP_400_BAD_REQUEST)
        request.user.nom = nom[:120]
        request.user.save(update_fields=['nom'])
        return Response({'nom': request.user.nom})


class AffichagePublic(APIView):
    """Ecran mural : l'occupation du jour, sans authentification.

    Deliberement anonyme — ni nom, ni email, ni objet de reunion, seulement l'ONG et
    l'horaire, deja visibles de tous dans le batiment. Un ecran accroche dans un couloir
    ne peut pas saisir de mot de passe, et en afficher un a cote ne protegerait rien.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        jour = timezone.localdate()
        reservations = (
            Reservation.objects.filter(statut='VALIDE', date_heure_debut__date=jour)
            .select_related('utilisateur__ong')
            .order_by('date_heure_debut')
        )
        return Response({
            'date': jour,
            'salles': [
                {
                    'nom': salle.nom,
                    'capacite': salle.capacite,
                    'creneaux': [
                        {
                            'debut': r.date_heure_debut,
                            'fin': r.date_heure_fin,
                            'ong': r.utilisateur.ong.nom if r.utilisateur.ong else None,
                        }
                        for r in reservations
                        if r.salle_id == salle.id
                    ],
                }
                for salle in Salle.objects.all()
            ],
        })


class ListeReservations(ListAPIView):
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Un administrateur voit tout ; un utilisateur ONG voit les créneaux réellement
        occupés et l'intégralité de ses propres demandes, refus compris.

        Les demandes en attente d'autrui restent visibles en tant que créneaux occupés —
        la contrainte d'exclusion en base les rend bloquantes, les cacher ferait échouer
        les réservations suivantes sans explication — mais le sérialiseur en masque le
        contenu. Les refus d'autrui, eux, ne bloquent rien et disparaissent.
        """
        reservations = (
            Reservation.objects.exclude(statut='ANNULE')
            .select_related('salle', 'utilisateur', 'utilisateur__ong')
            .order_by('date_heure_debut')
        )
        if self.request.user.role == 'ADMIN':
            return reservations
        return reservations.filter(
            Q(statut__in=['VALIDE', 'EN_ATTENTE']) | Q(utilisateur=self.request.user)
        )



class TraiterReservation(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            reservation = Reservation.objects.get(pk=pk)
        except Reservation.DoesNotExist:
            raise NotFound("Réservation introuvable.")

        if reservation.statut != 'EN_ATTENTE':
            return Response(
                {'detail': "Cette réservation n'est plus en attente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self._verifier_autorisation(request.user)

        action = request.data.get('action')
        if action not in ('valider', 'rejeter'):
            return Response(
                {'detail': "L'action doit être 'valider' ou 'rejeter'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reservation.statut = 'VALIDE' if action == 'valider' else 'REJETE'
        reservation.valide_par = request.user
        reservation.valide_le = timezone.now()
        reservation.save(update_fields=['statut', 'valide_par', 'valide_le'])

        return Response(ReservationSerializer(reservation, context={'request': request}).data)

    def _verifier_autorisation(self, utilisateur):
        """Seul un administrateur tranche une demande.

        Appartenir à l'ONG prioritaire du jour ne donne aucun droit de validation :
        la priorité décide du statut initial, pas de qui arbitre.
        """
        if utilisateur.role != 'ADMIN':
            raise PermissionDenied(
                "Seul un administrateur peut valider ou rejeter une demande."
            )

class UtilisateurActuel(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        get_token(request)
        utilisateur = request.user
        return Response({
            'email': utilisateur.email,
            'nom': utilisateur.nom,
            'ong': utilisateur.ong.nom if utilisateur.ong else None,
            'role': utilisateur.role,
        })


class ListeSalles(ListAPIView):
    serializer_class = SalleSerializer
    permission_classes = [IsAuthenticated]
    queryset = Salle.objects.prefetch_related('equipements')
