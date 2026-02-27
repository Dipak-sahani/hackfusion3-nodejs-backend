import mongoose from 'mongoose';

async function findUsers() {
    try {
        const client = await mongoose.connect('mongodb://localhost:27017');
        const admin = client.connection.db.admin();
        const dbs = await admin.listDatabases();

        console.log("Scanning databases for 'users' collection...");
        for (let db of dbs.databases) {
            const currentDb = client.connection.useDb(db.name);
            const collections = await currentDb.db.listCollections().toArray();
            for (let col of collections) {
                if (col.name.toLowerCase().includes('user')) {
                    const count = await currentDb.db.collection(col.name).countDocuments();
                    console.log(`- DB: ${db.name}, Collection: ${col.name}, Count: ${count}`);
                }
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findUsers();
