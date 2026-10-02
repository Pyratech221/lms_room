# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Pas de fichiers .pyc, logs non bufferisés (indispensable pour voir les logs du conteneur).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Les dépendances sont copiées seules d'abord : tant que requirements.txt ne change pas,
# Docker réutilise cette couche et ne réinstalle rien.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Les fichiers statiques (admin Django) sont rassemblés à la construction de l'image :
# aucune connexion à la base n'est nécessaire pour cette étape.
# DEBUG=False est indispensable ici : c'est lui qui active le stockage versionné et donc
# la génération du manifeste staticfiles.json, que le conteneur exige à l'exécution.
RUN DEBUG=False python manage.py collectstatic --noinput

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
