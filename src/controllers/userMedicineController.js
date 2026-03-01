import UserMedicine from '../models/UserMedicine.js';
import { zadd } from '../services/redisService.js';
import User from '../models/User.js';

// @desc    Get user's personal medicine inventory
// @route   GET /api/user/medicines
// @access  Private
export const getUserMedicines = async (req, res) => {
    try {
        const userMedicine = await UserMedicine.findOne({ userId: req.user._id })
            .populate('medicines.medicine', 'name description pricePerUnit image unit category');

        if (!userMedicine) {
            return res.json([]);
        }

        const formattedMedicines = userMedicine.medicines.map(item => {
            // Decoupled Logic: Use snapshot fields first, fallback to populated if needed
            // Actually, we should probably prefer populated if it exists for "live" updates, 
            // but use snapshots if population fails (medicine deleted).
            const medDetails = item.medicine || {}; // Populated object 

            return {
                id: item._id, // Internal ID for UI
                globalId: item.medicine ? item.medicine._id : null,
                name: medDetails.name || item.name || "Unknown Medicine",
                description: medDetails.description || "No description available",
                image: medDetails.image || item.image,
                stock: item.userStock,
                unit: item.unit || medDetails.unit || 'tablet',
                category: item.category || medDetails.category || 'general',
                dailyConsumption: item.dailyConsumption,
                nextRefillDate: item.nextRefillDate,
                reminderTimes: item.reminderTimes || [],
                remindersEnabled: item.remindersEnabled !== false,
                isActive: item.isActive !== false,
                pricePerUnit: item.pricePerUnit || medDetails.pricePerUnit || 0
            };
        });

        const refinedList = formattedMedicines.map(item => {
            const lowStockThreshold = 10; // Consistent with other checks

            // Logic for status - Ensure they match UI constants exactly
            let status = "ACTIVE";

            if (item.nextRefillDate && new Date(item.nextRefillDate) < new Date()) {
                status = "EXPIRED";
            } else if (!item.isActive) {
                status = "PAUSED";
            } else if (item.stock <= lowStockThreshold) {
                status = "LOW_STOCK";
            }

            const daily = item.dailyConsumption || 1;
            const remainingDuration = Math.ceil(item.stock / daily);
            const totalDuration = item.totalDuration || remainingDuration;

            return {
                ...item,
                status,
                remainingDuration,
                totalDuration
            };
        });

        res.json(refinedList);

    } catch (error) {
        console.error('Error fetching user medicines:', error);
        res.status(500).json({ message: 'Server Error fetching inventory' });
    }
};

// @desc    Delete a medicine from user's inventory
// @route   DELETE /api/user/medicines/:id
// @access  Private
export const deleteUserMedicine = async (req, res) => {
    try {
        const userMedicine = await UserMedicine.findOne({ userId: req.user._id });

        if (!userMedicine) {
            return res.status(404).json({ message: 'User inventory not found' });
        }

        const initialLength = userMedicine.medicines.length;
        userMedicine.medicines = userMedicine.medicines.filter(
            m => m.medicine && m.medicine.toString() !== req.params.id
        );

        if (userMedicine.medicines.length === initialLength) {
            return res.status(404).json({ message: 'Medicine not found in user inventory' });
        }

        await userMedicine.save();
        res.json({ message: 'Medicine removed from your inventory' });

    } catch (error) {
        console.error('Error deleting user medicine:', error);
        res.status(500).json({ message: 'Server Error deleting medicine' });
    }
};

