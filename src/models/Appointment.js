import mongoose from 'mongoose';

const AppointmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true
    },
    date: {
        type: String, // YYYY-MM-DD
        required: true
    },
    timeSlot: {
        type: String, // e.g., "10:00 AM"
        required: true
    },
    type: {
        type: String,
        enum: ["online", "offline"],
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "confirmed", "completed", "cancelled"],
        default: "pending"
    },
    meetingRoomId: {
        type: String
    },
    meetingLink: {
        type: String
    },
    doctorNotes: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

// Compound index for slot locking and performance
// A doctor cannot have two active appointments at the same time and date
// Partial index allows cancelled slots to be re-booked
AppointmentSchema.index(
    { doctorId: 1, date: 1, timeSlot: 1 },
    {
        unique: true,
        partialFilterExpression: { status: { $ne: 'cancelled' } }
    }
);

export default mongoose.model('Appointment', AppointmentSchema);
