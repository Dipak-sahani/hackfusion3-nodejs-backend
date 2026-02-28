import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

const API_URL = 'http://localhost:5000/api'; // Adjust if needed
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN_HERE'; // This needs to be a real token from a logged-in admin

async function testUpload() {
    const filePath = 'e:/HackFusion/2026/codebase/product data.xlsx';
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    try {
        const response = await axios.post(`${API_URL}/medicines/upload`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });
        console.log('Upload Result:', response.data);
    } catch (error) {
        console.error('Upload Failed:', error.response?.data || error.message);
    }
}

// Note: This script requires a valid ADMIN_TOKEN. 
// For manual verification, I'll recommend the user to use the UI with the updated code.
console.log('Verification script ready. Please use the Admin UI to upload "product data.xlsx" after restarting the server.');
