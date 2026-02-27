import InventoryLog from '../models/InventoryLog.js';

// @desc    Get inventory logs
// @route   GET /api/inventory/logs
// @access  Private/Admin
const getInventoryLogs = async (req, res) => {
    try {
        const logs = await InventoryLog.find({})
            .populate('medicine', 'name')
            .populate('performedBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export { getInventoryLogs };
