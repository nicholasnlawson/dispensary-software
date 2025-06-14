/**
 * Test script for verifying encryption functionality in OrderModel
 * This tests that sensitive data is properly encrypted and decrypted
 */
const OrderModel = require('../models/order');
const encryption = require('../utils/encryption');
const uuid = require('uuid');
const { db } = require('../db/init');

// Helper function to ensure test prerequisites
async function ensureTestPrerequisites() {
  // Create a hospital if none exists
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM hospitals LIMIT 1', [], (err, hospital) => {
      if (err) return reject(err);
      
      if (!hospital) {
        // Create a test hospital
        db.run(
          'INSERT INTO hospitals (name, address) VALUES (?, ?)',
          ['Test Hospital', '123 Test St, Testville'],
          function(err) {
            if (err) return reject(err);
            const hospitalId = this.lastID;
            createWard(hospitalId, resolve, reject);
          }
        );
      } else {
        // Hospital exists, check for ward
        db.get('SELECT id FROM wards LIMIT 1', [], (err, ward) => {
          if (err) return reject(err);
          
          if (!ward) {
            createWard(hospital.id, resolve, reject);
          } else {
            // Both hospital and ward exist
            resolve({hospitalId: hospital.id, wardId: ward.id});
          }
        });
      }
    });
  });
}

// Helper function to create a ward
function createWard(hospitalId, resolve, reject) {
  db.run(
    'INSERT INTO wards (name, description, hospital_id) VALUES (?, ?, ?)',
    ['Test Ward', 'For encryption testing', hospitalId],
    function(err) {
      if (err) return reject(err);
      resolve({hospitalId, wardId: this.lastID});
    }
  );
}

// Helper function to run tests
async function runTests() {
  console.log('Starting encryption tests...');
  let testOrderId;

  try {
    // Ensure we have a hospital and ward for testing
    console.log('Setting up test prerequisites...');
    const prereqs = await ensureTestPrerequisites();
    console.log(`Using ward ID: ${prereqs.wardId} from hospital ID: ${prereqs.hospitalId}`);
    
    // Test 1: Create an order with sensitive data
    console.log('\n1. Testing order creation with sensitive data encryption...');
    const orderData = {
      id: uuid.v4(),
      type: 'patient',
      wardId: prereqs.wardId, // Use the ward ID we verified exists
      requester: {
        name: 'Test Nurse',
        role: 'Registered Nurse'
      },
      notes: 'CONFIDENTIAL: Patient has allergies',
      patient: {
        name: 'Test Patient',
        dob: '1980-01-01',
        nhs: 'NHS12345',
        hospitalId: 'H12345'
      },
      medications: [
        {
          name: 'Paracetamol',
          form: 'Tablet',
          strength: '500mg',
          quantity: 20
        }
      ]
    };

    const createResult = await OrderModel.createOrder(orderData);
    console.log('Order created successfully:', createResult.success);
    testOrderId = orderData.id;

    // Test 2: Verify encryption directly in the database
    console.log('\n2. Verifying encryption directly in the database...');
    
    // Get raw order data from database
    const rawOrderPromise = new Promise((resolve, reject) => {
      db.get('SELECT notes FROM orders WHERE id = ?', [testOrderId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
    
    // Get raw patient data from database
    const rawPatientPromise = new Promise((resolve, reject) => {
      db.get('SELECT patient_name, patient_dob FROM order_patients WHERE order_id = ?', [testOrderId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    const [rawOrder, rawPatient] = await Promise.all([rawOrderPromise, rawPatientPromise]);
    
    // The encrypted data should not match the original
    console.log('Database stored notes:', rawOrder.notes);
    console.log('Original notes:', orderData.notes);
    console.log('Notes are encrypted:', rawOrder.notes !== orderData.notes);
    
    console.log('Database stored patient name:', rawPatient.patient_name);
    console.log('Original patient name:', orderData.patient.name);
    console.log('Patient name is encrypted:', rawPatient.patient_name !== orderData.patient.name);

    // Test 3: Verify decryption when retrieving order
    console.log('\n3. Verifying decryption when retrieving order...');
    const retrievedOrder = await OrderModel.getOrderById(testOrderId);
    
    console.log('Retrieved notes:', retrievedOrder.notes);
    console.log('Notes decryption successful:', retrievedOrder.notes === orderData.notes);
    
    console.log('Retrieved patient name:', retrievedOrder.patient.name);
    console.log('Patient name decryption successful:', retrievedOrder.patient.name === orderData.patient.name);
    
    // Test 4: Verify list query decryption
    console.log('\n4. Verifying decryption in list queries...');
    const orders = await OrderModel.getOrders({ limit: 10 });
    const listedOrder = orders.find(o => o.id === testOrderId);
    
    console.log('Listed notes:', listedOrder.notes);
    console.log('Notes decryption in list successful:', listedOrder.notes === orderData.notes);
    
    console.log('Listed patient name:', listedOrder.patient.name);
    console.log('Patient name decryption in list successful:', listedOrder.patient.name === orderData.patient.name);

    // Test 5: Update order with new encrypted values
    console.log('\n5. Testing order update with encryption...');
    const updateResult = await OrderModel.updateOrder(testOrderId, {
      notes: 'UPDATED: Patient has severe allergies',
      status: 'processing' // Using a valid status value from the allowed list
    });
    
    console.log('Order updated successfully:', updateResult.success);
    
    // Verify update encryption
    const updatedOrder = await OrderModel.getOrderById(testOrderId);
    console.log('Updated notes:', updatedOrder.notes);
    console.log('Updated notes match:', updatedOrder.notes === 'UPDATED: Patient has severe allergies');
    
    console.log('\nAll encryption tests completed successfully!');

  } catch (error) {
    console.error('Error during encryption test:', error);
  } finally {
    // Clean up test data
    if (testOrderId) {
      try {
        await OrderModel.deleteOrder(testOrderId);
        console.log('\nTest order deleted.');
      } catch (error) {
        console.error('Error cleaning up test order:', error);
      }
    }
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error in encryption tests:', error);
});
