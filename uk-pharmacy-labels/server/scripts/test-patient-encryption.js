/**
 * Test Script for Patient Data Encryption
 * 
 * This script tests the patient data encryption implementation by:
 * 1. Creating a test patient record with sensitive data
 * 2. Retrieving the record directly from DB to verify encryption
 * 3. Retrieving via model to verify decryption
 * 4. Comparing original and decrypted values to ensure correctness
 */
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbCrypto = require('../utils/db-crypto');
const patientModel = require('../models/patient');

// Variables to store test data
let testPatientId = null;
let originalData = null;
let encryptedData = null;
let decryptedData = null;

// Connect to the database directly (bypassing the model layer)
const dbPath = path.join(__dirname, '../db/sqlite/pharmacy_system.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
});

// Function to fetch a record directly from the database
const getPatientDirectFromDb = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM patients WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Test data for a fictional patient
const testPatient = {
  nhsNumber: '9876543210',
  patientName: 'Test Patient',
  dateOfBirth: '1980-01-01',
  address: '123 Test Street, Testville',
  postcode: 'TE1 1ST',
  medicationDetails: JSON.stringify([
    { name: 'Paracetamol', strength: '500mg', form: 'tablets', dosage: '1-2 tablets four times a day' },
    { name: 'Amoxicillin', strength: '250mg', form: 'capsules', dosage: '1 capsule three times a day' }
  ]),
  ward: 'Test Ward',
  consultantName: 'Dr. Test Doctor'
};

// Run the test
const runTest = async () => {
  try {
    console.log('Starting patient data encryption test...');
    console.log('-'.repeat(40));
    
    // Step 1: Create test patient via model (should encrypt sensitive fields)
    console.log('1. Creating test patient record...');
    originalData = { ...testPatient };
    const createdPatient = await patientModel.createPatient(testPatient, 'test-script', '127.0.0.1');
    testPatientId = createdPatient.id;
    console.log(`   Created patient with ID: ${testPatientId}`);
    
    // Step 2: Retrieve record directly from database to check encryption
    console.log('\n2. Retrieving record directly from database to verify encryption...');
    encryptedData = await getPatientDirectFromDb(testPatientId);
    
    // Check if sensitive fields are encrypted
    const sensitiveFields = patientModel.SENSITIVE_FIELDS;
    const encryptionVerification = {};
    let allFieldsEncrypted = true;
    
    sensitiveFields.forEach(field => {
      if (encryptedData[field] && originalData[field]) {
        // A properly encrypted field shouldn't match the original and should contain the encryption marker ':'
        const isEncrypted = 
          encryptedData[field] !== originalData[field] && 
          encryptedData[field].includes(':');
        
        encryptionVerification[field] = isEncrypted ? '✓ Encrypted' : '✗ NOT ENCRYPTED!';
        if (!isEncrypted) allFieldsEncrypted = false;
      } else {
        encryptionVerification[field] = 'N/A (field missing)';
      }
    });
    
    console.log('   Encryption verification:');
    for (const [field, status] of Object.entries(encryptionVerification)) {
      console.log(`   - ${field}: ${status}`);
    }
    
    if (!allFieldsEncrypted) {
      console.error('   ❌ ERROR: Some sensitive fields are not properly encrypted!');
    } else {
      console.log('   ✅ All sensitive fields are properly encrypted');
    }
    
    // Step 3: Retrieve via model to verify decryption
    console.log('\n3. Retrieving record via model to verify decryption...');
    decryptedData = await patientModel.getPatientById(testPatientId, 'test-script', '127.0.0.1');
    
    // Step 4: Compare original and decrypted values
    console.log('\n4. Comparing original and decrypted values...');
    const comparisonResults = {};
    let allFieldsMatch = true;
    
    sensitiveFields.forEach(field => {
      if (originalData[field] && decryptedData[field]) {
        const matches = originalData[field] === decryptedData[field];
        comparisonResults[field] = matches ? '✓ Match' : '✗ MISMATCH!';
        if (!matches) allFieldsMatch = false;
      } else {
        comparisonResults[field] = 'N/A (field missing)';
      }
    });
    
    console.log('   Field comparison:');
    for (const [field, status] of Object.entries(comparisonResults)) {
      console.log(`   - ${field}: ${status}`);
    }
    
    if (!allFieldsMatch) {
      console.error('   ❌ ERROR: Some decrypted fields do not match the original values!');
    } else {
      console.log('   ✅ All decrypted values match original data');
    }
    
    // Final result
    console.log('\nTEST SUMMARY:');
    if (allFieldsEncrypted && allFieldsMatch) {
      console.log('✅ SUCCESS: Patient data encryption is working correctly!');
    } else {
      console.log('❌ FAILURE: Patient data encryption has issues that need to be fixed.');
    }
    
    // Cleanup - delete the test patient
    console.log('\nCleaning up - deleting test patient...');
    await patientModel.deletePatient(testPatientId, 'test-script', '127.0.0.1');
    console.log('Test patient deleted successfully.');
    
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    db.close();
  }
};

runTest().then(() => console.log('Test completed.'));
