import UserMedicine from '../models/UserMedicine.js';
import ExerciseRecommendationLog from '../models/ExerciseRecommendationLog.js';
import { getExerciseRecommendation } from '../services/aiService.js';

// @desc    Get AI-generated exercise and yoga plan based on user medical profile
// @route   POST /api/ai/exercise-plan
// @access  Private
export const generateExercisePlan = async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Fetch user's active medicines with category info
        const userInventory = await UserMedicine.findOne({ userId }).populate({
            path: 'medicines.medicine',
            select: 'name category'
        });

        if (!userInventory || !userInventory.medicines || userInventory.medicines.length === 0) {
            return res.status(404).json({ message: 'No medical data found to generate an exercise plan.' });
        }

        // 2. Prepare structured data for AI (Medicines as a proxy for conditions)
        const activeMedicines = userInventory.medicines
            .filter(m => m.isActive)
            .map(m => ({
                name: m.medicine.name,
                category: m.medicine.category || 'general'
            }));

        if (activeMedicines.length === 0) {
            return res.status(400).json({ message: 'No active medications found. Please activate your medications to get a personalized plan.' });
        }

        // 3. Call AI Service
        const recommendation = await getExerciseRecommendation(activeMedicines);

        // 4. Log for audit
        await ExerciseRecommendationLog.create({
            userId,
            medicinesAnalyzed: activeMedicines,
            recommendation
        });

        res.json(recommendation);

    } catch (error) {
        console.error('Error in generateExercisePlan Controller:', error);
        res.status(error.message === 'Could not get AI exercise recommendation' ? 502 : 500)
            .json({ message: error.message || 'Server Error generating exercise plan' });
    }
};
