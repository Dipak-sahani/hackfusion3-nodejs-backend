import Medicine from '../models/Medicine.js';
import UserMedicine from '../models/UserMedicine.js';
import DoseLog from '../models/DoseLog.js';
import InventoryLog from '../models/InventoryLog.js';
import { calculateRefillDate, normalizeToTablet } from '../utils/medicineUtils.js';
import { sendUserNotification } from '../services/notificationService.js';
import * as XLSX from 'xlsx';

// @desc    Get all medicines
// @route   GET /api/medicines
// @access  Public
// @desc    Get all medicines (Global Catalog)
// @route   GET /api/medicines
// @access  Public (Stock info might be limited for public, full for admin)
const getMedicines = async (req, res) => {
    try {
        const medicines = await Medicine.find({});
        const currentDate = new Date();

        const formattedMedicines = medicines.map(med => {
            const medicine = med.toObject();
            const nextRefillDate = medicine.nextRefillDate;
            const currentStock = medicine.currentStock;
            const lowStockThreshold = medicine.lowStockThreshold || 50;
            const isPaused = medicine.isPaused;

            let status = "ACTIVE";
            const refillGone = nextRefillDate && new Date(nextRefillDate) < currentDate;

            if (refillGone) {
                status = "EXPIRED";
            } else if (isPaused) {
                status = "PAUSED";
            } else if (currentStock <= lowStockThreshold) {
                status = "LOW_STOCK";
            }

            if (status === "EXPIRED") {
                medicine.expiredOn = medicine.nextRefillDate;
                medicine.nextRefillDate = null;
            }

            return {
                ...medicine,
                id: medicine._id,
                quantity: medicine.currentStock,
                status
            };
        });

        res.json(formattedMedicines);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get medicine by ID
// @route   GET /api/medicines/:id
// @access  Public
const getMedicineById = async (req, res) => {
    try {
        const med = await Medicine.findById(req.params.id);
        if (med) {
            const medicine = med.toObject();
            const currentDate = new Date();
            let status = "ACTIVE";

            const nextRefillDate = medicine.nextRefillDate;
            const currentStock = medicine.currentStock;
            const lowStockThreshold = medicine.lowStockThreshold || 50;

            const refillGone = nextRefillDate && new Date(nextRefillDate) < currentDate;

            if (refillGone) {
                status = "EXPIRED";
            } else if (medicine.isPaused) {
                status = "PAUSED";
            } else if (currentStock <= lowStockThreshold) {
                status = "LOW_STOCK";
            }

            if (status === "EXPIRED") {
                medicine.expiredOn = medicine.nextRefillDate;
                medicine.nextRefillDate = null;
            }

            res.json({
                ...medicine,
                id: medicine._id,
                quantity: medicine.currentStock,
                status
            });
        } else {
            res.status(404).json({ message: 'Medicine not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a medicine
// @route   POST /api/medicines
// @access  Private/Admin
const createMedicine = async (req, res) => {
    const { name, description, unit, currentStock, pricePerUnit, expiryDate, requiresPrescription, maxQuantityPerUser, tabletsPerStrip } = req.body;

    try {
        // Normalize stock if unit is 'strip'
        const normalizedStock = normalizeToTablet(currentStock, unit, tabletsPerStrip || 10);

        const medicine = new Medicine({
            name,
            description,
            unit: 'tablet', // Base unit is tablet after normalization
            currentStock: normalizedStock,
            pricePerUnit,
            expiryDate,
            requiresPrescription,
            maxQuantityPerUser,
            tabletsPerStrip: tabletsPerStrip || 10
        });

        const createdMedicine = await medicine.save();

        // Log initial inventory
        await InventoryLog.create({
            medicine: createdMedicine._id,
            changeAmount: currentStock,
            reason: 'restock', // Initial stock
            performedBy: req.user._id
        });

        res.status(201).json(createdMedicine);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update medicine
// @route   PUT /api/medicines/:id
// @access  Private/Admin
const updateMedicine = async (req, res) => {
    const { name, description, unit, currentStock, pricePerUnit, expiryDate, requiresPrescription, maxQuantityPerUser, tabletsPerStrip } = req.body;

    try {
        const medicine = await Medicine.findById(req.params.id);

        if (medicine) {
            const finalTabletsPerStrip = tabletsPerStrip || medicine.tabletsPerStrip || 10;

            // Normalize stock if provided
            let normalizedStock = medicine.currentStock;
            if (currentStock !== undefined) {
                // If admin provides a unit, use it; otherwise assume tablet
                normalizedStock = normalizeToTablet(currentStock, unit || 'tablet', finalTabletsPerStrip);
            }

            // Check if stock changed to log it
            if (normalizedStock !== medicine.currentStock) {
                const difference = normalizedStock - medicine.currentStock;
                await InventoryLog.create({
                    medicine: medicine._id,
                    changeAmount: difference,
                    reason: difference > 0 ? 'restock' : 'correction',
                    performedBy: req.user._id
                });
            }

            medicine.name = name || medicine.name;
            medicine.description = description || medicine.description;
            medicine.unit = 'tablet'; // Enforce tablet as base unit
            medicine.currentStock = normalizedStock;
            medicine.pricePerUnit = pricePerUnit || medicine.pricePerUnit;
            medicine.expiryDate = expiryDate || medicine.expiryDate;
            medicine.requiresPrescription = requiresPrescription !== undefined ? requiresPrescription : medicine.requiresPrescription;
            medicine.tabletsPerStrip = finalTabletsPerStrip;
            medicine.maxQuantityPerUser = maxQuantityPerUser || medicine.maxQuantityPerUser;

            const updatedMedicine = await medicine.save();
            res.json(updatedMedicine);
        } else {
            res.status(404).json({ message: 'Medicine not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete medicine
// @route   DELETE /api/medicines/:id
// @access  Private/Admin
const deleteMedicine = async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);

        if (medicine) {
            await medicine.deleteOne(); // Use deleteOne() instead of remove()
            res.json({ message: 'Medicine removed' });
        } else {
            res.status(404).json({ message: 'Medicine not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Stop user medicine
// @route   POST /api/medicine/stop
// @access  Private
const stopMedicine = async (req, res) => {
    const { medicineId } = req.body;
    const userId = req.body.userId || req.user._id;

    try {
        const userMedicine = await UserMedicine.findOne({ userId });
        if (!userMedicine) {
            return res.status(404).json({ message: 'User inventory not found' });
        }

        const medIndex = userMedicine.medicines.findIndex(m => m.medicine.toString() === medicineId);
        if (medIndex === -1) {
            return res.status(404).json({ message: 'Medicine not found in user inventory' });
        }

        userMedicine.medicines[medIndex].isActive = false;
        userMedicine.medicines[medIndex].stoppedAt = new Date();

        await userMedicine.save();
        res.json({ message: 'Medicine stopped successfully', medicine: userMedicine.medicines[medIndex] });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Start/Resume user medicine
// @route   POST /api/medicine/start
// @access  Private
const startMedicine = async (req, res) => {
    const { medicineId } = req.body;
    const userId = req.body.userId || req.user._id;

    try {
        const userMedicine = await UserMedicine.findOne({ userId });
        if (!userMedicine) {
            return res.status(404).json({ message: 'User inventory not found' });
        }

        const medIndex = userMedicine.medicines.findIndex(m => m.medicine.toString() === medicineId);
        if (medIndex === -1) {
            return res.status(404).json({ message: 'Medicine not found in user inventory' });
        }

        const currentMed = userMedicine.medicines[medIndex];

        // Validation
        if (currentMed.dailyConsumption <= 0) {
            return res.status(400).json({ message: 'Daily consumption must be greater than 0 to start medicine' });
        }
        if (currentMed.totalTablets <= 0) {
            return res.status(400).json({ message: 'No stock available. Please refill to start.' });
        }

        userMedicine.medicines[medIndex].isActive = true;
        userMedicine.medicines[medIndex].startedAt = new Date();
        userMedicine.medicines[medIndex].stoppedAt = null;

        // Recalculate refill date
        userMedicine.medicines[medIndex].nextRefillDate = calculateRefillDate(
            currentMed.totalTablets,
            currentMed.dailyConsumption
        );

        await userMedicine.save();
        res.json({ message: 'Medicine started successfully', medicine: userMedicine.medicines[medIndex] });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Confirm dose intake
// @route   POST /api/medicine/confirm-dose
// @access  Private
const confirmDose = async (req, res) => {
    const { logId } = req.body;

    try {
        const log = await DoseLog.findById(logId);
        if (!log) {
            return res.status(404).json({ message: 'Dose log not found' });
        }

        if (log.status === 'taken') {
            return res.status(400).json({ message: 'Dose already confirmed' });
        }

        // 1. Update log status
        log.status = 'taken';
        log.confirmedAt = new Date();
        await log.save();

        // 2. Deduct stock from UserMedicine
        const userMed = await UserMedicine.findOne({ userId: log.userId });
        if (userMed) {
            const medIndex = userMed.medicines.findIndex(m => m.medicine.toString() === log.medicineId.toString());
            if (medIndex > -1) {
                const currentMed = userMed.medicines[medIndex];

                // Deduct consumption
                currentMed.totalTablets = Math.max(0, currentMed.totalTablets - currentMed.dailyConsumption);
                currentMed.userStock = currentMed.totalTablets;

                // Recalculate refill date
                currentMed.nextRefillDate = calculateRefillDate(currentMed.totalTablets, currentMed.dailyConsumption);

                await userMed.save();

                // 3. Low stock alert
                if (currentMed.totalTablets <= currentMed.dailyConsumption * 5) { // Alert if less than 5 days left
                    await sendUserNotification(
                        log.userId,
                        'Low Stock Warning',
                        `You are running low on stock. Only ${currentMed.totalTablets} tablets left.`,
                        'low_stock',
                        { medicineId: log.medicineId }
                    );
                }
            }
        }

        res.json({ message: 'Dose confirmed', log });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle prescription requirement for a medicine
// @route   PATCH /api/medicines/:id/prescription-requirement
// @access  Private/Admin
const toggleMedicinePrescriptionRequirement = async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);

        if (medicine) {
            medicine.requiresPrescription = !medicine.requiresPrescription;
            const updatedMedicine = await medicine.save();
            res.json(updatedMedicine);
        } else {
            res.status(404).json({ message: 'Medicine not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk upload medicines from Excel/CSV
// @route   POST /api/medicines/upload
// @access  Private/Admin
const uploadMedicines = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows || rows.length === 0) {
            return res.status(400).json({ message: 'The uploaded file contains no data rows' });
        }

        // Flexible column name mapping (case-insensitive, trimmed)
        const mapKey = (key) => {
            const k = key.toLowerCase().trim().replace(/[_\-\.]/g, ' ');
            if (k.includes('product name') || k === 'name' || k === 'productname') return 'name';
            if (k.includes('product id') || k === 'productid') return 'productId';
            if (k === 'pzn') return 'pzn';
            if (k.includes('price') || k.includes('price rec') || k === 'pricerec') return 'priceRec';
            if (k.includes('package') || k.includes('package size') || k === 'packagesize') return 'packageSize';
            if (k.includes('description') || k === 'descriptions') return 'description';
            return null;
        };

        const medicines = rows.map(row => {
            const mapped = {};
            for (const [key, value] of Object.entries(row)) {
                const field = mapKey(key);
                if (field) {
                    mapped[field] = field === 'priceRec' ? parseFloat(value) || 0 : String(value).trim();
                }
            }
            return mapped;
        }).filter(m => m.name); // only keep rows that have a product name

        if (medicines.length === 0) {
            return res.status(400).json({ message: 'No valid medicine rows found. Ensure your file has a "product name" column.' });
        }

        const inserted = await Medicine.insertMany(medicines);

        res.status(201).json({
            message: `Successfully uploaded ${inserted.length} medicines`,
            count: inserted.length
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: error.message || 'Failed to process file' });
    }
};

export {
    getMedicines,
    getMedicineById,
    createMedicine,
    updateMedicine,
    deleteMedicine,
    stopMedicine,
    startMedicine,
    confirmDose,
    toggleMedicinePrescriptionRequirement,
    uploadMedicines
};
