import express from 'express';
import {
    getMedicines,
    getMedicineById,
    createMedicine,
    updateMedicine,
    deleteMedicine,
    stopMedicine,
    startMedicine,
    confirmDose,
    toggleMedicinePrescriptionRequirement
} from '../controllers/medicineController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(getMedicines).post(protect, admin, createMedicine);
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
