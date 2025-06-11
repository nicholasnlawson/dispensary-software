/**
 * Authentication Test Script
 * This script tests the functionality of the authentication system
 * Run it with: node test-auth.js
 */

// Base URL for the API
const API_BASE_URL = 'http://localhost:3000/api';

// Test credentials
const testCredentials = {
  admin: {
    username: 'admin',
    password: 'change_me_immediately'
  },
  testUser: {
    username: 'testuser',
    password: 'password123',
    email: 'test@example.com',
    roles: ['ordering']
  }
};

// Store token for authenticated requests
let adminToken = null;
let userToken = null;

/**
 * Makes an authenticated request to the API
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {object} body - Request body
 * @param {string} token - Authentication token
 * @returns {Promise<object>} - Response data
 */
async function makeRequest(endpoint, method = 'GET', body = null, token = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = token;
  }
  
  const options = { method, headers };
  
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
    console.log(`${method} ${url} with body:`, options.body);
  } else {
    console.log(`${method} ${url}`);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    // Log response status and basic info
    console.log(`Response status: ${response.status}`);
    console.log(`Response data:`, JSON.stringify(data, null, 2).substring(0, 200) + (JSON.stringify(data, null, 2).length > 200 ? '...' : ''));
    
    if (!response.ok) {
      throw new Error(data.message || `API request failed with status ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error.message);
    throw error;
  }
}

/**
 * Run all tests in sequence
 */
async function runTests() {
  console.log('=== AUTHENTICATION SYSTEM TEST ===');
  
  try {
    // Test 1: Admin login
    console.log('\n1. Testing admin login...');
    const adminLoginData = await makeRequest(
      '/auth/login', 
      'POST',
      testCredentials.admin
    );
    adminToken = adminLoginData.token;
    console.log('✅ Admin login successful');
    console.log(`Admin user: ${adminLoginData.user.username} (roles: ${adminLoginData.user.roles.join(', ')})`);
    
    // Test 2: Get admin profile
    console.log('\n2. Testing get admin profile...');
    const adminProfile = await makeRequest(
      '/auth/profile',
      'GET',
      null,
      adminToken
    );
    console.log('✅ Admin profile retrieved successfully');
    console.log(`Profile: ${adminProfile.user.username} (ID: ${adminProfile.user.id})`);
    
    // Test 3: Create a test user
    console.log('\n3. Testing user creation...');
    const newUser = await makeRequest(
      '/auth/register',
      'POST',
      testCredentials.testUser,
      adminToken
    );
    console.log('✅ Test user created successfully');
    console.log(`New user created with ID: ${newUser.userId}`);
    
    // Store the new user ID for later tests
    const newUserId = newUser.userId;
    
    // Test 4: Test user login
    console.log('\n4. Testing test user login...');
    const userLoginData = await makeRequest(
      '/auth/login',
      'POST',
      {
        username: testCredentials.testUser.username,
        password: testCredentials.testUser.password
      }
    );
    userToken = userLoginData.token;
    console.log('✅ Test user login successful');
    
    // Test 5: List all users (admin only)
    console.log('\n5. Testing list all users (admin only)...');
    const allUsers = await makeRequest(
      '/users',
      'GET',
      null,
      adminToken
    );
    console.log('✅ User list retrieved successfully');
    console.log(`Total users: ${allUsers.users.length}`);
    
    // Test 6: Test role-based access control
    console.log('\n6. Testing role-based access control...');
    try {
      await makeRequest(
        '/users',
        'GET',
        null,
        userToken
      );
      console.log('❌ RBAC test failed - non-admin accessed admin endpoint');
    } catch (error) {
      console.log('✅ RBAC test passed - non-admin properly denied access to admin endpoint');
    }
    
    // Test 7: Update user information
    console.log('\n7. Testing user update...');
    const updatedUser = await makeRequest(
      `/users/${newUserId}`,
      'PUT',
      {
        email: 'updated@example.com',
        roles: ['ordering', 'pharmacy']
      },
      adminToken
    );
    console.log('✅ User updated successfully');
    console.log(`Updated roles: ${updatedUser.user ? updatedUser.user.roles.join(', ') : 'roles not returned'}`); 
    
    // Test 8: Delete test user
    console.log('\n8. Testing user deletion...');
    const deleteResult = await makeRequest(
      `/users/${newUserId}`,
      'DELETE',
      null,
      adminToken
    );
    console.log('✅ User deleted successfully');
    
    console.log('\n=== ALL TESTS PASSED ===');
    console.log('Authentication system is working as expected! 🎉');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
  }
}

// Add fetch for Node.js environment
let fetch;
try {
  // First try native fetch (Node.js 18+)
  if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
  } else {
    // For older Node.js versions, try to require node-fetch
    try {
      fetch = require('node-fetch');
      console.log('Using node-fetch package');
    } catch (requireError) {
      console.log('This test requires node-fetch to be installed.');
      console.log('Please run: npm install node-fetch@2 --no-save');
      console.log('OR use Node.js v18+ which has fetch built-in.');
      process.exit(1);
    }
  }
} catch (error) {
  console.error('Error setting up fetch:', error);
  process.exit(1);
}

// Run the tests
runTests();
