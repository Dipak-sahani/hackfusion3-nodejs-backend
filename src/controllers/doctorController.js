import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import { generateToken } from '../utils/authUtils.js';

// @desc    Register a new doctor
// @route   POST /api/doctor/register
// @access  Public
export const registerDoctor = async (req, res) => {
    const { name, email, password, specialization, mode } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    try {
        const doctorExists = await User.findOne({ email: normalizedEmail });

        if (doctorExists) {
            return res.status(400).json({ message: 'Doctor already exists' });
        }

        const doctor = await User.create({
            name,
            email: normalizedEmail,
            password,
            role: 'doctor',
            specialization,
            mode: mode || ["online"]
        });

        if (doctor) {
            res.status(201).json({
                _id: doctor._id,
                name: doctor.name,
                email: doctor.email,
                specialization: doctor.specialization,
                role: 'doctor',
                token: generateToken(doctor._id, 'doctor')
            });
        } else {
            res.status(400).json({ message: 'Invalid doctor data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auth doctor & get token
// @route   POST /api/doctor/login
// @access  Public
export const loginDoctor = async (req, res) => {
    const { email, password } = req.body;

    try {
        const doctor = await User.findOne({ email });

        if (doctor && (await doctor.matchPassword(password))) {
            res.json({
                _id: doctor._id,
                name: doctor.name,
                email: doctor.email,
                specialization: doctor.specialization,
                role: 'doctor',
                token: generateToken(doctor._id, 'doctor')
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get doctor profile
// @route   GET /api/doctor/profile
// @access  Private (Doctor)
export const getDoctorProfile = async (req, res) => {
    try {
        const doctor = await User.findById(req.user._id).select('-password');
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }
        res.json(doctor);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add or update availability
// @route   POST /api/doctor/availability
// @access  Private (Doctor)
export const updateAvailability = async (req, res) => {
    const { availability } = req.body; // Array of { date, slots }

    try {
        const doctor = await User.findById(req.user._id);

        if (doctor) {
            doctor.availability = availability;
            await doctor.save();
            res.json({ message: 'Availability updated successfully', availability: doctor.availability });
        } else {
            res.status(404).json({ message: 'Doctor not found' });
        }
    } catch (error) {
        console.error("Availability Update Error:", error);
        res.status(500).json({ message: error.message || "Failed to update availability" });
    }
};

// @desc    Get all appointments for logged-in doctor
// @route   GET /api/doctor/appointments
// @access  Private (Doctor)
export const getDoctorAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ doctorId: req.user._id })
            .populate('userId', 'name email phone')
            .sort({ date: 1, timeSlot: 1 });

        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update appointment status
// @route   PATCH /api/doctor/appointment/:id/status
// @access  Private (Doctor)
export const updateAppointmentStatus = async (req, res) => {
    const { status } = req.body;

    try {
        const appointment = await Appointment.findById(req.params.id);

        if (appointment) {
            if (appointment.doctorId.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized' });
            }

            appointment.status = status;
            await appointment.save();
            res.json(appointment);
        } else {
            res.status(404).json({ message: 'Appointment not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add consultation notes
// @route   POST /api/doctor/appointment/:id/notes
// @access  Private (Doctor)
export const addConsultationNotes = async (req, res) => {
    const { notes } = req.body;

    try {
        const appointment = await Appointment.findById(req.params.id);

        if (appointment) {
            if (appointment.doctorId.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized' });
            }

            appointment.doctorNotes = notes;
            await appointment.save();
            res.json(appointment);
        } else {
            res.status(404).json({ message: 'Appointment not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all verified doctors
// @route   GET /api/doctor/all
// @access  Private (User)
export const getAllDoctors = async (req, res) => {
    try {
        const doctors = await User.find({ role: 'doctor' }).select('-password');
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
