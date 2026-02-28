import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'customer', 'doctor'], default: 'customer' },
    phone: { type: String },
    address: { type: String },
    dateOfBirth: { type: Date }, // Added for medical age verification
    fcmToken: { type: String }, // For push notifications
    familyMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember' }],

    // Doctor specific fields
    specialization: { type: String },
    mode: {
        type: [String],
        enum: ["online", "offline"],
        default: ["online"]
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    availability: [{
        date: {
            type: String, // YYYY-MM-DD
        },
        slots: [{
            type: String // e.g., "10:00 AM", "02:30 PM"
        }]
    }]
}, {
    timestamps: true
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (err) {
        throw err;
    }
});

const User = mongoose.model('User', userSchema);
export default User;
