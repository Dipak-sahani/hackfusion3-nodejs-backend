import mongoose from 'mongoose';

const manualReviewQueueSchema = new mongoose.Schema({
    prescriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription',
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    assignedDoctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor'
    },
    reviewedByDoctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor'
    },
    reviewNotes: {
        type: String
    },
    status: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED"],
        default: "PENDING"
    }
}, {
    timestamps: true
});

const ManualReviewQueue = mongoose.model('ManualReviewQueue', manualReviewQueueSchema);
export default ManualReviewQueue;
