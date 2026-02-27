import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.DB_URI || 'mongodb://localhost:27017/myapp';

async function searchAll(id) {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log(`Searching for ID: ${id} in all collections...`);

        for (let colInfo of collections) {
            const collection = db.collection(colInfo.name);
            const doc = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
            if (doc) {
                console.log(`MATCH FOUND in collection: ${colInfo.name}`);
                console.log(JSON.stringify(doc, null, 2));
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

searchAll(process.argv[2]);
