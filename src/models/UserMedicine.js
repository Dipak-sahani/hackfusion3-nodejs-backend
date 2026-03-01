import mongoose from 'mongoose';

const UserMedicineSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    medicines: [{
        medicine: {
            type: mongoose.Schema.Types.ObjectId, // Link to Global Medicine Catalog
            ref: 'Medicine',
            required: false // Decoupled: can persist even if global medicine is deleted
        },
        // Static Snapshots (Persistence)
        name: String,
        unit: { type: String, default: 'tablet' },
        category: String,
        pricePerUnit: { type: Number, default: 0 },
        image: String,
        userStock: {
            type: Number, // User's personal stock
            default: 0
        },
        totalTablets: {
            type: Number,
            default: 0
        },
        initialTablets: {
            type: Number,
            default: 0
        },
        dailyConsumption: {
            type: Number,
            default: 1
        },
        unit: {
            type: String, // e.g., 'tablet'
            default: 'tablet'
        },
        isActive: {
            type: Boolean,
            default: true
        },
        startedAt: {
            type: Date
        },
        stoppedAt: {
            type: Date
        },
        reminderTimes: [{
            type: String // e.g., ["08:00", "20:00"]
        }],
        remindersEnabled: {
            type: Boolean,
            default: true
        },
        nextRefillDate: {
            type: Date
        }
    }]
}, { timestamps: true });

export default mongoose.model('UserMedicine', UserMedicineSchema);
