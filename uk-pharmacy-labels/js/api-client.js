/**
 * API Client for the Pharmacy System
 * Handles all API requests and authentication
 */

class ApiClient {
  constructor() {
    // API base URL - change this to match your server configuration
    this.baseUrl = 'http://localhost:3000/api';
    this.token = localStorage.getItem('token');
  }

  /**
   * Get authentication headers
   * @returns {Object} Headers for authenticated requests
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = this.token;
    }

    return headers;
  }

  /**
   * Make a request to the API
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} body - Request body
   * @returns {Promise} - Promise resolving to response data
   */
  async request(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: this.getHeaders()
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      let data = null;
      if (response.status !== 204) {
        data = await response.json();
      }

      // Handle 401 Unauthorized errors
      if (response.status === 401) {
        // Clear token and redirect to login
        this.logout();
        window.location.href = '/login.html';
        throw new Error('Session expired. Please log in again.');
      }

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * Shorthand for GET request
   * @param {string} endpoint - API endpoint
   * @returns {Promise} - Promise resolving to response data
   */
  async get(endpoint) {
    return await this.request(endpoint, 'GET');
  }

  /**
   * Shorthand for POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise} - Promise resolving to response data
   */
  async post(endpoint, data) {
    return await this.request(endpoint, 'POST', data);
  }

  /**
   * Shorthand for PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise} - Promise resolving to response data
   */
  async put(endpoint, data) {
    return await this.request(endpoint, 'PUT', data);
  }

  /**
   * Shorthand for DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise} - Promise resolving to response data
   */
  async delete(endpoint) {
    return await this.request(endpoint, 'DELETE');
  }

  /**
   * Log in a user
   * @param {string} username - Username or email
   * @param {string} password - Password
   * @returns {Promise} - Promise resolving to user data
   */
  async login(username, password) {
    const data = await this.request('/auth/login', 'POST', { username, password });
    
    if (data.token) {
      this.token = data.token;
      localStorage.setItem('token', data.token);
      
      // Store encrypted user data with full name information
      const encryptedUserData = this.encryptData(JSON.stringify({
        id: data.user.id,
        username: data.user.username,
        first_name: data.user.first_name || '',
        surname: data.user.surname || '',
        // Store a pre-computed display name for convenience
        name: data.user.first_name && data.user.surname
            ? `${data.user.first_name} ${data.user.surname}`
            : data.user.username,
        roles: data.user.roles
      }));
      
      console.log('Storing user data:', {
        id: data.user.id,
        username: data.user.username,
        name: data.user.first_name && data.user.surname
            ? `${data.user.first_name} ${data.user.surname}`
            : data.user.username,
        roles: data.user.roles
      });
      
      localStorage.setItem('userData', encryptedUserData);
    }
    
    return data;
  }

  /**
   * Log out the current user
   */
  logout() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    
    // Redirect to login page
    window.location.href = '/login.html';
  }

  /**
   * Get user profile
   * @returns {Promise} - Promise resolving to user profile data
   */
  async getProfile() {
    return await this.request('/auth/profile');
  }

  /**
   * Get all users (admin only)
   * @returns {Promise} - Promise resolving to users list
   */
  async getUsers() {
    return await this.request('/users');
  }

  /**
   * Get user by ID (admin only)
   * @param {number} id - User ID
   * @returns {Promise} - Promise resolving to user data
   */
  async getUser(id) {
    return await this.request(`/users/${id}`);
  }

  /**
   * Create a new user (admin only)
   * @param {Object} userData - User data
   * @returns {Promise} - Promise resolving to created user
   */
  async createUser(userData) {
    return await this.request('/auth/register', 'POST', userData);
  }

  /**
   * Update user (admin only)
   * @param {number} id - User ID
   * @param {Object} userData - User data to update
   * @returns {Promise} - Promise resolving to updated user
   */
  async updateUser(id, userData) {
    return await this.request(`/users/${id}`, 'PUT', userData);
  }

