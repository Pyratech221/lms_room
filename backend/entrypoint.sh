#!/bin/sh
set -e

# Les migrations sont jouées à chaque démarrage : c'est elles qui créent l'extension
# PostgreSQL btree_gist (migration 0003), requise par la contrainte anti-chevauchement.
echo "→ Application des migrations…"
python manage.py migrate --noinput

echo "→ Démarrage de Gunicorn"
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --access-logfile - \
    --error-logfile -
