/**
 * API Client for the Pharmacy System
 * Handles all API requests and authentication
 */

class ApiClient {
  constructor() {
    // API base URL - change this to match your server configuration
    this.baseUrl = 'http://localhost:3001/api';
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
      const data = await response.json();

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
      
      // Store encrypted user data
      const encryptedUserData = this.encryptData(JSON.stringify({
        id: data.user.id,
        username: data.user.username,
        roles: data.user.roles
      }));
      
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
    return await this.request(`/users/${passwordData.userId}/password`, 'PUT', {
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
    return await this.request(`/users/${profileData.userId}/profile`, 'PUT', {
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
      const encryptedData = localStorage.getItem('userData');
      if (!encryptedData) return null;
      
      const decryptedData = this.decryptData(encryptedData);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('Error getting current user:', error);
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
}

// Export as global
window.apiClient = new ApiClient();
