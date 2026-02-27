import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.DB_URI || 'mongodb://localhost:27017/hackfusion';

async function listUsers() {
    try {
        await mongoose.connect(MONGO_URI);
        const User = mongoose.model('User', new mongoose.Schema({
            email: String,
            name: String
        }, { strict: false }));

        const users = await User.find().lean();
        console.log(`Found ${users.length} users in 'hackfusion' DB:`);
        users.forEach(u => {
            console.log(`- ID: ${u._id}, Name: ${u.name}, Email: ${u.email}, FCM: ${u.fcmToken}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listUsers();
