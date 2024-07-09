# Utilise l'image officielle Node.js comme image de base
FROM node:18

# Définit le répertoire de travail dans le conteneur
WORKDIR /app

# Copie le fichier package.json et package-lock.json
COPY package*.json ./

# Installe les dépendances du projet
RUN npm ci

# Copie le reste des fichiers de l'application
COPY . .

# Expose le port que l'application va utiliser
EXPOSE 3000

# Commande pour lancer l'application
CMD ["node", "server.mjs"]
