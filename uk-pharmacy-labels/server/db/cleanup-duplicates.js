/**
 * Script to clean up duplicate wards and hospitals in the database
 * Run with: node server/db/cleanup-duplicates.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure SQLite directory exists
const dbDir = path.join(__dirname, 'sqlite');
if (!fs.existsSync(dbDir)) {
    console.log('Database directory does not exist. Creating it...');
    fs.mkdirSync(dbDir, { recursive: true });
}

// Database path - match the path used in init.js
const dbPath = path.join(dbDir, 'pharmacy_system.db');

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the database.');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Start a transaction
db.serialize(() => {
  db.run('BEGIN TRANSACTION');

  try {
    // 1. Identify duplicate hospitals by name
    console.log('Identifying duplicate hospitals...');
    db.all(`
      SELECT name, COUNT(*) as count, MIN(id) as keep_id
      FROM hospitals
      GROUP BY name
      HAVING COUNT(*) > 1
    `, [], (err, duplicateHospitals) => {
      if (err) {
        console.error('Error finding duplicate hospitals:', err.message);
        db.run('ROLLBACK');
        process.exit(1);
      }

      console.log(`Found ${duplicateHospitals.length} duplicate hospital names`);

      // Process each duplicate hospital
      let processed = 0;
      
      if (duplicateHospitals.length === 0) {
        processDuplicateWards();
        return;
      }

      duplicateHospitals.forEach(hospital => {
        console.log(`Processing duplicate hospital: ${hospital.name} (keeping ID: ${hospital.keep_id})`);
        
        // Update wards to point to the hospital we're keeping
        db.run(`
          UPDATE wards
          SET hospital_id = ?
          WHERE hospital_id IN (
            SELECT id FROM hospitals
            WHERE name = ? AND id != ?
          )
        `, [hospital.keep_id, hospital.name, hospital.keep_id], function(err) {
          if (err) {
            console.error(`Error updating wards for hospital ${hospital.name}:`, err.message);
            db.run('ROLLBACK');
            process.exit(1);
          }
          
          console.log(`Updated ${this.changes} wards to point to hospital ID ${hospital.keep_id}`);
          
          // Delete duplicate hospitals
          db.run(`
            DELETE FROM hospitals
            WHERE name = ? AND id != ?
          `, [hospital.name, hospital.keep_id], function(err) {
            if (err) {
              console.error(`Error deleting duplicate hospitals for ${hospital.name}:`, err.message);
              db.run('ROLLBACK');
              process.exit(1);
            }
            
            console.log(`Deleted ${this.changes} duplicate hospitals for ${hospital.name}`);
            
            processed++;
            if (processed === duplicateHospitals.length) {
              processDuplicateWards();
            }
          });
        });
      });
    });

    // 2. Identify and remove duplicate wards (same name and hospital_id)
    function processDuplicateWards() {
      console.log('Identifying duplicate wards...');
      db.all(`
        SELECT name, hospital_id, COUNT(*) as count, MIN(id) as keep_id
        FROM wards
        GROUP BY name, hospital_id
        HAVING COUNT(*) > 1
      `, [], (err, duplicateWards) => {
        if (err) {
          console.error('Error finding duplicate wards:', err.message);
          db.run('ROLLBACK');
          process.exit(1);
        }

        console.log(`Found ${duplicateWards.length} duplicate ward entries`);

        // Process each duplicate ward
        let processed = 0;
        
        if (duplicateWards.length === 0) {
          finishCleanup();
          return;
        }

        duplicateWards.forEach(ward => {
          console.log(`Processing duplicate ward: ${ward.name} (hospital_id: ${ward.hospital_id}, keeping ID: ${ward.keep_id})`);
          
          // Update any references to the duplicate wards (e.g., in orders)
          // This would need to be customized based on your schema
          
          // Delete duplicate wards
          db.run(`
            DELETE FROM wards
            WHERE name = ? AND hospital_id = ? AND id != ?
          `, [ward.name, ward.hospital_id, ward.keep_id], function(err) {
            if (err) {
              console.error(`Error deleting duplicate wards for ${ward.name}:`, err.message);
              db.run('ROLLBACK');
              process.exit(1);
            }
            
            console.log(`Deleted ${this.changes} duplicate wards for ${ward.name}`);
            
            processed++;
            if (processed === duplicateWards.length) {
              finishCleanup();
            }
          });
        });
      });
    }

    function finishCleanup() {
      // Commit the transaction
      db.run('COMMIT', (err) => {
        if (err) {
          console.error('Error committing transaction:', err.message);
          db.run('ROLLBACK');
          process.exit(1);
        }
        
        console.log('Cleanup completed successfully!');
        
        // Close the database connection
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
          }
          console.log('Database connection closed.');
          process.exit(0);
        });
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    db.run('ROLLBACK');
    process.exit(1);
  }
});
