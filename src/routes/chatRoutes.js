import express from 'express';
import { handleChatMessage } from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/message', protect, handleChatMessage);

export default router;
