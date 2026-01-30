/**
 * EasyLink ISP Billing System - Express.js Backend
 * 
 * Main application entry point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import customerAuthRoutes from './routes/customer-auth.js';
import usersRoutes from './routes/users.js';
import customersRoutes from './routes/customers.js';
import packagesRoutes from './routes/packages.js';
import paymentsRoutes from './routes/payments.js';
import billingRoutes from './routes/billing.js';
import remindersRoutes from './routes/reminders.js';
import settingsRoutes from './routes/settings.js';
import areasRoutes from './routes/areas.js';
import routersRoutes from './routes/routers.js';
import reportsRoutes from './routes/reports.js';
import activityRoutes from './routes/activity.js';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/error.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ===========================================
// Security Middleware
// ===========================================

// Helmet for security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many login attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/customer-auth/login', authLimiter);

// ===========================================
// Body Parsing & Compression
// ===========================================

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===========================================
// Logging
// ===========================================

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ===========================================
// Health Check
// ===========================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// ===========================================
// API Routes
// ===========================================

app.use('/api/auth', authRoutes);
app.use('/api/customer-auth', customerAuthRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/areas', areasRoutes);
app.use('/api/routers', routersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/activity', activityRoutes);

// ===========================================
// Error Handling
// ===========================================

app.use(notFoundHandler);
app.use(errorHandler);

// ===========================================
// Start Server
// ===========================================

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   EasyLink ISP Billing API Server         ║
  ╠═══════════════════════════════════════════╣
  ║   Port: ${PORT}                               ║
  ║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(23)}║
  ║   Started: ${new Date().toISOString().slice(0, 19).padEnd(25)}║
  ╚═══════════════════════════════════════════╝
  `);
});

export default app;
