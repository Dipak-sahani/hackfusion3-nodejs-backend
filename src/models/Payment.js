import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    transactionId: { type: String }, // e.g., Razorpay/Stripe ID
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PreOrder' }, // Linked order
    method: { type: String } // e.g., 'card', 'upi', 'cash'
}, {
    timestamps: true
});

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
