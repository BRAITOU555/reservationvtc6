import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node'; // Utilisez le bon sous-module de lowdb
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
db.data ||= { reservations: [], drivers: [] };

// Your other routes and logic here

server.listen(3001, () => {
  console.log('Serveur démarré sur http://localhost:3001');
});
