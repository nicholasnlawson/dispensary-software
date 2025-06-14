/**
 * Check database schema - debugging script
 */
const { db } = require('./db/init');

// Query to get table structure for hospitals table
db.all(`PRAGMA table_info(hospitals);`, [], (err, columns) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('Hospitals table structure:');
  console.log(JSON.stringify(columns, null, 2));
});

// Query to get a sample hospital record
db.get(`SELECT * FROM hospitals LIMIT 1;`, [], (err, hospital) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('Sample hospital record:');
  console.log(JSON.stringify(hospital, null, 2));
});
