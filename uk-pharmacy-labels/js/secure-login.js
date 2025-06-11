/**
 * UK Pharmacy Back-Up Label Generator
 * Secure Login Module
 * Handles user login functionality with secure backend
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize user manager
    UserManager.init();
    
    // Check if user is already logged in
    UserManager.verifyAuthentication()
        .then(user => {
            if (user) {
                redirectBasedOnAccess(user);
            }
        })
        .catch(error => {
            console.error('Authentication verification error:', error);
        });
    
    // Check for redirect URL from query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect');
    
    // Handle login form submission
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('login-error');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }
        
        try {
            // Show loading indicator
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Logging in...';
            submitButton.disabled = true;
            
            // Attempt login
            const user = await UserManager.login(username, password);
            
            // Login successful
            if (redirectUrl) {
                // Redirect to the original requested URL
                window.location.href = decodeURIComponent(redirectUrl);
            } else {
                // Regular redirect based on access level
                redirectBasedOnAccess(user);
            }
            
        } catch (error) {
            console.error('Login error:', error);
            showError('Invalid username or password');
            
            // Reset form button
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.textContent = 'Login';
            submitButton.disabled = false;
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
        if (user.access_levels.includes('admin')) {
            window.location.href = 'admin/index.html';
        } else if (user.access_levels.includes('pharmacy')) {
            window.location.href = 'remote-ordering/pharmacy/index.html';
        } else if (user.access_levels.includes('ordering')) {
            window.location.href = 'remote-ordering/ward/index.html';
        } else {
            // Fallback to main page
            window.location.href = 'index.html';
        }
    }
});
