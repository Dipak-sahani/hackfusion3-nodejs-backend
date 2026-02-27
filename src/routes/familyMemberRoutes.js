import express from 'express';
import { getFamilyMembers, addFamilyMember, deleteFamilyMember } from '../controllers/familyMemberController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(protect, getFamilyMembers).post(protect, addFamilyMember);
router.route('/:id').delete(protect, deleteFamilyMember);

export default router;
