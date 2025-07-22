// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const app = express();

// Import routes
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const menuRoutes = require('./routes/menuRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const businessRoutes = require('./routes/businessRoutes');
const offerRoutes = require('./routes/offerRoutes');
const publicRoutes = require('./routes/publicRoutes');
const deviceTokenRoutes = require('./routes/deviceTokenRoutes');
const firebaseNotificationRoutes = require('./routes/firebaseNotificationRoutes');
const healthRoutes = require('./routes/healthRoutes');
const errorHandler = require('./middleware/errorHandler');
const { performanceMonitor } = require('./middleware/performanceMonitor');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API
  crossOriginEmbedderPolicy: false // Allow embedding
}));

// Compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses larger than 1KB
}));

// Rate limiting - compatible with express-rate-limit 6.x
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.'
    });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit login attempts
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.'
    });
  }
});

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Conditional logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
  optionsSuccessStatus: 200
}));

// Apply rate limiting
app.use('/api', limiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/users/login', authLimiter);

// Performance monitoring (in all environments for optimized codebase)
app.use(performanceMonitor);

app.get('/', (req, res) => {
  res.json({
    message: 'Pizza API - Optimized',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint - replace with improved health routes
app.use('/api', healthRoutes);

// API routes
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/settings', businessRoutes);
app.use('/api/device-tokens', deviceTokenRoutes);
app.use('/api/notifications', firebaseNotificationRoutes);

// 404 handler - use proper wildcard for Express 4.x compatibility
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handler
app.use(errorHandler);

module.exports = app;