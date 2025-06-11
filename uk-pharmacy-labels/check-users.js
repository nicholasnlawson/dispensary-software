/**
 * Script to check users in the database
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
  
  // Query users
  db.all('SELECT id, username, email, password_hash FROM users', [], (err, users) => {
    if (err) {
      console.error('Error querying users:', err.message);
      closeDb();
      return;
    }
    
    console.log('\nUsers in the database:');
    if (users.length === 0) {
      console.log('No users found');
    } else {
      users.forEach(user => {
        console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}`);
        console.log(`Password Hash: ${user.password_hash.substring(0, 20)}...`);
      });
    }
    
    // Query roles
    db.all('SELECT id, name FROM roles', [], (err, roles) => {
      if (err) {
        console.error('Error querying roles:', err.message);
        closeDb();
        return;
      }
      
      console.log('\nRoles in the database:');
      if (roles.length === 0) {
        console.log('No roles found');
      } else {
        roles.forEach(role => {
          console.log(`ID: ${role.id}, Name: ${role.name}`);
        });
      }
      
      // Query user_roles
      db.all(
        `SELECT ur.user_id, u.username, ur.role_id, r.name as role_name 
         FROM user_roles ur
         JOIN users u ON ur.user_id = u.id
         JOIN roles r ON ur.role_id = r.id`,
        [],
        (err, userRoles) => {
          if (err) {
            console.error('Error querying user roles:', err.message);
            closeDb();
            return;
          }
          
          console.log('\nUser Roles in the database:');
          if (userRoles.length === 0) {
            console.log('No user roles found');
          } else {
            userRoles.forEach(ur => {
              console.log(`User ${ur.username} (ID: ${ur.user_id}) has role ${ur.role_name} (ID: ${ur.role_id})`);
            });
          }
          
          closeDb();
        }
      );
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
