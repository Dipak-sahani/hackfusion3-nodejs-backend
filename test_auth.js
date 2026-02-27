import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

async function testAuth() {
    try {
        await mongoose.connect(process.env.DB_URI);
        console.log('Connected to DB');

        const testEmail = 'nonexistent@example.com';
        const testPass = 'wrongpassword';

        const user = await User.findOne({ email: testEmail });
        console.log('User found for nonexistent email:', user);

        if (user && (await user.matchPassword(testPass))) {
            console.log('Login SUCCESS (This should NOT happen for wrong email)');
        } else {
            console.log('Login FAILED (Correct behavior for wrong email)');
        }

        // Test with empty string
        const emptyUser = await User.findOne({ email: "" });
        console.log('User found for empty string:', emptyUser);

        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testAuth();
