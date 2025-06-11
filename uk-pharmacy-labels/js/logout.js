/**
 * Logout functionality
 * Clears authentication data and redirects to login page
 */

function logout() {
  // Clear authentication data from localStorage
  localStorage.removeItem('token');
  localStorage.removeItem('userData');
  
  // Redirect to login page
  window.location.href = '/login.html';
}

// For direct usage via URL
if (window.location.pathname === '/logout') {
  logout();
}
