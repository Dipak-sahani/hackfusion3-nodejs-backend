import express from 'express';
import { getInventoryLogs } from '../controllers/inventoryController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/logs', protect, admin, getInventoryLogs);

export default router;
