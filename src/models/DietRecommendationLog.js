import mongoose from 'mongoose';

const dietRecommendationLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    medicinesAnalyzed: [{
        name: String,
        category: String,
        dosage: Number
    }],
    recommendation: {
        diet_guidance: String,
        foods_to_include: [String],
        foods_to_avoid: [String],
        hydration_advice: String,
        lifestyle_tips: [String],
        disclaimer: String
    }
}, {
    timestamps: true
});

const DietRecommendationLog = mongoose.model('DietRecommendationLog', dietRecommendationLogSchema);
export default DietRecommendationLog;
