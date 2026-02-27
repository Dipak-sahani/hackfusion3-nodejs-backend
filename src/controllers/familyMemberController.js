import FamilyMember from '../models/FamilyMember.js';
import User from '../models/User.js';

// @desc    Get all family members for logged in user
// @route   GET /api/family-members
// @access  Private
const getFamilyMembers = async (req, res) => {
    try {
        const members = await FamilyMember.find({ parentUser: req.user._id });
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add a family member
// @route   POST /api/family-members
// @access  Private
const addFamilyMember = async (req, res) => {
    const { name, relation, age, medicalHistory, currentMedications } = req.body;

    try {
        const member = new FamilyMember({
            parentUser: req.user._id,
            name,
            relation,
            age,
            medicalHistory,
            currentMedications
        });

        const createdMember = await member.save();

        // Add to user's familyMembers array
        await User.findByIdAndUpdate(req.user._id, {
            $push: { familyMembers: createdMember._id }
        });

        res.status(201).json(createdMember);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a family member
// @route   DELETE /api/family-members/:id
// @access  Private
const deleteFamilyMember = async (req, res) => {
    try {
        const member = await FamilyMember.findOne({ _id: req.params.id, parentUser: req.user._id });

        if (member) {
            await member.deleteOne();

            // Remove from user's familyMembers array
            await User.findByIdAndUpdate(req.user._id, {
                $pull: { familyMembers: req.params.id }
            });

            res.json({ message: 'Family member removed' });
        } else {
            res.status(404).json({ message: 'Family member not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export { getFamilyMembers, addFamilyMember, deleteFamilyMember };
