/**
 * UK Pharmacy Back-Up Label Generator
 * Login Module
 * Handles user login functionality
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize user manager
    UserManager.init();
    
    // Check if user is already logged in
    const currentUser = UserManager.getCurrentUser();
    if (currentUser) {
        redirectBasedOnAccess(currentUser);
    }
    
    // Handle login form submission
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('login-error');
    
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }
        
        // Attempt login
        const user = UserManager.login(username, password);
        
        if (user) {
            // Login successful
            redirectBasedOnAccess(user);
        } else {
            // Login failed
            showError('Invalid username or password');
        }
    });
    
    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
    
    /**
     * Redirect user based on their access level
     * @param {Object} user - User object
     */
    function redirectBasedOnAccess(user) {
        // Redirect based on access level
        if (user.access.includes(UserManager.ACCESS_LEVELS.ADMIN)) {
            window.location.href = 'admin/index.html';
        } else if (user.access.includes(UserManager.ACCESS_LEVELS.PHARMACY)) {
            window.location.href = 'remote-ordering/pharmacy/index.html';
        } else if (user.access.includes(UserManager.ACCESS_LEVELS.ORDERING)) {
            window.location.href = 'remote-ordering/ward/index.html';
        } else {
            // Fallback to main page
            window.location.href = 'index.html';
        }
    }
});
