import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { generateToken } from '../utils/authUtils.js';

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
    const { email, password, role: selectedRole } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            // STRICT ROLE CHECK: If frontend sends a role, it MUST match the DB role
            if (selectedRole && user.role !== selectedRole) {
                return res.status(403).json({
                    message: `Access Denied. Your account is registered as '${user.role}', not '${selectedRole}'. Please select the correct role and try again.`
                });
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
    console.log(`[AUTH] Registration Request Body:`, JSON.stringify(req.body, null, 2));
    const { name, email, password, role, specialization, mode, age, gender, city } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    try {
        const userExists = await User.findOne({ email: normalizedEmail });

        if (userExists) {
            console.log(`[AUTH] Registration failed: User ${normalizedEmail} already exists`);
            return res.status(400).json({ message: `User with email ${normalizedEmail} already exists` });
        }

        console.log(`[AUTH] Creating user with role: ${role || 'customer'} (intended)`);

        console.log(`[AUTH] Intended Role from Request: "${role}" (Type: ${typeof role})`);

        const userRole = (role && ['admin', 'customer', 'doctor'].includes(role.toLowerCase().trim()))
            ? role.toLowerCase().trim()
            : 'customer';

        console.log(`[AUTH] Final Role assigned to model: "${userRole}"`);

        const user = await User.create({
            name,
            email: normalizedEmail,
            password,
            role: userRole,
            specialization,
            mode: mode || (userRole === 'doctor' ? ["online"] : undefined),
            age,
            gender,
            city,
        });

        if (user) {
            console.log(`[AUTH] User created successfully:`, JSON.stringify({
                id: user._id,
                email: user.email,
                role: user.role
            }, null, 2));
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

// @desc    Update user profile (name, age, gender, city)
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
    const { name, age, gender, city, email } = req.body;

    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (name !== undefined) user.name = name;
        if (age !== undefined) user.age = age;
        if (gender !== undefined) user.gender = gender;
        if (city !== undefined) user.city = city;
        if (email !== undefined) {
            const normalizedEmail = email.toLowerCase().trim();
            // Check if email is already taken by another user
            const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
            if (existing) {
                return res.status(400).json({ message: 'This email is already registered to another account.' });
            }
            user.email = normalizedEmail;
        }

        await user.save();

        console.log(`[AUTH] Profile updated for ${user.email}:`, { name: user.name, age: user.age, gender: user.gender, city: user.city });

        res.json({
            status: 'ok',
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            age: user.age,
            gender: user.gender,
            city: user.city,
        });
    } catch (error) {
        console.error('[AUTH] Error updating profile:', error);
        res.status(500).json({ message: error.message });
    }
};

export { authUser, registerUser, updateFcmToken, updateProfile };
