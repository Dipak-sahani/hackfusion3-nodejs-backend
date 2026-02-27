import express from 'express';
import { createAIOrder, confirmUserOrder, getUserOrders, getAllOrders } from '../controllers/orderController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/ai-order', protect, createAIOrder);
router.post('/:id/confirm', protect, confirmUserOrder);
router.get('/', protect, getUserOrders);
router.get('/all', protect, admin, getAllOrders);

export default router;
