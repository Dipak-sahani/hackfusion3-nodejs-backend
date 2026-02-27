import mongoose from 'mongoose';
import axios from 'axios';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// We don't import models directly here to avoid DB connection issues if we just want to run script against API
// But for verification logic involving direct model checks, we might need them.
// Let's stick to API calls as primary verification.

const API_URL = 'http://localhost:3000/api';

// Mock data
const TEST_USER = {
    name: 'Test Verify User',
    email: `test${Date.now()}@example.com`,
    password: 'password123',
    role: 'admin' // Admin to create medicines
};

const TEST_MEDICINE = {
    name: 'Dolo 650',
    description: 'Pain reliever',
    unit: 'strip',
    quantityInStock: 100,
    pricePerUnit: 30, // 30 per strip
    requiresPrescription: false
};

const TEST_PROMPT = "I want 2 strips of Dolo 650";


async function runVerification() {
    console.log('Starting Verification...');

    try {

        // LOGIN / REGISTER
        console.log('1. Registering User...');
        let token;
        let userId;
        try {
            const regRes = await axios.post(`${API_URL}/auth/register`, TEST_USER);
            token = regRes.data.token;
            userId = regRes.data._id;
            console.log('   User registered:', regRes.data.email);
        } catch (e) {
            console.log('   Register failed (maybe exists), trying login...');
            const loginRes = await axios.post(`${API_URL}/auth/login`, { email: TEST_USER.email, password: TEST_USER.password });
            token = loginRes.data.token;
            userId = loginRes.data._id;
            console.log('   User logged in.');
        }

        const authHeader = { headers: { Authorization: `Bearer ${token}` } };

        // CREATE MEDICINE
        console.log('2. Creating Medicine...');
        // cleanup first
        // Not easy via API without ID. We'll just create a new one or ignore dupe error if unique index (no unique index on name yet)
        const medRes = await axios.post(`${API_URL}/medicines`, TEST_MEDICINE, authHeader);
        console.log('   Medicine created:', medRes.data.name);

        // AI ORDER
        console.log('3. Testing AI Order (FastAPI Integration)...');
        console.log(`   Sending prompt: "${TEST_PROMPT}"`);
        const aiRes = await axios.post(`${API_URL}/orders/ai-order`, { text: TEST_PROMPT }, authHeader);
        const preOrder = aiRes.data;
        console.log('   AI Order Response:', JSON.stringify(preOrder, null, 2));

        if (preOrder.validationErrors.length > 0) {
            console.warn('   WARNING: Validation Errors present:', preOrder.validationErrors);
        }

        // CONFIRM ORDER
        console.log('4. Confirming Order...');
        const confirmRes = await axios.post(`${API_URL}/orders/${preOrder._id}/confirm`, {}, authHeader);
        console.log('   Order Confirmed. Status:', confirmRes.data.status);

        // CHECK LOGS
        console.log('5. Checking Inventory Logs...');
        const logsRes = await axios.get(`${API_URL}/inventory/logs`, authHeader);
        const latestLog = logsRes.data[0];
        console.log('   Latest Log:', latestLog.reason, latestLog.changeAmount);

        if (latestLog.changeAmount === -20) { // 2 strips * 10 tablets/strip? Accessing FASTAPI_LOGIC. 
            // Wait, FastAPI implementation assumed user input 'strip' -> converted default is 10? 
            // My FastAPI prompt said "1 strip = 10 tablets". 
            // Node service: orders -> quantity_converted.
            // So if I asked for 2 strips, converted is 20.
            // Stock deduction should be 20.
            console.log('   SUCCESS: Stock deduction matches expected value (20).');
        } else {
            console.log(`   Check Change Amount: Got ${latestLog.changeAmount}, Expected -20 (assuming 2 strips * 10).`);
        }

        console.log('\nVERIFICATION COMPLETE.');
    } catch (error) {
        console.error('VERIFICATION FAILED:', error.response ? error.response.data : error.message);
    }
}

// We need the servers running for this to work.
// This script is intended to be run while servers are active.
// In ES modules, we can check if file is run directly roughly like this:
import { fileURLToPath } from 'url';
const currentFile = fileURLToPath(import.meta.url);
const nodeEntry = process.argv[1];

if (currentFile === nodeEntry) {
    runVerification();
}
