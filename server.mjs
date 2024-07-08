import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import sgMail from '@sendgrid/mail';
import { Low, JSONFile } from 'lowdb';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config(); // Charger les variables d'environnement

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialiser la base de données
const filePath = join(__dirname, 'db.json');
const adapter = new JSONFile(filePath);
const db = new Low(adapter);

// Charger ou initialiser la base de données
await db.read();
db.data = db.data || { reservations: [], drivers: [] };

// Vérification pour s'assurer que db.data.drivers est un tableau
if (!Array.isArray(db.data.drivers)) {
    db.data.drivers = [];
}

// Configuration de SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Routes de l'application (exemple pour l'enregistrement du chauffeur)
app.post('/driver-register', async (req, res) => {
    const { email, phone, name, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const driver = {
        id: nanoid(),
        email,
        phone,
        name,
        password: hashedPassword,
        verified: false,
        token: nanoid(),
    };

    db.data.drivers.push(driver);
    await db.write();

    const verificationLink = `http://localhost:${port}/verify-driver?token=${driver.token}`;

    const msg = {
        to: email,
        from: 'monchauffeurprive5@gmail.com',
        subject: 'Validation de votre compte chauffeur',
        text: `Bonjour ${name},\n\nVeuillez cliquer sur le lien suivant pour valider votre compte chauffeur : ${verificationLink}\n\nMerci.`,
    };

    sgMail.send(msg)
        .then(() => {
            console.log('Email de validation envoyé');
            res.json({ success: true, message: 'Un email de validation a été envoyé.' });
        })
        .catch(error => {
            console.error(error);
            res.status(500).send('Erreur lors de l\'envoi de l\'email de validation');
        });
});

// ... autres routes et configuration WebSocket ...

const server = app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});

// Configurer WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
    console.log('Client connecté');

    ws.on('message', message => {
        const data = JSON.parse(message);
        if (data.type === 'location-update' && db.data && db.data.drivers) {
            const driver = db.data.drivers.find(driver => driver.id === data.id);
            if (driver) {
                driver.location = {
                    latitude: data.latitude,
                    longitude: data.longitude,
                };
                db.write();

                // Broadcast the updated location to all connected clients
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'location-update',
                            id: driver.id,
                            latitude: data.latitude,
                            longitude: data.longitude,
                        }));
                    }
                });
            }
        }
    });
});
