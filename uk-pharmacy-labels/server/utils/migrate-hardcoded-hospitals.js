/**
 * Migration script to ensure hardcoded hospitals are in the database
 * This script checks if the hardcoded hospitals from data-manager.js exist in the database
 * and adds them if they don't
 */

const path = require('path');
const fs = require('fs');

// Hardcoded hospitals from data-manager.js
const hardcodedHospitals = [
  {
    id: 'south-tyneside',
    name: 'South Tyneside District Hospital',
    address: 'Harton Lane, South Shields, NE34 0PL',
    phone: '0191 4041058'
  },
  {
    id: 'sunderland-royal',
    name: 'Sunderland Royal Hospital',
    address: 'Kayll Road, Sunderland, SR4 7TP',
    phone: '0191 5656256'
  },
  {
    id: 'sunderland-eye',
    name: 'Sunderland Eye Infirmary',
    address: 'Queen Alexandra Road, Sunderland, SR2 9HP',
    phone: '0191 5656256'
  }
];

/**
 * Migrate hardcoded hospitals to database
 * @param {Object} db - Database connection
 * @returns {Promise} - Resolves when migration is complete
 */
function migrateHospitals(db) {
  return new Promise((resolve, reject) => {
    console.log('Checking for hardcoded hospitals in database...');
    
    // Use a counter to track when all operations are complete
    let pendingOperations = hardcodedHospitals.length;
    let errors = [];
    
    // Process each hospital
    hardcodedHospitals.forEach(hospital => {
      // Check if hospital exists
      db.get('SELECT id FROM hospitals WHERE name = ?', [hospital.name], (err, row) => {
        if (err) {
          console.error(`Error checking for hospital ${hospital.name}:`, err.message);
          errors.push(err);
          if (--pendingOperations === 0) {
            if (errors.length > 0) {
              reject(errors);
            } else {
              resolve();
            }
          }
          return;
        }
        
        if (!row) {
          // Hospital doesn't exist, add it
          console.log(`Hospital "${hospital.name}" not found in database. Adding...`);
          
          db.run(
            'INSERT INTO hospitals (name, address) VALUES (?, ?)',
            [hospital.name, hospital.address],
            function(err) {
              if (err) {
                console.error(`Error adding hospital ${hospital.name}:`, err.message);
                errors.push(err);
              } else {
                console.log(`Added hospital: ${hospital.name} with ID ${this.lastID}`);
              }
              
              if (--pendingOperations === 0) {
                if (errors.length > 0) {
                  reject(errors);
                } else {
                  resolve();
                }
              }
            }
          );
        } else {
          console.log(`Hospital "${hospital.name}" already exists in database with ID ${row.id}.`);
          if (--pendingOperations === 0) {
            if (errors.length > 0) {
              reject(errors);
            } else {
              resolve();
            }
          }
        }
      });
    });
  });
}

// Export the migration function
module.exports = { migrateHospitals };
