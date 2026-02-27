import mongoose from 'mongoose';
import UserMedicine from './src/models/UserMedicine.js';
import Medicine from './src/models/Medicine.js';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://dipaksirsath:Dipak%40123@cluster0.z5i65.mongodb.net/hackfusion?retryWrites=true&w=majority&appName=Cluster0";

async function inspect() {
    try {
        await mongoose.connect(MONGO_URI);
        const userId = "6996af8a7a496f76d44b57ae";

        const userMed = await UserMedicine.findOne({ userId }).populate('medicines.medicine');
        if (!userMed) {
            console.log("No UserMedicine found for this user");
            return;
        }

        console.log("Found UserMedicine document.");
        userMed.medicines.forEach((m, i) => {
            console.log(`\nMedicine ${i + 1}:`);
            console.log(`  Name: ${m.medicine?.name}`);
            console.log(`  ID: ${m.medicine?._id}`);
            console.log(`  ReminderTimes:`, m.reminderTimes);
            console.log(`  DailyConsumption: ${m.dailyConsumption}`);
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

inspect();
