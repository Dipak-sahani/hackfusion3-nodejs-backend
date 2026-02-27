import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['order_status', 'refill_reminder', 'promo', 'security', 'medicine_reminder', 'medicine_followup'], default: 'order_status' },
    isRead: { type: Boolean, default: false },
    metadata: { type: Object } // Store orderId, etc.
}, {
    timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
