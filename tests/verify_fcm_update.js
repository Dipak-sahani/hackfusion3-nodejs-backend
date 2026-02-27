import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

async function testFcmUpdate() {
    const email = 'dipak@gmail.com';
    const password = 'password123'; // Assuming a test password, or I'll need a real one

    try {
        console.log('Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, { email, password });
        const token = loginRes.data.token;
        console.log('Login successful.');

        const testFcmToken = "test_fcm_token_" + Date.now();
        console.log(`Updating FCM token to ${testFcmToken}...`);

        const updateRes = await axios.put(`${BASE_URL}/auth/fcm-token`,
            { fcmToken: testFcmToken },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log('Update response:', updateRes.data);

        if (updateRes.data.message === 'FCM token updated successfully') {
            console.log('VERIFICATION SUCCESS: Backend updateFcmToken endpoint works.');
        } else {
            console.log('VERIFICATION FAILED: Unexpected response.');
        }
    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
        console.log('Note: This test requires a valid user "dipak@gmail.com" with password "password123" to be running.');
    }
}

testFcmUpdate();
