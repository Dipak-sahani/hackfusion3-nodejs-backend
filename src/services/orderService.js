import PreOrder from '../models/PreOrder.js';
import Medicine from '../models/Medicine.js';
import UserMedicine from '../models/UserMedicine.js';
import InventoryLog from '../models/InventoryLog.js';
import Prescription from '../models/Prescription.js';
import { normalizeToTablet, calculateRefillDate } from '../utils/medicineUtils.js';

// Create a Draft Order (PreOrder) from AI output
export const createDraftOrder = async (userId, orderItems) => {
    let totalEstimatedAmount = 0;
    const processedItems = [];

    // 1. Calculate totals and validate items
    for (const item of orderItems) {
        // Find existing medicine to get price/unit defaults
        const existingMedicine = await Medicine.findOne({
            name: { $regex: new RegExp(`^${item.medicineName}$`, 'i') } // Case insensitive exact match or similar
        });

        const unit = item.unit || existingMedicine?.unit || 'tablet';
        const price = existingMedicine?.pricePerUnit || 10; // Default Mock Price if not found

        // Use quantityConverted if available (from AI), otherwise use raw quantity
        const effectiveQuantity = item.quantityConverted || item.quantity;

        // STOCK VALIDATION: Check if medicine exists and has enough stock
        if (!existingMedicine) {
            throw new Error(`Medicine "${item.medicineName}" not found in global catalog.`);
        }

        if (existingMedicine.currentStock < effectiveQuantity) {
            throw new Error(`Insufficient stock for "${item.medicineName}". Requested: ${effectiveQuantity}, Available: ${existingMedicine.currentStock}`);
        }

        const cost = price * effectiveQuantity;
        totalEstimatedAmount += cost;

        processedItems.push({
            medicine: existingMedicine?._id, // Link if exists
            medicineName: item.medicineName,
            quantity: effectiveQuantity,
            unit: 'tablet', // Everything is normalized to tablets in the draft now
            rawQuantity: item.quantity,
            rawUnit: unit,
            pricePerUnit: price,
            dailyConsumption: item.dailyConsumption,
            reminderTimes: item.reminderTimes
        });
    }

    // 2. Create PreOrder
    const preOrder = new PreOrder({
        user: userId,
        items: processedItems,
        totalAmount: totalEstimatedAmount,
        status: 'draft',
        validationErrors: totalEstimatedAmount > 5000 ? ['High Value Order'] : []
    });

    await preOrder.save();
    return preOrder;
};

// Legacy support placeholders
export const createPreOrderFromText = async (userId, text) => {
    // Basic implementation if logic was lost
    // Checks text for keywords and returns possible order items
    return {
        items: [],
        totalAmount: 0,
        validationErrors: ["AI ordering logic moved to FastAPI"]
    };
};

export const confirmOrder = async (orderId, userId) => {
    // 1. Find the PreOrder
    const preOrder = await PreOrder.findOne({ _id: orderId, user: userId });

    if (!preOrder) {
        throw new Error('Order not found');
    }

    if (preOrder.status === 'confirmed') {
        return preOrder; // Already confirmed, return as is (idempotent)
    }

    if (preOrder.status !== 'draft' && preOrder.status !== 'validated') {
        throw new Error(`Order cannot be confirmed. Current status: ${preOrder.status}`);
    }

    // 1.5 Verify approved prescription only if REQUIRED by any medicine in the order
    let prescriptionRequired = false;
    for (const item of preOrder.items) {
        const medicine = await Medicine.findOne({
            name: { $regex: new RegExp(`^${item.medicineName}$`, 'i') }
        });
        if (medicine && medicine.requiresPrescription !== false) {
            prescriptionRequired = true;
            break;
        }
    }

    if (prescriptionRequired) {
        const hasApprovedPrescription = await Prescription.findOne({
            userId,
            aiVerificationStatus: 'AI_APPROVED'
        });

        if (!hasApprovedPrescription) {
            throw new Error('This order contains medicines that require an approved prescription. Please upload and verify your prescription first.');
        }
    }

    // 1.7 STRICT STOCK CHECK: Verify all items are still in stock before proceeding
    for (const item of preOrder.items) {
        const medicine = await Medicine.findOne({
            name: { $regex: new RegExp(`^${item.medicineName}$`, 'i') }
        });
        if (!medicine) {
            throw new Error(`Medicine "${item.medicineName}" not found in global catalog.`);
        }
        if (medicine.currentStock < item.quantity) {
            throw new Error(`Insufficient stock for "${item.medicineName}". Available: ${medicine.currentStock}, Requested: ${item.quantity}`);
        }
    }

    // 2. Update Stock
    // Map PreOrder items to format expected by updateMedicineStock
    // PreOrder items have: medicineName, quantity, unit, pricePerUnit, _dailyConsumption
    const orderItems = preOrder.items.map(item => ({
        medicineName: item.medicineName,
        quantity: item.quantity,
        unit: item.unit,
        dailyConsumption: item.dailyConsumption,
        reminderTimes: item.reminderTimes
    }));

    await updateMedicineStock(userId, orderItems, orderId);

    // 3. Update PreOrder Status
    preOrder.status = 'confirmed';
    await preOrder.save();

    return preOrder;
};

