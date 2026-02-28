import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/authRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import familyMemberRoutes from './routes/familyMemberRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import userMedicineRoutes from './routes/userMedicineRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import debugRoutes from './routes/debugRoutes.js';

const app = express();

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(morgan('dev')); // Logging
app.use(helmet()); // Security headers
// Allow only specific origins
const allowedOrigins = [
  "https://hackfusion-admin.netlify.app",
  "http://localhost:5173"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true // if you need cookies/auth
}));
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/family-members', familyMemberRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/user', userMedicineRoutes); // Mounts to /api/user/medicines via router definition
app.use('/api/ai', aiRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/debug', debugRoutes);

// Routes placeholder
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Core Node API', status: 'running' });
});

export default app;
