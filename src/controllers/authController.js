import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { generateToken } from '../utils/authUtils.js';

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            // Temporary auto-promotion for amol@gmail.com to ensure admin access
            if (user.email === 'amol@gmail.com' && user.role !== 'admin') {
                console.log(`[AUTH] Auto-promoting ${user.email} to admin`);
                user.role = 'admin';
                await user.save();
            }

            res.json({
                status: 'ok',
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, user.role),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password, role, specialization, mode } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
            role: role || 'customer', // Default to customer if not specified
            specialization,
            mode: mode || (role === 'doctor' ? ["online"] : undefined),
        });

        if (user) {
            res.status(201).json({
                status: 'ok',
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                specialization: user.specialization,
                token: generateToken(user._id, user.role),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.log(error);

        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user FCM token
// @route   PUT /api/auth/fcm-token
// @access  Private
const updateFcmToken = async (req, res) => {
    const { fcmToken } = req.body;

    try {
        const user = await User.findById(req.user._id);

        if (user) {
            console.log(`[AUTH] Updating FCM token for user ${user.email} to: ${fcmToken}`);
            user.fcmToken = fcmToken;
            await user.save();
            console.log(`[AUTH] FCM token saved successfully for ${user.email}`);
            res.json({ message: 'FCM token updated successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error(`[AUTH] Error updating FCM token for ${req.user?._id}:`, error);
        res.status(500).json({ message: error.message });
    }
};

export { authUser, registerUser, updateFcmToken };
