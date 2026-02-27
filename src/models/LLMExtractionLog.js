import mongoose from 'mongoose';

const llmExtractionLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rawInput: { type: String, required: true },
    extractedOutput: { type: Object }, // JSON output from Gemini
    confidenceScore: { type: Number },
    processingTimeMs: { type: Number },
    geminiModelVersion: { type: String },
    status: { type: String, enum: ['success', 'failed'], default: 'success' },
    error: { type: String }
}, {
    timestamps: true
});

const LLMExtractionLog = mongoose.model('LLMExtractionLog', llmExtractionLogSchema);
export default LLMExtractionLog;
