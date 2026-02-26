// Vercel serverless function entry point
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import database connection
const connectDB = require('../config/database');

// Import middleware
const { apiLimiter, authLimiter, sosLimiter } = require('../middleware/rateLimiter');

// Import routes
const authRoutes = require('../routes/auth');
const userRoutes = require('../routes/users');
const sosRoutes = require('../routes/sos');
const lostFoundRoutes = require('../routes/lostFound');
const medicalRoutes = require('../routes/medical');
const volunteerRoutes = require('../routes/volunteer');
const adminRoutes = require('../routes/admin');
const qrRoutes = require('../routes/qrRegistration');

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - enable in production
// app.use('/api/', apiLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    console.log(`✅ ${req.method} ${req.path} - Response sent in ${duration}ms`);
    return originalSend.call(this, data);
  };
  
  next();
});

// Connect to database (non-blocking for serverless)
// This will attempt to connect but won't block the server from starting
let dbConnected = false;
let connectionAttempted = false;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;

const attemptConnection = async () => {
  if (dbConnected) return;
  if (!connectionString) {
    console.warn('⚠️ DATABASE_URL or POSTGRES_URI not set - database features will not work');
    return;
  }
  if (!connectionAttempted) {
    connectionAttempted = true;
    try {
      console.log('🔄 Attempting PostgreSQL connection...');
      const p = await connectDB();
      dbConnected = p !== null;
      if (dbConnected) console.log('✅ Database connection established');
    } catch (err) {
      console.error('❌ Database connection failed:', err.message);
      dbConnected = false;
      connectionAttempted = false;
    }
  }
};

// Attempt initial connection
attemptConnection();

// Middleware to ensure DB connection before database operations (Vercel serverless cold start)
const { isConnected } = require('../config/database');
const ensureDb = async (req, res, next) => {
  if (!isConnected() && connectionString) await attemptConnection();
  next();
};
app.use('/api/users', ensureDb);
app.use('/api/auth', ensureDb);
app.use('/api/admin', ensureDb);
app.use('/api/lost-found', async (req, res, next) => {
  if ((req.method === 'POST' || req.method === 'GET') && !isConnected()) await attemptConnection();
  next();
});
app.use('/api/medical', async (req, res, next) => {
  if ((req.method === 'POST' || req.method === 'GET') && !isConnected()) await attemptConnection();
  next();
});
app.use('/api/qr', async (req, res, next) => {
  if (req.method === 'POST' && !isConnected()) await attemptConnection();
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/medical', medicalRoutes);
app.use('/api/volunteer', volunteerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/qr', qrRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    if (!isConnected() && connectionString) {
      await attemptConnection();
    }
    res.json({
      status: 'OK',
      message: 'Bharat Kumbh Backend API is running',
      timestamp: new Date().toISOString(),
      database: isConnected() ? 'connected' : 'disconnected',
      platform: 'Vercel',
      env: {
        hasDatabaseUrl: !!(process.env.DATABASE_URL || process.env.POSTGRES_URI),
        hasJWTSecret: !!process.env.JWT_SECRET,
        nodeEnv: process.env.NODE_ENV || 'not set'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is reachable!',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path
  });
});

// Test login endpoint - to verify if requests reach the server
app.post('/api/test-login', (req, res) => {
  console.log('📥 Test login endpoint hit');
  console.log('📥 Request body:', req.body);
  console.log('📥 Headers:', req.headers);
  
  res.json({
    success: true,
    message: 'Test login endpoint reached successfully',
    receivedData: {
      email: req.body.email,
      hasPassword: !!req.body.password,
      timestamp: new Date().toISOString()
    },
    env: {
      hasJWTSecret: !!process.env.JWT_SECRET,
      hasDatabaseUrl: !!(process.env.DATABASE_URL || process.env.POSTGRES_URI),
      nodeEnv: process.env.NODE_ENV
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Bharat Kumbh Backend API',
    version: '1.0.0',
    platform: 'Vercel',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      sos: '/api/sos',
      lostFound: '/api/lost-found',
      medical: '/api/medical',
      volunteer: '/api/volunteer',
      admin: '/api/admin'
    }
  });
});

// 404 handler
app.use((req, res) => {
  console.log('❌ 404 - Route not found:', req.method, req.path, req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    received: { method: req.method, path: req.path, url: req.originalUrl }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Export the app for Vercel
module.exports = app;

