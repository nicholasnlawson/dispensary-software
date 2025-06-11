/**
 * UK Pharmacy System - Secure Database Server
 * For NHS intranet deployment
 */

// Load environment variables
require('dotenv').config();

// Import dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const path = require('path');

// Import route modules
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const systemRoutes = require('./routes/system');

// Initialize Express app
const app = express();

// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// Make db available to routes
app.locals.db = pool;

// Middleware
app.use(helmet()); // Security headers
app.use(express.json()); // Parse JSON requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded requests

// Configure CORS for intranet (update with your intranet domains)
const corsOptions = {
  origin: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5000' 
    : ['https://intranet.nhs.local', 'https://pharmacy.nhs.local'],
  optionsSuccessStatus: 200,
  credentials: true
};
app.use(cors(corsOptions));

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'NHS Pharmacy System API Server' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
