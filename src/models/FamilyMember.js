import mongoose from 'mongoose';

const familyMemberSchema = new mongoose.Schema({
    parentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    relation: { type: String, required: true }, // e.g., 'Father', 'Mother'
    age: { type: Number },
    medicalHistory: [String], // Simple array of conditions
    currentMedications: [String]
}, {
    timestamps: true
});

const FamilyMember = mongoose.model('FamilyMember', familyMemberSchema);
export default FamilyMember;
