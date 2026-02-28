import MissingMedicine from '../models/MissingMedicine.js';

// @desc    Get all active missing medicine requests
// @route   GET /api/missing-medicines
// @access  Private/Admin
export const getMissingMedicines = async (req, res) => {
    try {
        const missingMedicines = await MissingMedicine.find({ status: 'PENDING' })
            .sort({ requestedCount: -1, lastRequestedAt: -1 });
        res.json(missingMedicines);
    } catch (error) {
        console.error('Error fetching missing medicines:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Mark a missing medicine as resolved/deleted
// @route   DELETE /api/missing-medicines/:id
// @access  Private/Admin
export const resolveMissingMedicine = async (req, res) => {
    try {
        const missingMedicine = await MissingMedicine.findById(req.params.id);

        if (!missingMedicine) {
            return res.status(404).json({ message: 'Missing medicine not found' });
        }

        // We can either delete or just update status to 'RESOLVED'
        missingMedicine.status = 'RESOLVED';
        await missingMedicine.save();

        res.json({ message: 'Missing medicine marked as resolved' });
    } catch (error) {
        console.error('Error resolving missing medicine:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
