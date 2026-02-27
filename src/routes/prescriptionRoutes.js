import express from 'express';
import multer from 'multer';
import path from 'path';
import { protect } from '../middleware/authMiddleware.js';
import {
    getUserPrescriptions,
    confirmPrescription,
    getPendingReviews,
    handleReviewAction,
    uploadPrescription,
    getDoctorAssignedReviews,
    normalizePrescriptionData,
    updatePrescriptionExtractedData
} from '../controllers/prescriptionController.js';

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/prescriptions');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Prescription routes (User)
router.get('/', protect, getUserPrescriptions);
router.post('/upload', protect, upload.single('file'), uploadPrescription);
router.post('/:id/confirm', protect, confirmPrescription);

// Manual Review routes (Admin/Doctor)
router.get('/manual-review/pending', protect, getPendingReviews);
router.post('/manual-review/:id/action', protect, handleReviewAction);
router.get('/doctor/assigned', protect, getDoctorAssignedReviews);
router.post('/manual-review/:id/normalize', protect, normalizePrescriptionData);
router.put('/manual-review/:id/update-data', protect, updatePrescriptionExtractedData);

export default router;
