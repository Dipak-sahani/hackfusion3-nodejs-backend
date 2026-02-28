import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import crypto from 'crypto';

// @desc    Book an appointment
// @route   POST /api/appointments/book
// @access  Private (Patient/User)
export const bookAppointment = async (req, res) => {
    const { doctorId, date, timeSlot, type } = req.body;

    try {
        // 1. Validate doctor exists
        const doctor = await User.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        // 2. Slot locking check
        // Check if an active (non-cancelled) appointment already exists for this slot
        const existingAppointment = await Appointment.findOne({
            doctorId,
            date,
            timeSlot,
            status: { $in: ["pending", "confirmed"] }
        });

        if (existingAppointment) {
            return res.status(400).json({ message: 'Slot already booked' });
        }

        // 3. Generate unique Jitsi room name and link if online
        let meetingRoomId = null;
        let meetingLink = null;

        if (type === "online") {
            const randomString = crypto.randomBytes(4).toString('hex');
            meetingRoomId = `healthapp-${doctorId}-${date}-${timeSlot.replace(/[: ]/g, '')}-${randomString}`;
            meetingLink = `https://meet.jit.si/${meetingRoomId}`;
        }

        // 4. Create appointment
        // The unique index in MongoDB will act as a final safety net for concurrency
        const appointment = await Appointment.create({
            userId: req.user._id,
            doctorId,
            date,
            timeSlot,
            type,
            status: 'pending',
            meetingRoomId,
            meetingLink
        });

        res.status(201).json(appointment);

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Slot already booked (concurrency safety)' });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user's appointments
// @route   GET /api/appointments/my
// @access  Private (Patient/User)
export const getMyAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ userId: req.user._id })
            .populate('doctorId', 'name specialization email')
            .sort({ date: -1, timeSlot: -1 });

        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
