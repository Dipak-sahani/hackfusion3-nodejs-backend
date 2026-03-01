import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileHash: {
        type: String,
        required: true,
        unique: true
    },
    rawOcrText: {
        type: String
    },
    extractedData: {
        doctorName: String,
        doctorRegistrationNumber: String,
        patientName: String,
        medicines: [{
            medicine: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Medicine',
                required: false
            },
            // Metadata Snapshots
            name: String, // Medical Name from Prescription
            matchedName: String, // Global Name if matched
            unit: String,
            image: String,
            pricePerUnit: Number,

            // Medical Data
            dosage: String,
            frequency: String,
            quantity: Number
        }],
        prescriptionDate: Date,
        address: String
    },
    aiVerificationStatus: {
        type: String,
        enum: ["UPLOADED", "OCR_COMPLETE", "AI_APPROVED", "AI_REJECTED", "MANUAL_REVIEW"],
        default: "UPLOADED"
    },
    suspiciousScore: {
        type: Number,
        default: 0
    },
    manualReviewStatus: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED"],
        default: "PENDING"
    },
    reviewLogs: [{
        action: String, // e.g., 'DATA_EDITED', 'APPROVED', 'REJECTED'
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        changes: Object, // Store what was changed
        notes: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

const Prescription = mongoose.model('Prescription', prescriptionSchema);
export default Prescription;
