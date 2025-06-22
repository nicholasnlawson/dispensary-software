/**
 * Common JavaScript functionality shared across all pages
 * Handles shared functionality like logout, authentication checks, etc.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Get the current path
  const currentPath = window.location.pathname;
  
  // Check authentication
  if (!AuthUtils.isAuthenticated()) {
    // Allow access only to login page when not authenticated
    if (!currentPath.includes('login.html')) {
      // Redirect unauthenticated users to login
      window.location.href = '/login.html';
      return;
    }
  } else {
    // User is authenticated
    
    // Redirect login page and exact root path to home when authenticated
    // But allow direct access to index.html when specifically navigated to
    if (currentPath.includes('login.html') || currentPath === '/' || currentPath === '//' ) {
      window.location.href = '/home.html';
      return;
    }
  }
  
  // Set up logout functionality
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      AuthUtils.logout();
    });
  }
  
  // Set up navigation highlighting
  setupNavigation();
});

/**
 * Set up navigation highlighting based on current page
 */
function setupNavigation() {
  // Find all nav links
  const navLinks = document.querySelectorAll('.nav-link');
  
  // Get current path
  const currentPath = window.location.pathname;
  
  // Highlight the active link
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.includes(href) && !link.classList.contains('logout-link')) {
      link.classList.add('active');
    } else if (link.classList.contains('active') && !currentPath.includes(href)) {
      link.classList.remove('active');
    }
  });
}
