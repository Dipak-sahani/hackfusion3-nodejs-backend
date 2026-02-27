import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.DB_URI || 'mongodb://localhost:27017/myapp';

async function checkUser(id) {
    try {
        await mongoose.connect(MONGO_URI);
        const User = mongoose.model('User', new mongoose.Schema({}));
        const user = await User.findById(id).lean();
        if (user) {
            console.log("MATCH FOUND: ID belongs to a USER.");
            console.log(JSON.stringify(user, null, 2));
        } else {
            console.log("No user found with this ID.");
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUser(process.argv[2]);
