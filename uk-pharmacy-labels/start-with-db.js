/**
 * Start server with the production database path
 */
const { spawn } = require('child_process');
const path = require('path');

// Define the database path - this is the path to your encrypted database
const dbPath = path.join(__dirname, 'server', 'db', 'sqlite', 'pharmacy_system.db');

console.log(`Starting server with database path: ${dbPath}`);

// Set environment variables
const env = {
  ...process.env,
  DATABASE_PATH: dbPath
};

// Start the server process
const serverProcess = spawn('node', ['server/start-server.js'], {
  env,
  stdio: 'inherit'
});

// Handle server process events
serverProcess.on('error', (err) => {
  console.error('Failed to start server:', err);
});
