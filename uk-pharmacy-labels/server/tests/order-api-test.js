/**
 * Test script for Order API endpoints
 * Run with: node tests/order-api-test.js
 */

const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:3001';

// Test user credentials
const TEST_USER = {
  username: 'admin',
  password: 'change_me_immediately' // Default admin password
};

// Test order data
const patientOrderData = {
  id: 'TEST123456',
  type: 'patient',
  wardId: 1, // Will need to be updated with a valid ward ID
  patient: {
    name: 'Test Patient',
    dob: '1980-01-01',
    nhs: '123456789',
    hospitalId: 'HOSP001'
  },
  medications: [
    {
      name: 'Paracetamol',
      form: 'Tablets',
      strength: '500mg',
      quantity: '100',
      dose: '1-2 tablets every 4-6 hours'
    },
    {
      name: 'Ibuprofen',
      form: 'Tablets',
      strength: '200mg',
      quantity: '50',
      dose: '1-2 tablets three times daily',
      notes: 'Take with food'
    }
  ],
  requester: {
    name: 'Dr. Test Doctor',
    role: 'doctor'
  },
  notes: 'Test patient order'
};

const wardStockOrderData = {
  id: 'TEST234567',
  type: 'ward-stock',
  wardId: 1, // Will need to be updated with a valid ward ID
  medications: [
    {
      name: 'Sodium Chloride',
      form: 'Infusion',
      strength: '0.9%',
      quantity: '10',
      dose: 'As directed'
    },
    {
      name: 'Glucose',
      form: 'Infusion',
      strength: '5%',
      quantity: '5',
      dose: 'As directed'
    }
  ],
  requester: {
    name: 'Nurse Test',
    role: 'nurse'
  },
  notes: 'Test ward stock order'
};

// Main test function
async function runTests() {
  try {
    let token;
    let createdOrderId;

    console.log('🔍 Starting Order API Tests');
    console.log('---------------------------');

    // Test 1: Login to get auth token
    console.log('\n1. Authenticating user');
    try {
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(TEST_USER)
      });

      if (!loginResponse.ok) {
        throw new Error(`Login failed: ${loginResponse.statusText}`);
      }

      const loginData = await loginResponse.json();
      // Store token without 'Bearer ' prefix for easier handling
      token = loginData.token.replace('Bearer ', '');
      console.log('✅ Authentication successful');
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      return;
    }

    // Test 2: Get a valid ward ID
    console.log('\n2. Getting a valid ward ID');
    try {
      // Debug token
      console.log('Using token:', token);
      
      const wardsResponse = await fetch(`${BASE_URL}/api/wards`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!wardsResponse.ok) {
        throw new Error(`Failed to get wards: ${wardsResponse.statusText}`);
      }

      const wardsData = await wardsResponse.json();
      
      if (!wardsData.wards || wardsData.wards.length === 0) {
        throw new Error('No wards found in database');
      }

      // Update test data with a valid ward ID
      const validWardId = wardsData.wards[0].id;
      patientOrderData.wardId = validWardId;
      wardStockOrderData.wardId = validWardId;
      console.log(`✅ Got valid ward ID: ${validWardId}`);
    } catch (error) {
      console.error('❌ Failed to get valid ward ID:', error.message);
      return;
    }

    // Test 3: Create patient order
    console.log('\n3. Creating patient order');
    try {
      const createResponse = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(patientOrderData)
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(`Failed to create order: ${JSON.stringify(errorData)}`);
      }

      const createData = await createResponse.json();
      createdOrderId = createData.orderId;
      console.log(`✅ Created patient order with ID: ${createdOrderId}`);
    } catch (error) {
      console.error('❌ Failed to create patient order:', error.message);
    }

    // Test 4: Get created order
    console.log('\n4. Retrieving created order');
    try {
      if (!createdOrderId) {
        throw new Error('No order ID available from previous test');
      }

      const getResponse = await fetch(`${BASE_URL}/api/orders/${createdOrderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!getResponse.ok) {
        throw new Error(`Failed to get order: ${getResponse.statusText}`);
      }

      const getData = await getResponse.json();
      console.log('✅ Order details retrieved:');
      console.log(JSON.stringify(getData.order, null, 2));
    } catch (error) {
      console.error('❌ Failed to get order details:', error.message);
    }

    // Test 5: Update order status
    console.log('\n5. Updating order status');
    try {
      if (!createdOrderId) {
        throw new Error('No order ID available from previous test');
      }

      const updateResponse = await fetch(`${BASE_URL}/api/orders/${createdOrderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'processing',
          processedBy: 'Test Pharmacist'
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update order: ${updateResponse.statusText}`);
      }

      const updateData = await updateResponse.json();
      console.log('✅ Order updated:', updateData.message);
    } catch (error) {
      console.error('❌ Failed to update order:', error.message);
    }

    // Test 6: Create ward stock order
    console.log('\n6. Creating ward stock order');
    try {
      const createResponse = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(wardStockOrderData)
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(`Failed to create ward stock order: ${JSON.stringify(errorData)}`);
      }

      const createData = await createResponse.json();
      const wardStockOrderId = createData.orderId;
      console.log(`✅ Created ward stock order with ID: ${wardStockOrderId}`);
    } catch (error) {
      console.error('❌ Failed to create ward stock order:', error.message);
    }

    // Test 7: Get all orders
    console.log('\n7. Getting all orders');
    try {
      const getResponse = await fetch(`${BASE_URL}/api/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!getResponse.ok) {
        throw new Error(`Failed to get orders: ${getResponse.statusText}`);
      }

      const getData = await getResponse.json();
      console.log(`✅ Retrieved ${getData.orders.length} orders`);
      
      // Display order summaries
      if (getData.orders.length > 0) {
        console.log('\nOrder Summaries:');
        getData.orders.forEach(order => {
          console.log(`- ID: ${order.id}, Type: ${order.type}, Ward: ${order.wardName}, Status: ${order.status}`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to get orders:', error.message);
    }

    console.log('\n---------------------------');
    console.log('🏁 Order API Tests Complete');
  } catch (error) {
    console.error('💥 Test execution error:', error);
  }
}

// Run the tests
runTests();
