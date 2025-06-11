/**
 * Script to verify admin password and test hash generation
 */
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'server', 'db', 'sqlite', 'pharmacy_system.db');
console.log('Database path:', dbPath);

// Test credentials
const testPassword = 'change_me_immediately';

// Open the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    return console.error('Error opening database:', err.message);
  }
  console.log('Connected to the database');
  
  // Get admin user's password hash
  db.get('SELECT username, email, password_hash FROM users WHERE username = ?', ['admin'], async (err, user) => {
    if (err) {
      console.error('Error finding admin user:', err.message);
      closeDb();
      return;
    }
    
    if (!user) {
      console.error('Admin user not found in the database');
      closeDb();
      return;
    }
    
    console.log('Admin user from database:');
    console.log(`- Username: ${user.username}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Password hash: ${user.password_hash}`);
    
    // Generate a new hash for comparison
    try {
      const saltRounds = 10;
      const newHash = await bcrypt.hash(testPassword, saltRounds);
      console.log(`\nNewly generated hash for '${testPassword}': ${newHash}`);
      
      // Compare test password with stored hash
      const isMatch = await bcrypt.compare(testPassword, user.password_hash);
      console.log(`\nPassword verification result: ${isMatch ? 'MATCH ✓' : 'NO MATCH ✗'}`);
      
      if (!isMatch) {
        // Create an updated hash and query to fix the password
        const updatedHash = await bcrypt.hash(testPassword, saltRounds);
        console.log(`\nTo fix the admin password, run this SQL query:`);
        console.log(`UPDATE users SET password_hash = '${updatedHash}' WHERE username = 'admin';`);
        
        // Apply the fix if needed
        console.log('\nApplying fix to update admin password...');
        db.run('UPDATE users SET password_hash = ? WHERE username = ?', 
          [updatedHash, 'admin'], 
          function(err) {
            if (err) {
              console.error('Error updating password:', err.message);
            } else {
              console.log(`Password updated successfully. Rows affected: ${this.changes}`);
            }
            closeDb();
          });
      } else {
        closeDb();
      }
    } catch (error) {
      console.error('Error with bcrypt operations:', error);
      closeDb();
    }
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
