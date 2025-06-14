const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('./utils/logger');

// Load environment variables
dotenv.config();

// Initialize database
const db = require('./db/init');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Apply security headers
app.use(helmet());

// Configure Content Security Policy
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"], // Required for some functionality
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'", 'localhost:3001', 'http://localhost:3001'],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
}));

// Enable compression to reduce bandwidth usage
app.use(compression());

// Middleware
app.use(cors());   // Allow cross-origin requests
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Apply rate limiting for API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Stricter limit for auth endpoints
  message: { error: 'Too many authentication attempts, please try again after 15 minutes' },
  standardHeaders: true,
});

// General rate limiter for other API endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // increased limit from 50 to 500 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

// API routes with rate limiting
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/users', generalLimiter, require('./routes/users'));
app.use('/api/patients', generalLimiter, require('./routes/patients'));
app.use('/api/wards', generalLimiter, require('./routes/wards'));
app.use('/api/hospitals', generalLimiter, require('./routes/hospitals'));
app.use('/api/test-hospitals', generalLimiter, require('./routes/test-hospitals'));
app.use('/api/orders', generalLimiter, require('./routes/orders'));

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API status route
app.get('/api/status', (req, res) => {
  res.json({
    message: 'Pharmacy System API Server',
    status: 'Running'
  });
});

// Redirect root to login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Add request logging middleware
app.use((req, res, next) => {
  // Get real client IP (handles proxies)
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Extract user ID from JWT if available
  let userId = 'ANONYMOUS';
  if (req.user) {
    userId = req.user.id;
  }
  
  // Log the request
  if (req.path.startsWith('/api/')) {
    logger.logDataAccess(userId, 'API', req.path, {
      method: req.method,
      query: req.query
    }, ip);
  }
  
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  // Get real client IP (handles proxies)
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Extract user ID from JWT if available
  let userId = 'ANONYMOUS';
  if (req.user) {
    userId = req.user.id;
  }
  
  // Log the error
  logger.logError(userId, err, {
    path: req.path,
    method: req.method
  }, ip);
  
  res.status(500).json({ error: 'Internal server error' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong on the server'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Security enhancements enabled: Helmet, Rate Limiting, Logging`);
});

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Closing HTTP server...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  logger.logError('SYSTEM', err, { type: 'uncaughtException' }, 'internal');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.logError('SYSTEM', new Error(reason), { type: 'unhandledRejection' }, 'internal');
});

