import User from '../models/User.js';
import Notification from '../models/Notification.js';

/**
 * Notifies all users with the 'admin' role about a specific event.
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} metadata - Optional metadata (e.g., medicineId)
 */
export const notifyAdmins = async (title, message, metadata = {}) => {
    try {
        // Find all admin users
        const admins = await User.find({ role: 'admin' });

        if (admins.length === 0) {
            console.warn('No admin users found to notify.');
            return;
        }

        const notifications = admins.map(admin => ({
            user: admin._id,
            title,
            message,
            type: 'order_status', // Could be 'inventory_alert' if we add to enum
            metadata
        }));

        await Notification.insertMany(notifications);
        console.log(`Alert sent to ${admins.length} admins: ${title}`);

    } catch (error) {
        console.error('Error notifying admins:', error);
    }
};
