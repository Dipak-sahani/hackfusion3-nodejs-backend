import dotenv from 'dotenv';
dotenv.config();

import express from 'express'; // Required if used directly, though usage here is minimal
import http from 'http';
import app from './app.js'; // Ensure extension
import connectDB from './config/db.js';
import { startReminderScheduler } from './services/reminderScheduler.js';


// Connect to Database
connectDB().then(() => {
    // Start Services
    startReminderScheduler();
});
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
