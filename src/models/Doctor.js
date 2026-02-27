import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const DoctorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    specialization: {
        type: String,
        required: true
    },
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
            required: true
        },
        slots: [{
            type: String // e.g., "10:00 AM", "02:30 PM"
        }]
    }]
}, {
    timestamps: true
});

// Hash password before saving
DoctorSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
DoctorSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('Doctor', DoctorSchema);