  /**
   * Delete user (admin only)
   * @param {number} id - User ID
   * @returns {Promise} - Promise resolving to success message
   */
  async deleteUser(id) {
    return await this.request(`/users/${id}`, 'DELETE');
  }

  /**
   * Change password for user
   * @param {Object} passwordData - Password change data
   * @returns {Promise} - Promise resolving to success message
   */
  async changePassword(passwordData) {
    return await this.request(`/users/change-password`, 'POST', {
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword
    });
  }

  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   * @returns {Promise} - Promise resolving to updated profile
   */
  async updateUserProfile(profileData) {
    return await this.request(`/users/${profileData.userId}`, 'PUT', {
      email: profileData.email
    });
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} - True if user is authenticated
   */
  isAuthenticated() {
    return !!this.token;
  }

  /**
   * Get current user data
   * @returns {Object|null} - User data or null if not authenticated
   */
  getCurrentUser() {
    try {
      // First check for token - no valid user without token
      if (!this.token) {
        console.log('No authentication token found');
        return null;
      }
      
      const encryptedData = localStorage.getItem('userData');
      if (!encryptedData) {
        console.log('No user data found in localStorage');
        return null;
      }
      
      // Attempt to decrypt the data
      let decryptedData;
      try {
        decryptedData = this.decryptData(encryptedData);
        if (!decryptedData) {
          console.error('Decryption returned null value');
          return null;
        }
      } catch (decryptError) {
        console.error('Failed to decrypt user data:', decryptError);
        return null;
      }
      
      // Parse the JSON data
      try {
        const userData = JSON.parse(decryptedData);
        console.log('Retrieved user data:', userData);
        return userData;
      } catch (parseError) {
        console.error('Failed to parse user data JSON:', parseError);
        return null;
      }
    } catch (error) {
      console.error('Unexpected error in getCurrentUser:', error);
      return null;
    }
  }

  /**
   * Check if current user has specific role
   * @param {string} role - Role to check
   * @returns {boolean} - True if user has role
   */
  hasRole(role) {
    const user = this.getCurrentUser();
    return user && user.roles && user.roles.includes(role);
  }

  /**
   * Encrypts data using AES encryption
   * @param {string} data - Data to encrypt
   * @returns {string} - Encrypted data
   */
  encryptData(data) {
    try {
      // Use a secure key management approach in production
      const encryptionKey = 'pharmacy-secure-key-change-in-production';
      
      // Use CryptoJS for encryption
      const encrypted = CryptoJS.AES.encrypt(data, encryptionKey).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      return null;
    }
  }

