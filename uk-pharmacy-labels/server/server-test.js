/**
 * UK Pharmacy Label Generator
 * Test Server with SQLite Database
 */

// Load environment variables
require('dotenv').config();

// Import dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Import database adapter
const { adapter, initializeDatabase } = require('./db/sqlite-adapter');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const systemRoutes = require('./routes/system');

// Create Express app
const app = express();

// Set port
const PORT = process.env.PORT || 3000;

// Replace the database pool with our SQLite adapter in the global scope
// This way all routes will use SQLite without modifying their code
global.pool = adapter;

// Also make the adapter available as app.locals.db for route handlers that expect it there
app.locals.db = adapter;

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*', // Allow all origins for testing
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (if needed)
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);

// Test API endpoint to verify database connectivity
app.get('/api/test-db', async (req, res) => {
  try {
    console.log('Testing database connection...');
    const result = await adapter.query('SELECT * FROM users LIMIT 1');
    res.json({
      success: true,
      message: 'Database connection successful',
      data: {
        rowCount: result.rows.length,
        sampleUser: result.rows.length > 0 ? {
          id: result.rows[0].id,
          username: result.rows[0].username,
          accessLevels: result.rows[0].access_levels
        } : null
      }
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? '🥞' : error.stack
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'NHS Pharmacy Label Generator API - TEST MODE',
    status: 'online',
    version: '1.0.0',
    mode: 'TEST - SQLite Database'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Server error',
    message: err.message
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize SQLite database
    await initializeDatabase();
    
    // Global error handler middleware - add before starting the server
    app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Server error',
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
      });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`
========================================================
  NHS Pharmacy Label Generator API - TEST SERVER
  Running on: http://localhost:${PORT}
  Mode: TEST (SQLite Database)
  
  Default admin login:
  Username: admin
  Password: admin
  
  IMPORTANT: Change this password after first login!
========================================================
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
