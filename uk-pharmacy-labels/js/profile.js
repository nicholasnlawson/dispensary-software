/**
 * Profile page JavaScript
 * Handles user profile management functionality
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  if (!AuthUtils.isAuthenticated()) {
    // Redirect unauthenticated users to login
    window.location.href = 'login.html';
    return;
  }
  
  // DOM Elements
  const emailForm = document.getElementById('email-form');
  const passwordForm = document.getElementById('password-form');
  const alertBox = document.getElementById('alert-box');
  
  // Load and display user data
  loadUserData();

  // Set up logout functionality
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      AuthUtils.logout();
    });
  }
  
  // Handle email update form submission
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newEmail = document.getElementById('email').value;
    
    try {
      await updateUserEmail(newEmail);
      showAlert('Email updated successfully', 'success');
      loadUserData(); // Reload user data to show updated email
      emailForm.reset();
    } catch (error) {
      showAlert(`Error: ${error.message}`, 'error');
    }
  });
  
  // Handle password change form submission
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      showAlert('New password and confirmation do not match', 'error');
      return;
    }
    
    try {
      await changePassword(currentPassword, newPassword);
      showAlert('Password changed successfully', 'success');
      passwordForm.reset();
    } catch (error) {
      showAlert(`Error: ${error.message}`, 'error');
    }
  });
  
  /**
   * Load and display user data
   */
  function loadUserData() {
    const userData = AuthUtils.getUserData();
    if (!userData) {
      showAlert('Could not load user data', 'error');
      return;
    }
    
    // Display user info
    document.getElementById('display-username').textContent = userData.username || 'N/A';
    document.getElementById('display-email').textContent = userData.email || 'N/A';
    
    // Format roles
    let rolesText = 'None';
    if (userData.roles && userData.roles.length > 0) {
      rolesText = userData.roles.join(', ');
    }
    document.getElementById('display-roles').textContent = rolesText;
    
    // Set email field to current email as default
    document.getElementById('email').value = userData.email || '';
    
    // Update visibility of admin link
    const adminLink = document.getElementById('admin-nav-link');
    if (adminLink) {
      if (AuthUtils.hasRole('admin')) {
        adminLink.style.display = 'inline-block';
      } else {
        adminLink.style.display = 'none';
      }
    }
  }
  
  /**
   * Update user's email address
   */
  async function updateUserEmail(newEmail) {
    try {
      const userData = AuthUtils.getUserData();
      if (!userData || !userData.id) {
        throw new Error('User data not available');
      }
      
      const response = await apiClient.updateUserProfile({
        userId: userData.id,
        email: newEmail
      });
      
      // Update local storage with new email
      if (response.success) {
        userData.email = newEmail;
        AuthUtils.updateUserData(userData);
      }
      
      return response;
    } catch (error) {
      console.error('Failed to update email:', error);
      throw error;
    }
  }
  
  /**
   * Change user's password
   */
  async function changePassword(currentPassword, newPassword) {
    try {
      const userData = AuthUtils.getUserData();
      if (!userData || !userData.id) {
        throw new Error('User data not available');
      }
      
      const response = await apiClient.changePassword({
        userId: userData.id,
        currentPassword,
        newPassword
      });
      
      return response;
    } catch (error) {
      console.error('Failed to change password:', error);
      throw error;
    }
  }
  
  /**
   * Show alert message
   * @param {string} message - Alert message
   * @param {string} type - Alert type (success or error)
   */
  function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `alert show alert-${type}`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      alertBox.classList.remove('show');
    }, 5000);
  }
});