  /**
   * Decrypts data using AES encryption
   * @param {string} encryptedData - Data to decrypt
   * @returns {string} - Decrypted data
   */
  decryptData(encryptedData) {
    try {
      // Use the same key as encryption
      const encryptionKey = 'pharmacy-secure-key-change-in-production';
      
      // Use CryptoJS for decryption
      const decrypted = CryptoJS.AES.decrypt(encryptedData, encryptionKey).toString(CryptoJS.enc.Utf8);
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  /**
   * Get all hospitals
   * @returns {Promise} - Promise resolving to hospitals list
   */
  async getAllHospitals() {
    return await this.request('/hospitals');
  }

  /**
   * Get hospital by ID
   * @param {number} id - Hospital ID
   * @returns {Promise} - Promise resolving to hospital data
   */
  async getHospitalById(id) {
    return await this.request(`/hospitals/${id}`);
  }

  /**
   * Create a new hospital
   * @param {Object} hospitalData - Hospital data
   * @returns {Promise} - Promise resolving to created hospital
   */
  async createHospital(hospitalData) {
    return await this.request('/hospitals', 'POST', hospitalData);
  }

  /**
   * Update hospital
   * @param {number} id - Hospital ID
   * @param {Object} hospitalData - Hospital data to update
   * @returns {Promise} - Promise resolving to updated hospital
   */
  async updateHospital(id, hospitalData) {
    return await this.request(`/hospitals/${id}`, 'PUT', hospitalData);
  }

  /**
   * Delete hospital
   * @param {number} id - Hospital ID
   * @returns {Promise} - Promise resolving to success message
   */
  async deleteHospital(id) {
    return await this.request(`/hospitals/${id}`, 'DELETE');
  }

  /**
   * Get all wards
   * @returns {Promise} - Promise resolving to wards list
   */
  async getAllWards() {
    return await this.request('/wards');
  }

  /**
   * Get ward by ID
   * @param {number} id - Ward ID
   * @returns {Promise} - Promise resolving to ward data
   */
  async getWardById(id) {
    return await this.request(`/wards/${id}`);
  }

  /**
   * Create a new ward
   * @param {Object} wardData - Ward data
   * @returns {Promise} - Promise resolving to created ward
   */
  async createWard(wardData) {
    return await this.request('/wards', 'POST', wardData);
  }

  /**
   * Update ward
   * @param {number} id - Ward ID
   * @param {Object} wardData - Ward data to update
   * @returns {Promise} - Promise resolving to updated ward
   */
  async updateWard(id, wardData) {
    return await this.request(`/wards/${id}`, 'PUT', wardData);
  }

  /**
   * Delete ward
   * @param {number} id - Ward ID
   * @returns {Promise} - Promise resolving to success message
   */
  async deleteWard(id) {
    return await this.request(`/wards/${id}`, 'DELETE');
  }

  /**
   * Check for recent medication orders for a patient
   * @param {Object} patient - Patient data
   * @param {Array} medications - Array of medications to check
   * @returns {Promise} - Promise resolving to array of recent orders
   */
  async checkRecentMedications(patient, medications) {
    // Validate inputs
    if (!patient || !medications || !Array.isArray(medications)) {
      console.error('Invalid inputs for recent medication check');
      return { recentOrders: [] };
    }
    
    try {
      const result = await this.post('/orders/recent-check', {
        patient: {
          name: patient.name,
          nhsNumber: patient.nhs || patient.nhsNumber,
          hospitalNumber: patient.hospitalId || patient.hospitalNumber
        },
        medications: medications
      });
      
      return result;
    } catch (error) {
      console.error('Error checking for recent medications:', error);
      return { recentOrders: [] };
    }
  }

  /**
   * Create a new order
   * @param {Object} orderData - Order data
   * @returns {Promise} - Promise resolving to created order
   */
  async createOrder(orderData) {
    console.log('Sending order to server:', orderData);
    
    try {
      // Get user data from hidden form fields - these are populated at page load
      // This is more reliable than localStorage which may have encryption issues
      const patientRequesterName = document.getElementById('requester-name')?.value;
      const patientRequesterRole = document.getElementById('requester-role')?.value;
      const wsRequesterName = document.getElementById('ws-requester-name')?.value;
      const wsRequesterRole = document.getElementById('ws-requester-role')?.value;
      
      // Use values from form if available
      const formRequesterName = patientRequesterName || wsRequesterName || null;
      const formRequesterRole = patientRequesterRole || wsRequesterRole || 'ordering';
      
      // Ensure requester information is included - prioritize existing data, then form data, then localStorage
      if (!orderData.requester || !orderData.requester.name || orderData.requester.name === 'Unknown User') {
        // Try to get user from localStorage as backup
        const currentUser = this.getCurrentUser();
        
        // Create requester object with best available data
        orderData.requester = {
          id: (currentUser?.id || 0),
          name: formRequesterName || (currentUser?.name || currentUser?.username || 'Unknown User'),
          role: formRequesterRole || (currentUser?.roles?.[0] || 'ordering')
        };
        
        console.log('Updated requester info:', orderData.requester);
      }
      
      const result = await this.post('/orders', orderData);
      console.log('Order created successfully on server:', result);
      
      // If the response includes the full order object, return it
      if (result && result.order) {
        console.log('Full order data received:', result.order);
        return result.order;
      }
      
      // Otherwise return the original response for backward compatibility
      return result;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }
  
  /**
   * Get recent orders
   * @param {Object} options - Query options (limit, offset, etc)
   * @returns {Promise} - Promise resolving to orders data
   */
  async getRecentOrders(options = {}) {
    const queryParams = new URLSearchParams();
    
    if (options.limit) queryParams.append('limit', options.limit);
    if (options.offset) queryParams.append('offset', options.offset);
    if (options.status) queryParams.append('status', options.status);
    if (options.wardId && options.wardId !== 'all') queryParams.append('ward_id', options.wardId);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/orders${queryString}`);
  }
  
  /**
   * Update an existing order
   * @param {string} orderId - ID of the order to update
   * @param {Object} orderData - Updated order data
   * @returns {Promise} - Promise resolving to updated order data
   */
  async updateOrder(orderId, orderData) {
    console.log('[API] updateOrder called with:', { orderId, orderData });
    
    if (!orderId) {
      console.error('[API] updateOrder: No order ID provided');
      return { success: false, message: 'Order ID is required' };
    }
    
    try {
      // Get current user for audit trail
      const currentUser = this.getCurrentUser();
      const modifiedBy = currentUser ? (currentUser.name || currentUser.username || 'Unknown User') : 'Unknown User';
      
      // If we have previousOrder data, fetch the current state to compare for audit trail
      let previousOrderData = null;
      if (!orderData.previousState) {
        try {
          // Fetch the current order to compare changes
          const currentOrderResponse = await this.request(`/orders/${orderId}`, 'GET');
          if (currentOrderResponse && currentOrderResponse.success) {
            previousOrderData = currentOrderResponse.order;
            console.log('[API] Fetched current order for comparison:', previousOrderData);
          }
        } catch (fetchError) {
          console.warn('[API] Could not fetch current order for comparison:', fetchError);
          // Continue without previous data if fetch fails
        }
      } else {
        previousOrderData = orderData.previousState;
        console.log('[API] Using provided previous state for comparison');
      }
      
      // If this update includes medications, use the medications endpoint with audit trail
      if (orderData.medications && Array.isArray(orderData.medications)) {
        console.log('[API] Updating order medications with audit trail');
        
        const medicationUpdatePayload = {
          medications: orderData.medications,
          modifiedBy: modifiedBy,
          reason: orderData.reason || 'Order updated via UI',
          timestamp: new Date().toISOString(),
          previousState: previousOrderData
        };
        
        console.log('[API] Making PUT request to /orders/' + orderId + '/medications', medicationUpdatePayload);
        const response = await this.request(`/orders/${orderId}/medications`, 'PUT', medicationUpdatePayload);
        console.log('[API] updateOrder medications response:', response);
        return response;
      } 
      // Otherwise, update basic order metadata using the standard endpoint
      else {
        console.log('[API] Updating order metadata only');
        const updatePayload = {
          status: orderData.status || 'pending',
          processingNotes: orderData.notes || orderData.processingNotes || 'Updated via UI',
          modifiedBy: modifiedBy,
          reason: orderData.reason || 'Order updated via UI',
          timestamp: new Date().toISOString(),
          previousState: previousOrderData
        };
        
        console.log('[API] Making PUT request to /orders/' + orderId, updatePayload);
        const response = await this.request(`/orders/${orderId}`, 'PUT', updatePayload);
        console.log('[API] updateOrder response:', response);
        return response;
      }
    } catch (error) {
      console.error('[API] Error updating order:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to update order' 
      };
    }
  }
  
  /**
   * Get a single order by its ID
   * @param {string} orderId - The ID of the order to retrieve
   * @returns {Promise<Object>} - A promise that resolves to the order object
   */
  async getOrder(orderId) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }
      console.log(`[API] Making GET request to /orders/${orderId}`);
      const response = await this.request(`/orders/${orderId}`, 'GET');
      console.log('[API] getOrder response:', response);
      return response;
    } catch (error) {
      console.error('[API] Error fetching order:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to fetch order' 
      };
    }
  }

  /**
   * Cancel an order
   * @param {string} orderId - ID of the order to cancel
   * @param {string} reason - Reason for cancellation
   * @returns {Promise} - Promise resolving to cancellation result
   */
  async cancelOrder(orderId, reason = 'Cancelled by user') {
    console.log('[API] cancelOrder called with orderId:', orderId, 'reason:', reason);
    
    if (!orderId) {
      console.error('[API] cancelOrder: No order ID provided');
      return { success: false, message: 'Order ID is required' };
    }
    
    try {
      // Get current user for cancelledBy field
      const currentUser = this.getCurrentUser();
      console.log('[API] Current user for cancellation:', currentUser);
      
      // Determine the cancelledBy value based on available user properties
      const cancelledBy = currentUser ? (currentUser.name || currentUser.username || 'Unknown User') : 'Unknown User';
      
      const cancelData = {
        reason: reason || 'Cancelled via UI',
        cancelledBy: cancelledBy,
        timestamp: new Date().toISOString()
      };
      
      console.log('[API] Making PUT request to /orders/' + orderId + '/cancel', cancelData);
      const response = await this.request(`/orders/${orderId}/cancel`, 'PUT', cancelData);
      console.log('[API] cancelOrder response:', response);
      return response;
    } catch (error) {
      console.error('[API] Error cancelling order:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to cancel order' 
      };
    }
  }
  
  /**
   * Search orders by medication name and other optional filters
   * @param {Object} options - Search options
   * @param {string} options.medicationName - Primary search term
   * @param {string} [options.searchTokens] - Comma-separated list of search tokens for multi-word search
   * @param {string} [options.wardId] - Optional ward ID to filter results by location
   * @param {number} [options.limit=50] - Maximum number of results to return
   * @returns {Promise<Object>} Response with orders matching the search criteria
   */
  async searchOrdersByMedication(options = {}) {
    try {
      if (!options.medicationName) {
        throw new Error('Search term is required');
      }
      
      // Prepare query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('medicationName', options.medicationName);
      
      // Add optional parameters if provided
      if (options.searchTokens) queryParams.append('searchTokens', options.searchTokens);
      if (options.wardId) queryParams.append('wardId', options.wardId);
      if (options.limit) queryParams.append('limit', options.limit);
      
      console.log('[API] Making GET request to /orders?search=medication with params:', options);
      
      const response = await this.request(`/orders?search=medication&${queryParams.toString()}`, 'GET');
      console.log('[API] searchOrdersByMedication response:', response);
      return response;
    } catch (error) {
      console.error('[API] Error searching orders:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to search orders', 
        orders: [] 
      };
    }
  }
  
  /**
   * Get order history/audit trail  
   * @param {string} orderId - ID of the order to get history for
   * @returns {Promise} - Promise resolving to order history
   */
  async getOrderHistory(orderId) {
    console.log('[API] getOrderHistory called with orderId:', orderId);
    
    if (!orderId) {
      console.error('[API] getOrderHistory: No order ID provided');
      return { success: false, message: 'Order ID is required' };
    }
    
    try {
      console.log('[API] Making GET request to /orders/' + orderId + '/history');
      const response = await this.request(`/orders/${orderId}/history`, 'GET');
      console.log('[API] getOrderHistory response structure:', JSON.stringify(response, null, 2));
      
      // Log data for debugging
      if (response.history && Array.isArray(response.history)) {
        console.log('[API] History entries count:', response.history.length);
        
        // Check if we have entries with previousData/newData
        const entriesWithDiff = response.history.filter(entry => 
          (entry.previousData || entry.previous_data) && (entry.newData || entry.new_data));
        console.log('[API] Entries with diff data:', entriesWithDiff.length);
        
        if (entriesWithDiff.length > 0) {
          console.log('[API] Sample entry with diff:', entriesWithDiff[0]);
        }
      }
      
      return response;
    } catch (error) {
      console.error('[API] Error fetching order history:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to fetch order history' 
      };
    }
  }
}

// Create a global instance of ApiClient for use throughout the application
window.apiClient = new ApiClient();

// For Node.js environments (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiClient;
}