// @desc    Manually update medicine stock
// @route   PUT /api/user/medicines/:id/stock
// @access  Private
export const updateUserMedicineStock = async (req, res) => {
    const { newStock } = req.body;
    const medicineId = req.params.id;

    try {
        const userMedicine = await UserMedicine.findOne({ userId: req.user._id });
        if (!userMedicine) {
            return res.status(404).json({ message: 'User inventory not found' });
        }

        const medIndex = userMedicine.medicines.findIndex(m => m.medicine && m.medicine.toString() === medicineId);
        if (medIndex === -1) {
            return res.status(404).json({ message: 'Medicine not found in your inventory' });
        }

        const currentMed = userMedicine.medicines[medIndex];

        // Update stock
        currentMed.totalTablets = Number(newStock);
        currentMed.userStock = currentMed.totalTablets;
        currentMed.initialTablets = currentMed.totalTablets; // Reset initial duration tracking on manual update

        // Recalculate refill date
        const calculateRefillDate = (await import('../utils/medicineUtils.js')).calculateRefillDate;
        currentMed.nextRefillDate = calculateRefillDate(currentMed.totalTablets, currentMed.dailyConsumption);

        await userMedicine.save();

        res.json({
            message: 'Stock updated successfully',
            medicine: {
                id: medicineId,
                stock: currentMed.totalTablets,
                nextRefillDate: currentMed.nextRefillDate
            }
        });

    } catch (error) {
        console.error('Error updating user medicine stock:', error);
        res.status(500).json({ message: 'Server Error updating stock' });
    }
};

/**
 * Helper to get the next occurrence of a time string in IST (+5:30)
 * @param {string} timeStr - e.g., "1:15 am" or "02:30 PM"
 * @param {boolean} forceTomorrow - if true, always schedule for tomorrow (used for rescheduling after dose)
 * @returns {number} - Unix timestamp in seconds
 */
const getNextISTTimestamp = (timeStr, forceTomorrow = false) => {
    const match = timeStr.match(/(\d+)(?::(\d+))?\s*([AP]M)?/i);
    if (!match) return Math.floor(Date.now() / 1000);

    let hours = parseInt(match[1]);
    let minutes = match[2] ? parseInt(match[2]) : 0;
    let ampm = match[3] ? match[3].toUpperCase() : '';

    if (ampm === 'PM' && hours < 12) hours += 12;
    else if (ampm === 'AM' && hours === 12) hours = 0;

    const IST_OFFSET = 5.5 * 3600 * 1000;
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + IST_OFFSET);

    const fireTimeIST = new Date(nowIST);
    fireTimeIST.setHours(hours, minutes, 0, 0);

    // If time has passed today, or if we force tomorrow
    if (forceTomorrow || fireTimeIST < nowIST) {
        fireTimeIST.setDate(fireTimeIST.getDate() + 1);
    }

    // Convert IST back to UTC timestamp
    return Math.floor((fireTimeIST.getTime() - IST_OFFSET) / 1000);
};

