import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({ email: 'amol@gmail.com' });
        if (user) {
            console.log('User found:', JSON.stringify({
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }, null, 2));
        } else {
            console.log('User not found: amol@gmail.com');
        }
        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
    }
};

checkUser();
