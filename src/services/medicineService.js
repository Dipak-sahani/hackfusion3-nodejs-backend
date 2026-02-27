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

        return {
            ...med,
            medicineId: matchedMed ? matchedMed._id : null,
            isMatched: !!matchedMed,
            originalName: med.name,
            matchedName: matchedMed ? matchedMed.name : null
        };
    }));

    return normalizedResults;
};
