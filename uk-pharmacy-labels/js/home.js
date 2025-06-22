/**
 * Home page JavaScript
 * Handles home page functionality
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication - common.js already handles redirect if not authenticated
  if (!AuthUtils.isAuthenticated()) {
    return;
  }
  
  // Get user data and display name
  const userData = AuthUtils.getUserData();
  if (userData) {
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
      const displayName = userData.firstName && userData.lastName 
        ? `${userData.firstName} ${userData.lastName}` 
        : userData.username || 'User';
      userNameElement.textContent = displayName;
    }
    
    // Show/hide admin card based on admin access
    const adminCard = document.getElementById('admin-card');
    if (adminCard && !AuthUtils.hasAnyAdminRole()) {
      adminCard.style.display = 'none';
    }
  }
});
