import { getUserMedicines, deleteUserMedicine, updateUserMedicineStock, updateUserMedicineReminders, recordDoseByName, getActiveReminders, removeReminderFromRedis } from '../controllers/userMedicineController.js';
import { protect } from '../middleware/authMiddleware.js';
import express from 'express';
const router = express.Router();

router.get('/medicines', protect, getUserMedicines);
router.get('/medicines/reminders/active', protect, getActiveReminders);
router.delete('/medicines/reminders/active', protect, removeReminderFromRedis);
router.post('/medicines/taken', protect, recordDoseByName);
router.delete('/medicines/:id', protect, deleteUserMedicine);
router.put('/medicines/:id/stock', protect, updateUserMedicineStock);
router.put('/medicines/:id/reminders', protect, updateUserMedicineReminders);

export default router;
