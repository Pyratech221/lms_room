"""Envoi d'emails via l'API Microsoft Graph (Microsoft 365 / Outlook).

Utilise le flux OAuth 2.0 "client credentials" (application, non délégué) :
Microsoft impose désormais l'authentification moderne et a désactivé
l'authentification SMTP basique (login/mot de passe) pour la plupart des
tenants — Graph est la voie recommandée pour un envoi automatisé côté serveur.

Nécessite une inscription d'application dans Microsoft Entra ID avec la
permission d'application "Mail.Send" (consentement administrateur requis).
Voir le README pour la procédure de configuration Azure.
"""

import requests
from django.conf import settings

GRAPH_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
GRAPH_SEND_MAIL_URL = "https://graph.microsoft.com/v1.0/users/{sender}/sendMail"


class ErreurEnvoiEmail(Exception):
    pass


def _obtenir_token():
    if not (settings.MS_GRAPH_TENANT_ID and settings.MS_GRAPH_CLIENT_ID and settings.MS_GRAPH_CLIENT_SECRET):
        raise ErreurEnvoiEmail(
            "Configuration Microsoft Graph manquante : MS_GRAPH_TENANT_ID, "
            "MS_GRAPH_CLIENT_ID et MS_GRAPH_CLIENT_SECRET doivent être définis."
        )

    url = GRAPH_TOKEN_URL.format(tenant=settings.MS_GRAPH_TENANT_ID)
    reponse = requests.post(
        url,
        data={
            "client_id": settings.MS_GRAPH_CLIENT_ID,
            "client_secret": settings.MS_GRAPH_CLIENT_SECRET,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        },
        timeout=10,
    )
    if not reponse.ok:
        raise ErreurEnvoiEmail(
            f"Impossible d'obtenir un jeton Microsoft Graph ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()["access_token"]


def envoyer_email(destinataire, sujet, corps_texte):
    if not settings.MS_GRAPH_SENDER_EMAIL:
        raise ErreurEnvoiEmail("MS_GRAPH_SENDER_EMAIL n'est pas configuré.")

    token = _obtenir_token()
    url = GRAPH_SEND_MAIL_URL.format(sender=settings.MS_GRAPH_SENDER_EMAIL)
    payload = {
        "message": {
            "subject": sujet,
            "body": {"contentType": "Text", "content": corps_texte},
            "toRecipients": [{"emailAddress": {"address": destinataire}}],
        },
        "saveToSentItems": "true",
    }
    reponse = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=10,
    )
    if reponse.status_code != 202:
        raise ErreurEnvoiEmail(
            f"Échec de l'envoi via Microsoft Graph ({reponse.status_code}) : {reponse.text}"
        )
