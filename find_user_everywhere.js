import mongoose from 'mongoose';

async function findUserEverywhere(id) {
    try {
        const client = await mongoose.connect('mongodb://localhost:27017');
        const admin = client.connection.db.admin();
        const dbs = await admin.listDatabases();

        console.log(`Searching for User ID: ${id} across all databases...`);
        for (let db of dbs.databases) {
            const currentDb = client.connection.useDb(db.name);
            const collections = await currentDb.db.listCollections().toArray();
            for (let col of collections) {
                if (col.name.toLowerCase().includes('user')) {
                    const user = await currentDb.db.collection(col.name).findOne({ _id: new mongoose.Types.ObjectId(id) });
                    if (user) {
                        console.log(`!!! USER MATCH FOUND in DB: ${db.name}, Collection: ${col.name}`);
                        return;
                    }
                }
            }
        }
        console.log("User ID not found anywhere.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findUserEverywhere(process.argv[2]);
