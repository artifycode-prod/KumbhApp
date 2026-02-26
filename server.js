const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

// Import database connection
const connectDB = require('./config/database');

// Import middleware
const { apiLimiter, authLimiter, sosLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const sosRoutes = require('./routes/sos');
const lostFoundRoutes = require('./routes/lostFound');
const medicalRoutes = require('./routes/medical');
const volunteerRoutes = require('./routes/volunteer');
const adminRoutes = require('./routes/admin');
const qrRoutes = require('./routes/qrRegistration');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' })); // Increase limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting disabled for development
// Uncomment the line below to enable rate limiting in production
// app.use('/api/', apiLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`, {
    ip: req.ip || req.connection.remoteAddress,
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']?.substring(0, 50)
  });
  
  // Log when response is sent
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    console.log(`✅ ${req.method} ${req.path} - Response sent in ${duration}ms`);
    return originalSend.call(this, data);
  };
  
  next();
});

// Connect to database
connectDB();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 Socket.IO client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 Socket.IO client disconnected:', socket.id);
  });

  // Handle SOS alerts
  socket.on('sos-alert', (data) => {
    console.log('🚨 SOS alert received via Socket.IO');
    io.emit('sos-alert', data);
  });

  // Handle emergency notifications
  socket.on('emergency-notification', (data) => {
    console.log('🚑 Emergency notification received via Socket.IO');
    io.emit('emergency-notification', data);
  });
});

// Make io accessible to routes
app.set('io', io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/medical', medicalRoutes);
app.use('/api/volunteer', volunteerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/qr', qrRoutes);

// Log all registered routes
console.log('\n📋 Registered API Routes:');
console.log('   GET  /api/health');
console.log('   GET  /api/test');
console.log('   GET  /api/qr/test');
console.log('   POST /api/qr/register (PUBLIC - no auth required)');
console.log('   POST /api/auth/register');
console.log('   POST /api/auth/login');
console.log('   POST /api/sos');
console.log('   POST /api/medical/cases');
console.log('   POST /api/lost-found');
console.log('');

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('✅ Health check requested');
  const { isConnected } = require('./config/database');
  res.json({
    status: 'OK',
    message: 'Bharat Kumbh Backend API is running',
    timestamp: new Date().toISOString(),
    database: isConnected() ? 'connected' : 'disconnected'
  });
});

// Simple test endpoint for connectivity
app.get('/api/test', (req, res) => {
  console.log('✅ Test endpoint hit');
  res.json({
    success: true,
    message: 'Server is reachable!',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Bharat Kumbh Backend API',
    version: '1.0.0',
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

// Environment validation (DATABASE_URL or POSTGRES_URI for PostgreSQL)
const requiredEnvVars = ['JWT_SECRET'];
const dbEnvVars = ['DATABASE_URL', 'POSTGRES_URI'];
const hasDbConfig = dbEnvVars.some(envVar => process.env[envVar]);
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file and ensure all required variables are set.');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('⚠️  Continuing in development mode, but some features may not work correctly.');
  }
}
if (!hasDbConfig) {
  console.warn('⚠️  No DATABASE_URL or POSTGRES_URI set - database features will not work.');
}

// Start server
const PORT = process.env.PORT || 5000;

// Set server timeout
server.timeout = 30000; // 30 seconds
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Listen on all interfaces (0.0.0.0) to allow connections from emulator/network
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || '*'}`);
  console.log(`🔗 Server accessible at: http://localhost:${PORT} and http://0.0.0.0:${PORT}`);
  console.log(`📱 For Android emulator, use: http://10.0.2.2:${PORT}`);
  console.log(`\n🧪 Test endpoints:`);
  console.log(`   - http://localhost:${PORT}/api/health`);
  console.log(`   - http://localhost:${PORT}/api/test`);
  console.log(`   - http://localhost:${PORT}/api/qr/test`);
});

module.exports = { app, io };

