from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import RangeOperators, DateTimeRangeField, RangeBoundary
from django.db.models import Q, Func
import secrets
from django.utils import timezone
from datetime import timedelta

# Create your models here.
class Ong(models.Model):
    nom = models.CharField(max_length=50, unique=True)
    domaine_email = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nom
    


class UtilisateurManager(BaseUserManager):
    def create_user(self, email, ong=None, **extra_fields):
        if not email:
            raise ValueError("L'email est obligatoire")
        email = self.normalize_email(email)
        user = self.model(email=email, ong=ong, **extra_fields)
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_unusable_password()
        user.save(using=self._db)
        return user


class Utilisateur(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('ADMIN', 'Administrateur'),
        ('ONG', 'Utilisateur ONG'),
    ]

    email = models.EmailField(unique=True)
    # Renseigne a la premiere connexion, ou par l'administrateur reservant pour autrui.
    nom = models.CharField(max_length=120, blank=True)
    ong = models.ForeignKey(Ong, on_delete=models.PROTECT, null=True, blank=True, related_name='utilisateurs')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='ONG')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)

    objects = UtilisateurManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class Equipement(models.Model):
    nom = models.CharField(max_length=100)
    icon = models.CharField(
        max_length=20,
        default='📌',
        help_text="Emoji ou symbole pour représenter l'équipement"
    )

    def __str__(self):
        return self.nom

    class Meta:
        ordering = ['nom']


class Salle(models.Model):
    nom = models.CharField(max_length=50)
    capacite = models.PositiveIntegerField()
    description = models.TextField(blank=True)
    equipements = models.ManyToManyField(Equipement, blank=True, related_name='salles')
    necessite_priorite = models.BooleanField(
        default=False,
        help_text="Cocher uniquement pour la salle soumise à la règle de priorité par ONG (Salle 1)"
    )

    class Meta:
        # Sans tri explicite, PostgreSQL renvoie les lignes dans un ordre arbitraire :
        # l'ordre des salles changeait d'un environnement a l'autre.
        ordering = ['nom']

    def __str__(self):
        return self.nom


class TsTzRange(Func):
    function = 'TSTZRANGE'
    output_field = DateTimeRangeField()


class Reservation(models.Model):
    STATUT_CHOICES = [
        ('EN_ATTENTE', 'En attente'),
        ('VALIDE', 'Validé'),
        ('REJETE', 'Rejeté'),
        ('ANNULE', 'Annulé'),
    ]

    salle = models.ForeignKey(Salle, on_delete=models.PROTECT, related_name='reservations')
    utilisateur = models.ForeignKey(Utilisateur, on_delete=models.PROTECT, related_name='reservations')
    date_heure_debut = models.DateTimeField()
    date_heure_fin = models.DateTimeField()
    objet = models.TextField(blank=True)
    statut = models.CharField(max_length=10, choices=STATUT_CHOICES, default='EN_ATTENTE')
    date_creation = models.DateTimeField(auto_now_add=True)
    valide_par = models.ForeignKey(
        Utilisateur, on_delete=models.SET_NULL, null=True, blank=True, related_name='validations'
    )
    valide_le = models.DateTimeField(null=True, blank=True)


    class Meta:
        constraints = [
            ExclusionConstraint(
                name='exclude_chevauchement_reservation',
                expressions=[
                    ('salle', RangeOperators.EQUAL),
                    (TsTzRange('date_heure_debut', 'date_heure_fin', RangeBoundary()), RangeOperators.OVERLAPS),
                ],
                condition=Q(statut__in=['EN_ATTENTE', 'VALIDE']),
            )
        ]

    def __str__(self):
        return f"{self.salle} — {self.date_heure_debut:%d/%m %H:%M} ({self.statut})"
    

class CodeConnexion(models.Model):
    """Code a six chiffres envoye par mail pour ouvrir une session.

    Pas de lien cliquable : un lien ouvre le navigateur par defaut, qui n'est pas
    forcement celui ou l'application est installee, et la session se posait alors dans
    la mauvaise fenetre. Le code, lui, se saisit la ou la demande a ete faite.
    """

    email = models.EmailField()
    # Identifiant de la demande, tire au hasard et connu de la seule fenetre qui l'a
    # faite. Il accompagne le code a la verification : six chiffres seuls se devineraient
    # en un million d'essais, c'est le suivi qui rend l'attaque sans objet.
    suivi = models.CharField(max_length=64, unique=True)
    code = models.CharField(max_length=6)
    essais = models.PositiveSmallIntegerField(default=0)
    created_le = models.DateTimeField(auto_now_add=True)
    expire_le = models.DateTimeField()
    utilise_le = models.DateTimeField(null=True, blank=True)

    ESSAIS_MAX = 5

    @classmethod
    def generer(cls, email):
        return cls.objects.create(
            email=email.lower(),
            suivi=secrets.token_urlsafe(24),
            code=f'{secrets.randbelow(1_000_000):06d}',
            expire_le=timezone.now() + timedelta(minutes=15),
        )

    def est_valide(self):
        return (
            self.utilise_le is None
            and self.essais < self.ESSAIS_MAX
            and timezone.now() < self.expire_le
        )

    def enregistrer_echec(self):
        """Un code faux rapproche la demande de sa mise hors service."""
        self.essais += 1
        self.save(update_fields=['essais'])

    def marquer_utilise(self):
        self.utilise_le = timezone.now()
        self.save(update_fields=['utilise_le'])

    def __str__(self):
        return f"{self.email} — {'utilisé' if self.utilise_le else 'actif'}"