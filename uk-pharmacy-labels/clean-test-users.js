/**
 * Script to clean up test users from the database before running tests
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'server', 'db', 'sqlite', 'pharmacy_system.db');
console.log('Database path:', dbPath);

// Open the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    return console.error('Error opening database:', err.message);
  }
  console.log('Connected to the database');
  
  // Delete test user with username 'testuser' if exists
  db.run('DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username = ?)', ['testuser'], function(err) {
    if (err) {
      console.error('Error deleting user roles:', err.message);
      closeDb();
      return;
    }
    
    console.log(`User roles removed: ${this.changes} row(s) affected`);
    
    // Now delete the user
    db.run('DELETE FROM users WHERE username = ?', ['testuser'], function(err) {
      if (err) {
        console.error('Error deleting user:', err.message);
        closeDb();
        return;
      }
      
      console.log(`Users removed: ${this.changes} row(s) affected`);
      closeDb();
    });
  });
});

// Close the database connection
function closeDb() {
  db.close((err) => {
    if (err) {
      return console.error('Error closing database:', err.message);
    }
    console.log('Database connection closed');
  });
}
