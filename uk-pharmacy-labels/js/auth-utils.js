/**
 * Auth utilities for handling user authentication across the application
 */

const AuthUtils = {
  /**
   * Check if user is authenticated
   * @returns {boolean} - True if authenticated, false otherwise
   */
  isAuthenticated() {
    return !!localStorage.getItem('token');
  },

  /**
   * Get user data from localStorage
   * @returns {Object|null} - User data object or null if not available
   */
  getUserData() {
    try {
      const userData = localStorage.getItem('userData');
      if (!userData) return null;
      
      const decryptedData = this.decryptData(userData);
      if (!decryptedData) return null;
      
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  },
  
  /**
   * Update user data in localStorage
   * @param {Object} userData - Updated user data
   * @returns {boolean} - True if successful, false otherwise
   */
  updateUserData(userData) {
    try {
      if (!userData) return false;
      
      // Convert to string and encrypt
      const userDataStr = JSON.stringify(userData);
      const encryptionKey = 'pharmacy-secure-key-change-in-production';
      const encryptedData = CryptoJS.AES.encrypt(userDataStr, encryptionKey).toString();
      
      // Store in localStorage
      localStorage.setItem('userData', encryptedData);
      return true;
    } catch (error) {
      console.error('Error updating user data:', error);
      return false;
    }
  },

  /**
   * Check if user has a specific role
   * @param {string} role - Role to check for
   * @returns {boolean} - True if user has the role, false otherwise
   */
  hasRole(role) {
    const userData = this.getUserData();
    if (!userData || !userData.roles) return false;
    
    return userData.roles.includes(role);
  },

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
  },

  /**
   * Log out the current user
   */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    window.location.href = '/login.html';
  }
};
