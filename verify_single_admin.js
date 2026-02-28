import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const verifyAdmins = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const admins = await User.find({ role: 'admin' }).select('name email createdAt');

        if (admins.length === 0) {
            console.log('No admin users found.');
        } else if (admins.length === 1) {
            console.log('Verification Success: Only one admin found.');
            console.log(`Admin: ${admins[0].name} (${admins[0].email}) - Since ${admins[0].createdAt}`);
        } else {
            console.warn(`Verification Failed: ${admins.length} admins found!`);
            admins.forEach((admin, index) => {
                console.log(`${index + 1}. ${admin.name} (${admin.email}) - Since ${admin.createdAt}`);
            });
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error during verification:', error);
        process.exit(1);
    }
};

verifyAdmins();
