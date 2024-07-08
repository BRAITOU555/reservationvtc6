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
const port = 3001; // Utiliser un port disponible

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialiser la base de données
const filePath = join(__dirname, 'db.json');
const adapter = new JSONFile(filePath);
const db = new Low(adapter);

// Charger ou initialiser la base de données
await db.read();
db.data = db.data || { reservations: [], drivers: [] }; // Initialiser correctement la structure de db.data

// Vérification pour s'assurer que db.data.drivers est un tableau
if (!Array.isArray(db.data.drivers)) {
    db.data.drivers = [];
}

// Configuration de SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Route d'enregistrement du chauffeur
app.post('/driver-register', async (req, res) => {
    const { email, phone, name, password } = req.body;

    // Hash du mot de passe
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
        from: 'monchauffeurprive5@gmail.com', // Remplacez par votre email vérifié SendGrid
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

// Route de validation du chauffeur
app.get('/verify-driver', async (req, res) => {
    const { token } = req.query;

    const driver = db.data.drivers.find(driver => driver.token === token);
    if (driver) {
        driver.verified = true;
        driver.token = null; // Invalider le token
        await db.write();
        res.json({ success: true, message: 'Compte chauffeur vérifié. Vous pouvez maintenant compléter votre profil.' });
    } else {
        res.status(400).send('Token de validation invalide');
    }
});

// Route de mise à jour du profil du chauffeur
app.post('/driver-profile', async (req, res) => {
    const { id, firstName, lastName, birthDate, siret, companyName, address, postalCode, city } = req.body;

    const driver = db.data.drivers.find(driver => driver.id === id);
    if (driver && driver.verified) {
        driver.firstName = firstName;
        driver.lastName = lastName;
        driver.birthDate = birthDate;
        driver.siret = siret;
        driver.companyName = companyName;
        driver.address = address;
        driver.postalCode = postalCode;
        driver.city = city;
        await db.write();
        res.json({ success: true, message: 'Profil chauffeur mis à jour' });
    } else {
        res.status(400).send('Chauffeur non trouvé ou non vérifié');
    }
});

app.post('/reserve', async (req, res) => {
    const { pickupLocation, dropoffLocation, pickupTime, reservationType, discountedFare } = req.body;
    
    if (typeof discountedFare !== 'number') {
        res.status(400).send('Invalid discountedFare value');
        return;
    }

    const reservation = { id: nanoid(), pickupLocation, dropoffLocation, pickupTime, reservationType, discountedFare };
    
    db.data.reservations.push(reservation);
    await db.write();

    console.log(`Réservation reçue : ${pickupLocation} à ${dropoffLocation} pour ${pickupTime}, Type: ${reservationType}`);

    const msg = {
        to: 'monchauffeurprive5@gmail.com', // Remplacez par votre email
        from: 'monchauffeurprive5@gmail.com', // Remplacez par votre email vérifié SendGrid
        subject: 'Nouvelle Réservation',
        text: `Nouvelle réservation reçue : 
            Lieu de prise en charge: ${pickupLocation}
            Lieu de destination: ${dropoffLocation}
            Heure de prise en charge: ${new Date(pickupTime).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
            Type de réservation: ${reservationType}
            Tarif estimé : ${discountedFare.toFixed(2)} €`
    };

    sgMail.send(msg)
    .then(() => {
        console.log('Email envoyé');
        res.json(reservation);

        // Envoyer la réservation à tous les clients connectés via WebSocket
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'reservation-update',
                    reservation
                }));
            }
        });
    })
    .catch(error => {
        console.error(error);
        res.status(500).send('Erreur lors de l\'envoi de l\'email');
    });
});

app.get('/reservations', async (req, res) => {
    await db.read();
    res.json(db.data.reservations);
});

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
