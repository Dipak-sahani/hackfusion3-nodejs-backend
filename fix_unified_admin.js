import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.DB_URI || 'mongodb://localhost:27017/hackfusion_pharmacy';

const fixAdmin = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        const user = await User.findOne({ email: 'amol@gmail.com' });
        if (user) {
            console.log('User Current Info:', JSON.stringify({
                name: user.name,
                email: user.email,
                role: user.role
            }, null, 2));

            user.role = 'admin';
            await user.save();
            console.log('User promoted successfully to ADMIN!');
        } else {
            console.log('Creating new admin: amol@gmail.com');
            await User.create({
                name: 'Amol Admin',
                email: 'amol@gmail.com',
                password: 'password123', // User should change this
                role: 'admin'
            });
            console.log('Admin account created successfully!');
        }
        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
    }
};

fixAdmin();
