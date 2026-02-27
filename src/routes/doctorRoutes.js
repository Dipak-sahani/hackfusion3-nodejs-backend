import express from 'express';
import {
    registerDoctor,
    loginDoctor,
    updateAvailability,
    getDoctorProfile,
    getDoctorAppointments,
    updateAppointmentStatus,
    addConsultationNotes,
    getAllDoctors
} from '../controllers/doctorController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerDoctor);
router.post('/login', loginDoctor);
router.get('/all', protect, getAllDoctors);

// Protected routes for doctors
router.get('/profile', protect, authorizeRoles('doctor'), getDoctorProfile);
router.post('/availability', protect, authorizeRoles('doctor'), updateAvailability);
router.get('/appointments', protect, authorizeRoles('doctor'), getDoctorAppointments);
router.patch('/appointment/:id/status', protect, authorizeRoles('doctor'), updateAppointmentStatus);
router.post('/appointment/:id/notes', protect, authorizeRoles('doctor'), addConsultationNotes);

export default router;
