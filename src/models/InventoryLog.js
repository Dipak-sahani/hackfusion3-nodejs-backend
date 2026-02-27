import mongoose from 'mongoose';

const inventoryLogSchema = new mongoose.Schema({
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    changeAmount: { type: Number, required: true }, // Negative for sale, positive for restock
    reason: { type: String, enum: ['sale', 'restock', 'correction', 'expiry', 'return'], required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin who did it, or system (null) for sales
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PreOrder' } // Linked order if sale
}, {
    timestamps: true
});

const InventoryLog = mongoose.model('InventoryLog', inventoryLogSchema);
export default InventoryLog;
