import express from 'express';
import { generateDietPlan } from '../controllers/dietController.js';
import { generateExercisePlan } from '../controllers/exerciseController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/diet-plan', protect, generateDietPlan);
router.post('/exercise-plan', protect, generateExercisePlan);

export default router;
