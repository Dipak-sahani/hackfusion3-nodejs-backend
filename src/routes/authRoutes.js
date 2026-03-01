import express from 'express';
import { authUser, registerUser, updateFcmToken, updateProfile } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', authUser);
router.post('/register', registerUser);
router.put('/fcm-token', protect, updateFcmToken);
router.put('/profile', protect, updateProfile);

export default router;
