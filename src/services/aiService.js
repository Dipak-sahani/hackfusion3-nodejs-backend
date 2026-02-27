import axios from 'axios';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

/**
 * Calls FastAPI to get AI-generated diet recommendations
 * @param {Array} medicines - Array of objects { name, category, dosage }
 * @returns {Promise<Object>} - The AI recommendation
 */
export const getDietRecommendation = async (medicines) => {
    try {
        const response = await axios.post(`${FASTAPI_URL}/diet-recommendation`, {
            medicines
        });
        return response.data;
    } catch (error) {
        console.error('Error calling AI Diet Service:', error.response?.data || error.message);
        throw new Error('Could not get AI diet recommendation');
    }
};

/**
 * Calls FastAPI to get AI-generated exercise and yoga recommendations
 * @param {Array} medicines - Array of objects { name, category }
 * @returns {Promise<Object>} - The AI recommendation
 */
export const getExerciseRecommendation = async (medicines) => {
    try {
        const response = await axios.post(`${FASTAPI_URL}/exercise-recommendation`, {
            medicines
        });
        return response.data;
    } catch (error) {
        console.error('Error calling AI Exercise Service:', error.response?.data || error.message);
        throw new Error('Could not get AI exercise recommendation');
    }
};
