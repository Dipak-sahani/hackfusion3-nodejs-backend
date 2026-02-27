import mongoose from 'mongoose';

const preOrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
        medicineName: { type: String }, // Snapshot of name
        quantity: { type: Number, required: true },
        unit: { type: String },
        pricePerUnit: { type: Number },
        dailyConsumption: { type: Number },
        reminderTimes: [{ type: String }]
    }],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'validated', 'confirmed', 'fulfilled', 'cancelled'], default: 'draft' },
    validationErrors: [{ type: String }], // Store safety warnings/errors here
    isPrescriptionVerified: { type: Boolean, default: false }
}, {
    timestamps: true
});

const PreOrder = mongoose.model('PreOrder', preOrderSchema);
export default PreOrder;
