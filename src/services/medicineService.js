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

/**
 * Advanced fuzzy matching for medicine names.
 * Tries: Exact -> Case-Insensitive -> Partial -> Word-based.
 */
export const findBestMedicineMatch = async (inputName) => {
    if (!inputName) return null;
    const cleanName = inputName.trim();

    // 1. Exact Case-Insensitive Match
    let match = await Medicine.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, 'i') } });
    if (match) return match;

    // 2. Partial Match (Contains) - Sort by length to pick the closest match
    const partialMatches = await Medicine.find({ name: { $regex: new RegExp(cleanName, 'i') } })
        .sort({ name: 1 })
        .limit(10);

    if (partialMatches.length > 0) {
        // Find the one with minimum length difference to the input
        return partialMatches.sort((a, b) =>
            Math.abs(a.name.length - cleanName.length) - Math.abs(b.name.length - cleanName.length)
        )[0];
    }

    // 3. Word-based Token Match (Significant words)
    const tokens = cleanName.split(/\s+/).filter(t => t.length > 2);
    if (tokens.length > 0) {
        const tokenMatches = await Medicine.find({ name: { $regex: new RegExp(`^${tokens[0]}`, 'i') } })
            .sort({ name: 1 })
            .limit(10);

        if (tokenMatches.length > 0) {
            return tokenMatches.sort((a, b) =>
                Math.abs(a.name.length - cleanName.length) - Math.abs(b.name.length - cleanName.length)
            )[0];
        }
    }

    // 4. Advanced Fuzzy Similarity (Bigram)
    const allMeds = await Medicine.find({ currentStock: { $gt: 0 } }).select('name');

    function getSimilarity(s1, s2) {
        const pairs = (s) => {
            const res = new Set();
            for (let i = 0; i < s.length - 1; i++) res.add(s.substring(i, i + 2).toLowerCase());
            return res;
        };
        const pairs1 = pairs(s1);
        const pairs2 = pairs(s2);
        const intersection = new Set([...pairs1].filter(x => pairs2.has(x)));
        return (2.0 * intersection.size) / (pairs1.size + pairs2.size);
    }

    let bestSimilarityMatch = null;
    let maxSimilarity = 0;

    for (const med of allMeds) {
        const sim = getSimilarity(cleanName, med.name);
        if (sim > maxSimilarity && sim > 0.3) { // 30% threshold
            maxSimilarity = sim;
            bestSimilarityMatch = med;
        }
    }

    if (bestSimilarityMatch) {
        return await Medicine.findById(bestSimilarityMatch._id);
    }

    return null;
};
