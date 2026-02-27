import axios from 'axios';
import mongoose from 'mongoose';
import UserMedicine from './src/models/UserMedicine.js';
import Medicine from './src/models/Medicine.js';
import dotenv from 'dotenv';
import redis from './src/services/redisService.js';

dotenv.config();

const BASE_URL = 'http://localhost:3000/api';
let authToken = '';
let userId = '';

async function runSimulation() {
    try {
        console.log('--- Starting Simulation ---');

        // 1. Register/Login User
        const email = `testuser_${Date.now()}@example.com`;
        const password = 'password123';

        console.log(`Registering user: ${email}`);
        await axios.post(`${BASE_URL}/auth/register`, { name: 'Test User', email, password });

        const loginRes = await axios.post(`${BASE_URL}/auth/login`, { email, password });
        authToken = loginRes.data.token;
        userId = loginRes.data._id || loginRes.data.user._id; // Adjust based on actual response structure
        console.log('Logged in, Token received.');

        // Verify User ID retrieval
        if (!userId) {
            // Decode token or fetch user profile if ID not in login response
            // For now assuming it is there, otherwise need another call
            // Let's assume login returns { token, user: { _id, ... } }
        }

        const headers = { Authorization: `Bearer ${authToken}` };

        // 2. Setup Medicine Context (Direct DB)
        await mongoose.connect(process.env.MONGO_URI);

        console.log('Creating mock medicine history...');
        const med = await Medicine.create({
            name: 'Dolo 650',
            totalOrderedQuantity: 10,
            currentStock: 5,
            dailyConsumption: 2
        });

        // We need the User ID to link. If login didn't return it, we might be stuck.
        // Let's hope logic holds.
        // Actually, let's fetch profile to be sure
        // await axios.get(`${BASE_URL}/auth/profile`, { headers });

        // Wait, I can't easily get ID if not returned. 
        // Let's assume standard auth response.

        // Linking
        // Need to find the user in DB to get ID if not in response
        // But I don't import User model here.
        // Let's trust the login response for now.

        // Linking UserMedicine
        // Note: userId variable above might be undefined if structure differs.
        // Let's fetch the user from DB to be safe since we are connecting anyway.
        const User = mongoose.connection.collection('users');
        const userDoc = await User.findOne({ email });
        userId = userDoc._id;

        await UserMedicine.create({
            userId: userId,
            medicines: [med._id]
        });
        console.log('Medicine history created.');

        // 3. Chat Interaction 1: General
        console.log('Sending Chat 1: "Hi"');
        await axios.post(`${BASE_URL}/chat/message`, { text: "Hi" }, { headers });

        // 4. Chat Interaction 2: Context Query
        console.log('Sending Chat 2: "How much Dolo do I have?"');
        const res2 = await axios.post(`${BASE_URL}/chat/message`, { text: "How much Dolo do I have?" }, { headers });
        console.log('AI Response:', res2.data.message);

        // 5. Chat Interaction 3: Memory Check
        console.log('Sending Chat 3: "What did I just ask?"');
        const res3 = await axios.post(`${BASE_URL}/chat/message`, { text: "What medicine did I just ask about?" }, { headers });
        console.log('AI Response:', res3.data.message);

        // 6. Verify Redis
        console.log('Verifying Redis...');
        const keys = await redis.keys(`chat:${userId}`);
        console.log(`Redis Keys found: ${keys.length}`);
        const messages = await redis.lrange(`chat:${userId}`, 0, -1);
        console.log(`Stored Messages: ${messages.length}`);

        messages.forEach(m => console.log(m));

    } catch (error) {
        console.error('Simulation Error:', error.response?.data || error.message);
    } finally {
        await mongoose.disconnect();
        redis.disconnect();
    }
}

runSimulation();
