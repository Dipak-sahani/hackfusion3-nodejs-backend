import mongoose from 'mongoose';

async function searchEverywhere(id) {
    try {
        const client = await mongoose.connect('mongodb://localhost:27017');
        const admin = client.connection.db.admin();
        const dbs = await admin.listDatabases();

        console.log("Databases List:");
        for (let db of dbs.databases) {
            console.log(`- ${db.name}`);
            const currentDb = client.connection.useDb(db.name);
            const collections = await currentDb.db.listCollections().toArray();
            for (let col of collections) {
                const doc = await currentDb.db.collection(col.name).findOne({ _id: new mongoose.Types.ObjectId(id) });
                if (doc) {
                    console.log(`!!! MATCH FOUND in DB: ${db.name}, Collection: ${col.name}`);
                    console.log(JSON.stringify(doc, null, 2));
                }

                // Also check if ID is a string in the DB
                const docStr = await currentDb.db.collection(col.name).findOne({ _id: id });
                if (docStr) {
                    console.log(`!!! MATCH FOUND (as string) in DB: ${db.name}, Collection: ${col.name}`);
                    console.log(JSON.stringify(docStr, null, 2));
                }
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

searchEverywhere(process.argv[2]);
