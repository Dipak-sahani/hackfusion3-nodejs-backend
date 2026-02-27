import mongoose from 'mongoose';

const exerciseRecommendationLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    medicinesAnalyzed: [{
        name: String,
        category: String
    }],
    recommendation: {
        exercise_plan: String,
        safe_exercises: [String],
        yoga_poses: [String],
        breathing_exercises: [String],
        duration_recommendations: String,
        safety_notes: [String],
        disclaimer: String
    }
}, {
    timestamps: true
});

const ExerciseRecommendationLog = mongoose.model('ExerciseRecommendationLog', exerciseRecommendationLogSchema);
export default ExerciseRecommendationLog;
