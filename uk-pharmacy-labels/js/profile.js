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
  
  // Modal Elements
  const passwordConfirmModal = document.getElementById('password-confirm-modal');
  const emailConfirmModal = document.getElementById('email-confirm-modal');
  const confirmEmailText = document.getElementById('confirm-email-text');
  const confirmPasswordChangeBtn = document.getElementById('confirm-password-change');
  const confirmEmailChangeBtn = document.getElementById('confirm-email-change');
  
  // Password toggle elements
  const passwordToggles = document.querySelectorAll('.password-toggle');
  
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
  
  // Set up password visibility toggle functionality
  passwordToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const passwordInput = toggle.parentElement.querySelector('input');
      
      // Toggle password visibility
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggle.classList.add('show-password');
      } else {
        passwordInput.type = 'password';
        toggle.classList.remove('show-password');
      }
    });
  });
  
  // Close modals when clicking on X or outside the modal
  document.querySelectorAll('.modal .close, .modal .btn-cancel').forEach(element => {
    element.addEventListener('click', () => {
      passwordConfirmModal.style.display = 'none';
      emailConfirmModal.style.display = 'none';
    });
  });
  
  // Close modal when clicking outside of it
  window.addEventListener('click', (e) => {
    if (e.target === passwordConfirmModal) {
      passwordConfirmModal.style.display = 'none';
    }
    if (e.target === emailConfirmModal) {
      emailConfirmModal.style.display = 'none';
    }
  });
  
  // Handle email update form submission
  emailForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newEmail = document.getElementById('email').value;
    
    // Show confirmation modal
    confirmEmailText.textContent = newEmail;
    emailConfirmModal.style.display = 'block';
    
    // Set up confirmation button action
    confirmEmailChangeBtn.onclick = async () => {
      try {
        await updateUserEmail(newEmail);
        showAlert('Email updated successfully', 'success');
        loadUserData(); // Reload user data to show updated email
        emailForm.reset();
        emailConfirmModal.style.display = 'none';
      } catch (error) {
        showAlert(`Error: ${error.message}`, 'error');
        emailConfirmModal.style.display = 'none';
      }
    };
  });
  
  // Handle password change form submission
  passwordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      showAlert('New password and confirmation do not match', 'error');
      return;
    }
    
    // Show confirmation modal
    passwordConfirmModal.style.display = 'block';
    
    // Set up confirmation button action
    confirmPasswordChangeBtn.onclick = async () => {
      try {
        await changePassword(currentPassword, newPassword);
        showAlert('Password changed successfully', 'success');
        passwordForm.reset();
        passwordConfirmModal.style.display = 'none';
        
        // Reset password fields to type "password"
        document.querySelectorAll('input[type="text"]').forEach(input => {
          if (input.id.includes('password')) {
            input.type = 'password';
            const toggle = input.parentElement.querySelector('.password-toggle');
            toggle.classList.remove('show-password');
          }
        });
      } catch (error) {
        showAlert(`Error: ${error.message}`, 'error');
        passwordConfirmModal.style.display = 'none';
      }
    };
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
