import mongoose from 'mongoose';
import User from './src/models/User.js';

const MONGO_URI = "mongodb+srv://dipaksirsath:Dipak%40123@cluster0.z5i65.mongodb.net/hackfusion?retryWrites=true&w=majority&appName=Cluster0";

const checkAndFixUser = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        const user = await User.findOne({ email: 'amol@gmail.com' });
        if (user) {
            console.log('User Current Info:', JSON.stringify({
                name: user.name,
                email: user.email,
                role: user.role
            }, null, 2));

            if (user.role !== 'admin') {
                console.log('Promoting user to admin...');
                user.role = 'admin';
                await user.save();
                console.log('User promoted successfully!');
            } else {
                console.log('User is already an admin.');
            }
        } else {
            console.log('User not found: amol@gmail.com');
        }
        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
    }
};

checkAndFixUser();
