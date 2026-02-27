
import mongoose from 'mongoose';

async function getLogs() {
    try {
        await mongoose.connect('mongodb://localhost:27017/hackfusion_pharmacy');

        const LogSchema = new mongoose.Schema({
            rawInput: String,
            extractedOutput: Object,
        }, { collection: 'llmextractionlogs', timestamps: true });

        const Log = mongoose.model('LLMExtractionLog', LogSchema);

        const logs = await Log.find().sort({ createdAt: -1 }).limit(10);

        console.log("ALL_LOGS_START");
        logs.forEach(l => {
            console.log(`Input: "${l.rawInput}" -> AI: "${l.extractedOutput?.message || 'N/A'}"`);
        });
        console.log("ALL_LOGS_END");

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}

getLogs();
