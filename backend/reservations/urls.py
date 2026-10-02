from django.urls import path
from .views import DemandeCodeConnexion, VerifierCodeConnexion, CreerReservation, ListeReservations, TraiterReservation, UtilisateurActuel, ListeSalles, JetonCsrf, Deconnexion, MonProfil, AffichagePublic

urlpatterns = [
    path('auth/csrf/', JetonCsrf.as_view()),
    path('auth/demande-code/', DemandeCodeConnexion.as_view()),
    path('auth/verifier-code/', VerifierCodeConnexion.as_view()),
    path('auth/deconnexion/', Deconnexion.as_view()),
    path('auth/profil/', MonProfil.as_view()),
    path('affichage/', AffichagePublic.as_view()),
    path('auth/utilisateur-actuel/', UtilisateurActuel.as_view()),
    path('salles/', ListeSalles.as_view()),
    path('reservations/', ListeReservations.as_view()),
    path('reservations/creer/', CreerReservation.as_view()),
    path('reservations/<int:pk>/traiter/', TraiterReservation.as_view()),
]