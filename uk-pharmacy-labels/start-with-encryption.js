/**
 * Start server with the production database path and proper encryption key
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from server/.env
const serverEnvPath = path.join(__dirname, 'server', '.env');
if (fs.existsSync(serverEnvPath)) {
  console.log(`Loading environment from ${serverEnvPath}`);
  const serverEnv = dotenv.config({ path: serverEnvPath }).parsed;
  
  // Define the database path
  const dbPath = path.join(__dirname, 'server', 'db', 'sqlite', 'pharmacy_system.db');
  console.log(`Starting server with database path: ${dbPath}`);
  console.log(`Using encryption key from server/.env`);
  
  // Set environment variables
  const env = {
    ...process.env,
    ...serverEnv,  // This includes DATABASE_ENCRYPTION_KEY
    DATABASE_PATH: dbPath,
    PORT: 3000  // Override PORT to match frontend expectations
  };
  
  console.log('Forcing server to run on port 3000 to match frontend configuration');
  
  // Start the server process
  const serverProcess = spawn('node', ['server/start-server.js'], {
    env,
    stdio: 'inherit'
  });
  
  // Handle server process events
  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });
} else {
  console.error(`Error: Server .env file not found at ${serverEnvPath}`);
}
