# syntax=docker/dockerfile:1

# --- Étape 1 : construction du bundle ---
FROM node:20-alpine AS build

WORKDIR /app

# npm ci s'appuie sur le lockfile : build reproductible, et couche Docker réutilisée
# tant que les dépendances ne changent pas.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Étape 2 : service des fichiers statiques ---
# Seul le résultat du build est embarqué : ni node_modules, ni sources dans l'image finale.
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
