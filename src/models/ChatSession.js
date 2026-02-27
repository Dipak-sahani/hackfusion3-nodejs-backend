import mongoose from 'mongoose';

const chatSessionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messages: [{
        sender: { type: String, enum: ['user', 'system', 'agent'] },
        text: { type: String },
        timestamp: { type: Date, default: Date.now },
        meta: { type: Object } // Optional metadata like extracted entities
    }],
    status: { type: String, enum: ['active', 'closed'], default: 'active' }
}, {
    timestamps: true
});

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
export default ChatSession;