// @desc    Update medicine reminder settings
// @route   PUT /api/user/medicines/:id/reminders
// @access  Private
export const updateUserMedicineReminders = async (req, res) => {
    const { reminderTimes, remindersEnabled, dailyConsumption, repeat: repeatInterval } = req.body;
    const medicineId = req.params.id;

    try {
        const userMedicine = await UserMedicine.findOne({ userId: req.user._id });
        if (!userMedicine) {
            return res.status(404).json({ message: 'User inventory not found' });
        }

        const medIndex = userMedicine.medicines.findIndex(m => m.medicine && m.medicine.toString() === medicineId);
        if (medIndex === -1) {
            return res.status(404).json({ message: 'Medicine not found in your inventory' });
        }

        const currentMed = userMedicine.medicines[medIndex];

        if (reminderTimes !== undefined) currentMed.reminderTimes = reminderTimes;
        if (remindersEnabled !== undefined) currentMed.remindersEnabled = remindersEnabled;
        if (dailyConsumption !== undefined) {
            currentMed.dailyConsumption = Number(dailyConsumption);
            // Recalculate refill date if daily consumption changed
            const { calculateRefillDate } = await import('../utils/medicineUtils.js');
            currentMed.nextRefillDate = calculateRefillDate(currentMed.totalTablets, currentMed.dailyConsumption);
        }

        await userMedicine.save();

        // Save to Redis for external scheduler if reminders are enabled
        if (remindersEnabled || currentMed.remindersEnabled) {
            try {
                // Populate medicine for name
                const populated = await UserMedicine.findOne({ userId: req.user._id })
                    .populate('medicines.medicine', 'name');
                const med = populated.medicines.find(m => m.medicine && m.medicine._id.toString() === medicineId);
                const medicineName = med?.medicine?.name || "Medicine";

                // Get user's fcmToken
                const user = await User.findById(req.user._id);
                let fcmToken = user?.fcmToken;

                if (!fcmToken) {
                    console.warn(`[REDIS] No FCM token found for user ${req.user._id}, using fallback 'abc'`);
                    fcmToken = "abc";
                }

                const times = reminderTimes || currentMed.reminderTimes;
                for (const timeStr of times) {
                    const timestamp = getNextISTTimestamp(timeStr);
                    const fireTimeDate = new Date(timestamp * 1000);

                    const payload = JSON.stringify({
                        userId: req.user._id.toString(),
                        fcmToken: fcmToken,
                        medicine: medicineName,
                        time: timeStr,
                        repeat: Number(repeatInterval || currentMed.repeatInterval || 20)
                    });

                    await zadd('reminders', timestamp, payload);
                    console.log(`[REDIS] Added reminder for ${medicineName} at ${fireTimeDate.toLocaleString()} (IST target confirmed)`);
                }
            } catch (err) {
                console.error('Error saving to Redis:', err);
            }
        }

        res.json({
            message: 'Reminder settings updated successfully',
            medicine: {
                id: medicineId,
                reminderTimes: currentMed.reminderTimes,
                remindersEnabled: currentMed.remindersEnabled,
                dailyConsumption: currentMed.dailyConsumption,
                nextRefillDate: currentMed.nextRefillDate
            }
        });

    } catch (error) {
        console.error('Error updating user medicine reminders:', error);
        res.status(500).json({ message: 'Server Error updating reminders' });
    }
};
// @desc    Record dose intake by medicine name
// @route   POST /api/user/medicines/taken
// @access  Private
export const recordDoseByName = async (req, res) => {
    const { medicineName } = req.body;
    const userId = req.user._id.toString();

    if (!medicineName) {
        return res.status(400).json({ message: 'Medicine name is required' });
    }

    try {
        const userMedicine = await UserMedicine.findOne({ userId: req.user._id });

        if (!userMedicine) {
            return res.status(404).json({ message: 'User inventory not found' });
        }

        // Find medicine by static name or populated name (case-insensitive)
        const medIndex = userMedicine.medicines.findIndex(m =>
            (m.name && m.name.toLowerCase() === medicineName.toLowerCase()) ||
            (m.medicine && m.medicine.name && m.medicine.name.toLowerCase() === medicineName.toLowerCase())
        );

        if (medIndex === -1) {
            return res.status(404).json({ message: `Medicine '${medicineName}' not found in your inventory` });
        }

        const currentMed = userMedicine.medicines[medIndex];
        const actualMedName = currentMed.name || (currentMed.medicine && currentMed.medicine.name) || "Medicine";

        // 1. DEDUCT STOCK
        const consumption = currentMed.dailyConsumption || 1;
        currentMed.totalTablets = Math.max(0, currentMed.totalTablets - consumption);
        currentMed.userStock = currentMed.totalTablets;

        // Recalculate refill date
        const { calculateRefillDate } = await import('../utils/medicineUtils.js');
        currentMed.nextRefillDate = calculateRefillDate(currentMed.totalTablets, consumption);

        await userMedicine.save();

        // 2. REDIS LOGIC: Remove today's future reminders and reschedule for tomorrow
        const { zrangebyscore, zrem, zadd } = await import('../services/redisService.js');
        const nowSec = Math.floor(Date.now() / 1000);

        try {
            // Find all future reminders
            const futureReminders = await zrangebyscore('reminders', nowSec, '+inf');

            for (const remStr of futureReminders) {
                const rem = JSON.parse(remStr);

                // Match by userId and medicine name
                if (rem.userId === userId && rem.medicine.toLowerCase() === medicineName.toLowerCase()) {
                    // a) Remove today's remaining reminder
                    await zrem('reminders', remStr);

                    // Reschedule for next day based on time string
                    const nextDayTimestamp = getNextISTTimestamp(rem.time, true);
                    const nextDayDate = new Date(nextDayTimestamp * 1000);

                    // Strict schema as per user request (No timestamp/taken in payload)
                    const newPayload = JSON.stringify({
                        userId: rem.userId,
                        fcmToken: rem.fcmToken,
                        medicine: rem.medicine,
                        time: rem.time,
                        repeat: rem.repeat
                    });

                    await zadd('reminders', nextDayTimestamp, newPayload);
                    console.log(`[REDIS] Rescheduled ${actualMedName} to next day at ${rem.time} (IST: ${nextDayDate.toLocaleString()})`);
                }
            }
        } catch (redisErr) {
            console.error('Redis sync during dose record failed:', redisErr);
        }

        // 3. LOW STOCK CHECK
        const lowStockThreshold = 10; // Simple threshold
        if (currentMed.totalTablets <= lowStockThreshold) {
            try {
                // Get user's fcmToken
                const user = await User.findById(req.user._id);
                const fcmToken = user?.fcmToken || "";

                const lowStockPayload = JSON.stringify({
                    userId,
                    fcmToken,
                    medicine: actualMedName,
                    message: "Stock is low",
                    currentStock: currentMed.totalTablets
                });
                await zadd('low_stock_notifications', nowSec, lowStockPayload);
                console.log(`[REDIS] Low stock notification added for ${actualMedName}`);
            } catch (err) {
                console.error('Error adding low stock notification to Redis:', err);
            }
        }

        // 4. Dose Log for History
        try {
            const DoseLog = (await import('../models/DoseLog.js')).default;
            await DoseLog.create({
                userId: req.user._id,
                medicineId: currentMed.medicine._id,
                scheduledTime: new Date(),
                status: 'taken',
                confirmedAt: new Date()
            });
        } catch (logErr) {
            console.error('Error creating dose log:', logErr);
        }

        res.json({
            message: `Dose of ${actualMedName} recorded successfully`,
            medicineId: currentMed.medicine._id,
            newStock: currentMed.totalTablets,
            nextRefillDate: currentMed.nextRefillDate
        });

    } catch (error) {
        console.error('Error recording dose by name:', error);
        res.status(500).json({ message: 'Server error while recording dose' });
    }
};

