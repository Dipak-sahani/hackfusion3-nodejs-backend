import express from 'express';
import multer from 'multer';
import {
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
} from '../controllers/medicineController.js';
import { getMissingMedicines, resolveMissingMedicine } from '../controllers/missingMedicineController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.route('/').get(getMedicines).post(protect, admin, createMedicine);
router.route('/missing').get(protect, admin, getMissingMedicines);
router.route('/missing/:id').delete(protect, admin, resolveMissingMedicine);
router.post('/upload', protect, admin, upload.single('file'), uploadMedicines);
router
    .route('/:id')
    .get(getMedicineById)
    .put(protect, admin, updateMedicine)
    .delete(protect, admin, deleteMedicine);

router.post('/stop', protect, stopMedicine);
router.post('/start', protect, startMedicine);
router.post('/confirm-dose', protect, confirmDose);
router.patch('/:id/prescription-requirement', protect, admin, toggleMedicinePrescriptionRequirement);

export default router;
