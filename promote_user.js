import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const MONGO_URI = process.env.DB_URI || 'mongodb://localhost:27017/hackfusion_pharmacy';

async function promoteUser(email, newRole) {
    if (!['admin', 'customer', 'doctor'].includes(newRole)) {
        console.error('Invalid role. Use: admin, customer, or doctor');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI);
        const user = await User.findOne({ email });

        if (!user) {
            console.error(`User with email ${email} not found.`);
            await mongoose.connection.close();
            process.exit(1);
        }

        user.role = newRole;
        await user.save();

        console.log(`Successfully promoted ${email} to ${newRole.toUpperCase()}.`);
        await mongoose.connection.close();
    } catch (error) {
        console.error('Promotion failed:', error.message);
        process.exit(1);
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node promote_user.js <email> <role>');
    process.exit(1);
}

promoteUser(args[0], args[1]);
