import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import programRoutes from './routes/programRoutes.js';
import regulationRoutes from './routes/regulationRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import userRoutes from './routes/userRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import peoPsoRoutes from './routes/peoPsoRoutes.js';
import peoRoutes from './routes/peoRoutes.js';
import psoRoutes from './routes/psoRoutes.js';
import curriculumRoutes from './routes/curriculumRoutes.js';
import curriculumBookRoutes from './routes/curriculumBookRoutes.js';
import minorStreamRoutes from './routes/minorStreamRoutes.js';
import prerequisiteRoutes from './routes/prerequisiteRoutes.js';
import courseAssignmentRoutes from './routes/courseAssignmentRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: '*', // In production, replace with specific frontend domains
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(mongoSanitize());

// Throttling / Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === 'production' ? 250 : 50000, // Relaxed limit in dev to prevent blocking developer refetches
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP. Please try again after 15 minutes.' }
});
app.use('/api', apiLimiter);

// Express JSON parsing with size limitations
app.use(express.json({ limit: '10mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle invalid JSON payloads cleanly before route handlers
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    console.error('[JSON Parse Error]', err.message);
    return res.status(400).json({ message: 'Malformed JSON request body. Please check your input and try again.' });
  }
  next(err);
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date(), app: 'Aditya University OBCPM API' });
});

// Register api routers
app.use('/api/auth', authRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/regulations', regulationRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/peo-pso', peoPsoRoutes);
app.use('/api/peos', peoRoutes);
app.use('/api/psos', psoRoutes);
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/curriculum-books', curriculumBookRoutes);
app.use('/api/minor-streams', minorStreamRoutes);
app.use('/api/prerequisites', prerequisiteRoutes);
app.use('/api/course-assignments', courseAssignmentRoutes);

// Static file serving
import path from 'path';
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ message: `API Endpoint [${req.method}] ${req.originalUrl} not found.` });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[System Error Handler]', err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Database validation failed.',
      errors: Object.values(err.errors || {}).map(val => ({ field: val.path, message: val.message }))
    });
  }

  // Mongoose bad ObjectId format (CastError)
  if (err.name === 'CastError') {
    return res.status(400).json({
      message: `Invalid format for field ${err.path}: "${err.value}". Expected a valid identifier.`
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    return res.status(409).json({
      message: `Duplicate value error: A record with ${field} "${value}" already exists.`
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid authorization token. Access denied.'
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Authorization token expired. Please refresh your session.'
    });
  }

  // Fallback default status
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error. Please contact support.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`[Server] Aditya University MERN Portal Backend online on http://127.0.0.1:${PORT}`);
    });
  } catch (error) {
    console.error(`[Server Start Error] ${error.message}`);
  }
};

startServer();