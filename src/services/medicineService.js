import Medicine from '../models/Medicine.js';

/**
 * Normalizes extracted medicine names against the global medicine catalog.
 * @param {Array} extractedMedicines - Array of extracted medicine objects { name, dosage, frequency, duration }
 * @returns {Promise<Array>} - Array of normalized medicines with database IDs if found
 */
export const normalizeMedicines = async (extractedMedicines) => {
    if (!extractedMedicines || !Array.isArray(extractedMedicines)) {
        return [];
    }

    const normalizedResults = await Promise.all(extractedMedicines.map(async (med) => {
        // Try to find a match in the global catalog (case-insensitive)
        const matchedMed = await Medicine.findOne({
            name: { $regex: new RegExp(`^${med.name}$`, 'i') }
        });

        if (!matchedMed) {
            try {
                // Log missing medicine
                const MissingMedicine = (await import('../models/MissingMedicine.js')).default;
                const { sendAdminEmail } = await import('./emailService.js');

                const missingRecord = await MissingMedicine.findOneAndUpdate(
                    { name: { $regex: new RegExp(`^${med.name}$`, 'i') } },
                    {
                        $inc: { requestedCount: 1 },
                        $set: { lastRequestedAt: new Date() },
                        $setOnInsert: { name: med.name }
                    },
                    { upsert: true, new: true }
                );

                // Send email notification for new entries or specifically high demand
                if (missingRecord.requestedCount === 1) {
                    await sendAdminEmail(
                        `Missing Medicine Alert: ${med.name}`,
                        `A prescription requested a medicine not currently in the database: ${med.name}.\n\nPlease review and add it to the inventory.`
                    );
                } else if (missingRecord.requestedCount % 5 === 0) { // Reminder every 5 requests
                    await sendAdminEmail(
                        `URGENT Missing Medicine Alert: ${med.name}`,
                        `The medicine "${med.name}" has been requested ${missingRecord.requestedCount} times but is still not in the database.\n\nPlease add it to the inventory ASAP.`
                    );
                }
            } catch (err) {
                console.error('[MEDICINE_SERVICE] Failed to log missing medicine:', err);
            }
        }

        return {
            ...med,
            medicineId: matchedMed ? matchedMed._id : null,
            isMatched: !!matchedMed,
            originalName: med.name,
            matchedName: matchedMed ? matchedMed.name : null,
            unit: matchedMed ? matchedMed.unit : (med.unit || 'tablet'),
            category: matchedMed ? matchedMed.category : (med.category || 'general'),
            image: matchedMed ? matchedMed.image : null,
            pricePerUnit: matchedMed ? (matchedMed.pricePerUnit || matchedMed.priceRec) : 0
        };
    }));

    return normalizedResults;
};