// @desc    Get all active reminders from Redis scheduler for the user
// @route   GET /api/user/medicines/reminders/active
// @access  Private
export const getActiveReminders = async (req, res) => {
    const userId = req.user._id.toString();
    console.log(`[REDIS] Fetching active reminders for user: ${userId}`);
    try {
        const { zrange } = await import('../services/redisService.js');
        const allReminders = await zrange('reminders', 0, -1);

        console.log(`[REDIS] Found ${allReminders.length} total reminders in queue`);

        const userReminders = allReminders
            .map(remStr => {
                try {
                    return JSON.parse(remStr);
                } catch (e) {
                    return null;
                }
            })
            .filter(rem => rem && rem.userId === userId);

        console.log(`[REDIS] User has ${userReminders.length} active reminders`);

        // Format for the UI
        const formatted = userReminders.map((rem, index) => ({
            id: `redis-${index}-${rem.medicine}-${rem.time}`,
            medicineName: rem.medicine,
            time: rem.time,
            dailyConsumption: rem.repeat || 1,
            isEnabled: true
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Error fetching active reminders from Redis:', error);
        res.status(500).json({ message: 'Server error while fetching scheduler queue' });
    }
};
// @desc    Remove a specific reminder from Redis scheduler
// @route   DELETE /api/user/medicines/reminders/active
// @access  Private
export const removeReminderFromRedis = async (req, res) => {
    const userId = req.user._id.toString();
    const { medicineName, time } = req.body;

    if (!medicineName || !time) {
        return res.status(400).json({ message: 'Medicine name and time are required' });
    }

    try {
        const { zrange, zrem } = await import('../services/redisService.js');
        const allReminders = await zrange('reminders', 0, -1);

        // Find the exact JSON string to remove
        const stringToRemove = allReminders.find(remStr => {
            try {
                const rem = JSON.parse(remStr);
                return rem.userId === userId && rem.medicine === medicineName && rem.time === time;
            } catch (e) {
                return false;
            }
        });

        if (stringToRemove) {
            await zrem('reminders', stringToRemove);
            console.log(`[REDIS] Removed reminder: ${medicineName} at ${time}`);
            res.json({ message: 'Reminder removed successfully' });
        } else {
            res.status(404).json({ message: 'Reminder not found in scheduler' });
        }
    } catch (error) {
        console.error('Error removing reminder from Redis:', error);
        res.status(500).json({ message: 'Server error while removing reminder' });
    }
};
