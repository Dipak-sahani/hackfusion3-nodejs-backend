import express from 'express';
import { authUser, registerUser, updateFcmToken } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', authUser);
router.post('/register', registerUser);
router.put('/fcm-token', protect, updateFcmToken);

export default router;
