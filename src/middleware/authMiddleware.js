import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            // console.log(`[AUTH] Token received: ${token.substring(0, 10)}...`);
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // console.log(`[AUTH] Decoded ID: ${decoded.id}, Role: ${decoded.role}`);

            if (decoded.role === 'doctor') {
                req.user = await Doctor.findById(decoded.id).select('-password');
                if (req.user) req.user.role = 'doctor';
            } else {
                // console.log(decoded.id);

                req.user = await User.findById(decoded.id).select('-password');
            }

            if (!req.user) {
                // console.log(req.user);

                console.log(`[AUTH] User NOT FOUND in DB for ID: ${decoded.id}`);
                return res.status(401).json({ message: 'User not found' });
            }

            next();
        } catch (error) {
            console.error(`[AUTH_ERROR] JWT Verification/User Lookup Failed:`, error.message);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Role (${req.user.role}) is not authorized to access this resource`
            });
        }
        next();
    };
};
const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        console.warn(`[AUTH] Unauthorized admin access attempt by User: ${req.user?._id}, Role: ${req.user?.role}`);
        res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
};

export { protect, admin, authorizeRoles };
