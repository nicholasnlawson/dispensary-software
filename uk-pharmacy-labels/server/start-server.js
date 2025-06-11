/**
 * Pharmacy System Server Startup Script
 * This script initializes and starts the server
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Ensure .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env file not found. Creating default .env file...');
  
  const defaultEnv = 
`JWT_SECRET=your_secure_jwt_secret_key_change_this_in_production
TOKEN_EXPIRY=24h
PORT=3000`;

  fs.writeFileSync(envPath, defaultEnv);
  console.log('Default .env file created');
}

// Load environment variables
dotenv.config();

// Initialize database
console.log('Initializing database...');
const db = require('./db/init');

// Start server
console.log('Starting server...');
require('./server');

console.log(`Server should be available at http://localhost:${process.env.PORT || 3000}`);
console.log('Default admin credentials: username=admin, password=change_me_immediately');
console.log('IMPORTANT: Change the default admin password as soon as possible!');
