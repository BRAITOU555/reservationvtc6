# Utilise l'image officielle Node.js comme image de base
FROM node:18

# Définit le répertoire de travail dans le conteneur
WORKDIR /app

# Copie le fichier package.json et package-lock.json
COPY package*.json ./

# Affiche le contenu du répertoire de travail
RUN ls -la

# Installe les dépendances du projet
RUN npm ci

# Affiche le contenu du répertoire de travail après l'installation des dépendances
RUN ls -la node_modules

# Copie le reste des fichiers de l'application
COPY . .

# Expose le port que l'application va utiliser
EXPOSE 3000

# Commande pour lancer l'application
CMD ["node", "server.mjs"]
