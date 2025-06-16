/**
 * Temporary script to start the server with a specific database path
 */
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for database path
rl.question('Enter the full path to your production database file: ', (dbPath) => {
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
  
  // Close readline interface
  rl.close();
});
