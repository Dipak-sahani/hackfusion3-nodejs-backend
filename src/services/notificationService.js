import Notification from '../models/Notification.js';

/**
 * Sends a notification to a specific user
 * @param {string} userId - Target user ID
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (e.g., 'medicine_reminder', 'low_stock')
 * @param {object} metadata - Optional metadata
 */
export const sendUserNotification = async (userId, title, message, type = 'medicine_reminder', metadata = {}) => {
    try {
        const notification = new Notification({
            user: userId,
            title,
            message,
            type,
            metadata
        });

        await notification.save();

        // MOCK: In a real app, integrate with FCM/APNS here
        console.log(`[PUSH NOTIFICATION] To: ${userId} | ${title}: ${message}`);

        return notification;
    } catch (error) {
        console.error('Error sending user notification:', error);
    }
};
