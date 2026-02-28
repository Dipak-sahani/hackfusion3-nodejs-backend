import mongoose from 'mongoose';

const MissingMedicineSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    requestedCount: {
        type: Number,
        default: 1
    },
    lastRequestedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['PENDING', 'RESOLVED'],
        default: 'PENDING'
    }
}, { timestamps: true });

export default mongoose.model('MissingMedicine', MissingMedicineSchema);
