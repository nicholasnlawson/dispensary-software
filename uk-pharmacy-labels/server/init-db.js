/**
 * Database Initialization Script
 * Run this script once to set up the authentication database
 */

// Import database initialization module
const { initialize, db } = require('./db/init');

// Log the start of the initialization process
console.log('Starting database initialization...');

// Run the initialization
initialize()
  .then(() => {
    console.log('Database initialization completed successfully.');
    console.log('Default admin user created:');
    console.log('Username: admin');
    console.log('Password: change_me_immediately');
    console.log('IMPORTANT: Change this password immediately after first login!');
    // Close the database connection before exiting
    db.close(() => {
      console.log('Database connection closed');
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error('Database initialization failed:', err);
    // Close the database connection before exiting
    db.close(() => {
      process.exit(1);
    });
  });
