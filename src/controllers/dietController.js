import UserMedicine from '../models/UserMedicine.js';
import DietRecommendationLog from '../models/DietRecommendationLog.js';
import { getDietRecommendation } from '../services/aiService.js';

// @desc    Get AI-generated diet plan based on user medicines
// @route   POST /api/ai/diet-plan
// @access  Private
export const generateDietPlan = async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Fetch user's active medicines with category info
        const userInventory = await UserMedicine.findOne({ userId }).populate({
            path: 'medicines.medicine',
            select: 'name category'
        });

        if (!userInventory || !userInventory.medicines || userInventory.medicines.length === 0) {
            return res.status(404).json({ message: 'No medicines found to generate a diet plan.' });
        }

        // 2. Prepare structured data for AI
        const activeMedicines = userInventory.medicines
            .filter(m => m.isActive)
            .map(m => ({
                name: m.medicine.name,
                category: m.medicine.category || 'general',
                dosage: m.dailyConsumption
            }));

        if (activeMedicines.length === 0) {
            return res.status(400).json({ message: 'No active medicines found. Please activate your medications to get a diet plan.' });
        }

        // 3. Call AI Service
        const recommendation = await getDietRecommendation(activeMedicines);

        // 4. Log for audit
        await DietRecommendationLog.create({
            userId,
            medicinesAnalyzed: activeMedicines,
            recommendation
        });

        res.json(recommendation);

    } catch (error) {
        console.error('Error in generateDietPlan Controller:', error);
        res.status(error.message === 'Could not get AI diet recommendation' ? 502 : 500)
            .json({ message: error.message || 'Server Error generating diet plan' });
    }
};
