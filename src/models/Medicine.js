import mongoose from 'mongoose';

const MedicineSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true // Optimized for search
    },
    totalOrderedQuantity: {
        type: Number,
        default: 0
    },
    currentStock: {
        type: Number,
        default: 0
    },
    dailyConsumption: {
        type: Number,
        default: 1 // Default to 1 tablet/unit per day
    },
    unit: {
        type: String, // e.g., 'tablet', 'strip', 'bottle'
        default: 'tablet'
    },
    pricePerUnit: {
        type: Number, // Price per unit for order cost calculation
        default: 0
    },
    lastOrderedAt: {
        type: Date,
        default: Date.now
    },
    tabletsPerStrip: {
        type: Number,
        default: 10
    },
    category: {
        type: String, // e.g., 'diabetes', 'BP', 'thyroid', 'general'
        default: 'general',
        index: true
    },
    lowStockThreshold: {
        type: Number,
        default: 50
    },
    isPaused: {
        type: Boolean,
        default: false
    },
    nextRefillDate: {
        type: Date
    },
    requiresPrescription: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

export default mongoose.model('Medicine', MedicineSchema);
