import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node'; // Utilisation de l'adaptateur JSONFile depuis lowdb/node
import express from 'express';
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import cors from 'cors';
import { nanoid } from 'nanoid';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Setup the database
const adapter = new JSONFile('db.json');
const db = new Low(adapter);

await db.read();
db.data ||= { reservations: [], admins: [], drivers: [] };

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.data.admins.push({ id: nanoid(), username, password: hashedPassword });
    await db.write();
    res.sendStatus(201);
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = db.data.admins.find(admin => admin.username === username);
    if (admin && await bcrypt.compare(password, admin.password)) {
        res.sendStatus(200);
    } else {
        res.sendStatus(401);
    }
});

app.post('/reserve', async (req, res) => {
    const { name, email, phone, pickup, dropoff, time, type } = req.body;
    const reservation = { id: nanoid(), name, email, phone, pickup, dropoff, time, type };
    db.data.reservations.push(reservation);
    await db.write();

    io.emit('newReservation', reservation);

    if (process.env.SENDGRID_API_KEY) {
        const transporter = nodemailer.createTransport({
            service: 'SendGrid',
            auth: {
                user: 'apikey',
                pass: process.env.SENDGRID_API_KEY
            }
        });

        const mailOptions = {
            from: 'your-email@example.com',
            to: email,
            subject: 'Reservation Confirmation',
            text: `Your reservation from ${pickup} to ${dropoff} has been confirmed for ${time}.`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    }

    res.sendStatus(201);
});

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log(`Serveur démarré sur http://localhost:${process.env.PORT || 3000}`);
});
