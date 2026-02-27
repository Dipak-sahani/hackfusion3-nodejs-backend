import cron from 'node-cron';
import UserMedicine from '../models/UserMedicine.js';
import DoseLog from '../models/DoseLog.js';
import { sendUserNotification } from './notificationService.js';

/**
 * Normalizes time string to HH:mm format
 * @param {string} time - Time string
 * @returns {string}
 */
const normalizeTime = (time) => {
    const [hours, minutes] = time.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
};

export const startReminderScheduler = () => {
    // INTERNAL CRON REMOVED - RE-COMMENTED AS PER USER REQUEST
    /*
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        console.log(`[CRON] Checking reminders for ${currentTime}...`);

        try {
            // ... internal logic ...
        } catch (error) {
            console.error('[CRON ERROR] Schedule task failed:', error);
        }
    });
    */

    console.log('Medicine Reminder Scheduler started.');
};