export const updateMedicineStock = async (userId, orderItems, orderId = null) => {
    try {
        let userMedicine = await UserMedicine.findOne({ userId });

        if (!userMedicine) {
            userMedicine = new UserMedicine({ userId, medicines: [] });
        } else {
            // FIX: Filter out legacy records that don't match new schema (missing 'medicine' field)
            // This auto-migrates/cleans the document to prevent validation errors on save
            const validMedicines = userMedicine.medicines.filter(m => m.medicine);
            if (validMedicines.length !== userMedicine.medicines.length) {
                console.log(`Removed ${userMedicine.medicines.length - validMedicines.length} invalid legacy medicine entries for user ${userId}`);
                userMedicine.medicines = validMedicines;
            }
        }

        for (const item of orderItems) {
            let medicineDoc;
            // 1. Find or Create Global Medicine (Admin Catalog)
            const existingMedicine = await Medicine.findOne({
                name: { $regex: new RegExp(`^${item.medicineName}$`, 'i') }
            });

            if (existingMedicine) {
                medicineDoc = existingMedicine;

                // 2. Normalize quantity for global tracking (sale is always in tablets now)
                const tabletsPerStrip = medicineDoc.tabletsPerStrip || 10;
                const normalizedQuantity = normalizeToTablet(item.quantity, item.unit, tabletsPerStrip);

                // Update Global Stats
                medicineDoc.totalOrderedQuantity += normalizedQuantity;
                medicineDoc.lastOrderedAt = new Date();

                // DECREMENT Global Stock (Admin Inventory)
                if (medicineDoc.currentStock >= normalizedQuantity) {
                    medicineDoc.currentStock -= normalizedQuantity;
                } else {
                    throw new Error(`Insufficient stock during confirmation for ${medicineDoc.name}. Available: ${medicineDoc.currentStock}, Requested: ${normalizedQuantity}`);
                }

                await medicineDoc.save();

                // 3. LOG THE TRANSACTION (InventoryLog)
                await InventoryLog.create({
                    medicine: medicineDoc._id,
                    changeAmount: -normalizedQuantity, // Negative for sale
                    reason: 'sale',
                    orderId: orderId,
                    performedBy: null // System sale (customer purchase)
                });

            } else {
                // If by any chance it's missing (e.g. deleted from catalog between draft and confirm)
                throw new Error(`Medicine "${item.medicineName}" no longer exists in catalog.`);
            }

            // 2. Update User Personal Inventory (UserMedicine)
            // Normalize quantity based on medicineDoc.tabletsPerStrip
            const tabletsPerStrip = medicineDoc.tabletsPerStrip || 10;
            const normalizedQuantity = normalizeToTablet(item.quantity, item.unit, tabletsPerStrip);

            // Check if user already tracks this medicine to prevent duplicates
            const userMedIndex = userMedicine.medicines.findIndex(m =>
                m.medicine && m.medicine.toString() === medicineDoc._id.toString()
            );

            if (userMedIndex > -1) {
                // MEDICINE EXISTS: Increment the existing quantity (totalTablets)
                console.log(`Incrementing stock (tablets) for ${medicineDoc.name} in user ${userId}'s inventory.`);

                // Keep both for transition if needed, but primary is totalTablets now
                userMedicine.medicines[userMedIndex].totalTablets += normalizedQuantity;
                userMedicine.medicines[userMedIndex].userStock = userMedicine.medicines[userMedIndex].totalTablets;
                userMedicine.medicines[userMedIndex].initialTablets = userMedicine.medicines[userMedIndex].totalTablets;

                // Update consumption and reminders if provided
                if (item.dailyConsumption) {
                    userMedicine.medicines[userMedIndex].dailyConsumption = item.dailyConsumption;
                }
                if (item.reminderTimes && item.reminderTimes.length > 0) {
                    userMedicine.medicines[userMedIndex].reminderTimes = item.reminderTimes;
                }

                // Recalculate Refill Date
                const currentEntry = userMedicine.medicines[userMedIndex];
                const refillDate = calculateRefillDate(
                    currentEntry.totalTablets,
                    currentEntry.dailyConsumption
                );
                userMedicine.medicines[userMedIndex].nextRefillDate = refillDate;

            } else {
                // MEDICINE DOES NOT EXIST: Create a new record in the array
                console.log(`Adding new medicine ${medicineDoc.name} to user ${userId}'s inventory.`);
                const consumption = item.dailyConsumption || 1;
                const refillDate = calculateRefillDate(normalizedQuantity, consumption);

                userMedicine.medicines.push({
                    medicine: medicineDoc._id,
                    totalTablets: normalizedQuantity,
                    userStock: normalizedQuantity, // Match totalTablets for UI compatibility
                    initialTablets: normalizedQuantity,
                    dailyConsumption: item.dailyConsumption || 1,
                    reminderTimes: item.reminderTimes || [],
                    unit: 'tablet', // Base unit is always tablet now
                    isActive: true,
                    startedAt: new Date(),
                    nextRefillDate: refillDate
                });
            }
        }

        await userMedicine.save();
        console.log(`Updated medicine stock for user ${userId}`);

    } catch (error) {
        console.error('Error updating medicine stock:', error);
        throw error;
    }
};
