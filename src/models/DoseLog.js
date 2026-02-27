import mongoose from 'mongoose';

const doseLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    medicineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true
    },
    scheduledTime: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'taken', 'missed'],
        default: 'pending'
    },
    confirmedAt: {
        type: Date
    },
    isFollowUpSent: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Prevent duplicate logs for the same medicine at the same scheduled time for the same user
doseLogSchema.index({ userId: 1, medicineId: 1, scheduledTime: 1 }, { unique: true });

const DoseLog = mongoose.model('DoseLog', doseLogSchema);
export default DoseLog;
