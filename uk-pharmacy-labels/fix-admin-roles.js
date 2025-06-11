/**
 * Script to fix admin user roles in the database
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
  
  // Find admin user
  db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, user) => {
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
    
    console.log(`Found admin user with ID: ${user.id}`);
    
    // Find admin role
    db.get('SELECT id FROM roles WHERE name = ?', ['admin'], (err, role) => {
      if (err) {
        console.error('Error finding admin role:', err.message);
        closeDb();
        return;
      }
      
      if (!role) {
        console.error('Admin role not found in the database');
        closeDb();
        return;
      }
      
      console.log(`Found admin role with ID: ${role.id}`);
      
      // Check if user already has the role
      db.get(
        'SELECT * FROM user_roles WHERE user_id = ? AND role_id = ?',
        [user.id, role.id],
        (err, userRole) => {
          if (err) {
            console.error('Error checking user role:', err.message);
            closeDb();
            return;
          }
          
          if (userRole) {
            console.log('Admin user already has admin role. No action needed.');
            closeDb();
            return;
          }
          
          // Assign admin role to admin user
          db.run(
            'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
            [user.id, role.id],
            (err) => {
              if (err) {
                console.error('Error assigning admin role to admin user:', err.message);
                closeDb();
                return;
              }
              
              console.log('Successfully assigned admin role to admin user');
              
              // Verify the role assignment
              db.get(
                `SELECT u.username, r.name as role_name
                FROM users u
                JOIN user_roles ur ON u.id = ur.user_id
                JOIN roles r ON ur.role_id = r.id
                WHERE u.username = ?`,
                ['admin'],
                (err, result) => {
                  if (err) {
                    console.error('Error verifying role assignment:', err.message);
                  } else if (result) {
                    console.log(`Verified: User ${result.username} has role ${result.role_name}`);
                  } else {
                    console.log('Verification failed: Could not find role assignment');
                  }
                  
                  closeDb();
                }
              );
            }
          );
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
