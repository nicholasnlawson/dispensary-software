/**
 * UK Pharmacy Back-Up Label Generator
 * Secure User Manager Module
 * Handles user authentication and management with secure backend
 */

// Use the existing ApiClient module
// No need to redeclare, just reference it directly

const UserManager = {
    _getRootRelativePath(fileName) {
        if (window.location.pathname.includes('/admin/')) {
            return `../${fileName}`;
        }
        return fileName;
    },
    /**
     * Initialize the User Manager
     */
    init() {
        // Check for redirect parameters (like expired=true)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('expired') === 'true') {
            this.showMessage('Your session has expired. Please log in again.', 'warning');
        }
        
        // Setup any event listeners if needed
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        // Return promise that resolves when initialization is complete
        return Promise.resolve();
    },
    
    /**
     * Handle tab visibility change to verify session when user returns to tab
     */
    async handleVisibilityChange() {
        if (document.visibilityState === 'visible' && this.getCurrentUser()) {
            try {
                // Verify token is still valid when user returns to tab
                await this.verifyAuthentication();
            } catch (error) {
                console.error('Session verification error:', error);
            }
        }
    },
    
    /**
     * Display message to user
     * @param {string} message - Message text
     * @param {string} type - Message type (success, error, warning, info)
     */
    showMessage(message, type = 'info') {
        // Check if the message container exists
        let messageContainer = document.getElementById('message-container');
        
        // Create it if it doesn't exist
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'message-container';
            messageContainer.style.position = 'fixed';
            messageContainer.style.top = '20px';
            messageContainer.style.right = '20px';
            messageContainer.style.zIndex = '1000';
            document.body.appendChild(messageContainer);
        }
        
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `alert alert-${type}`;
        messageEl.role = 'alert';
        messageEl.textContent = message;
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'close';
        closeButton.setAttribute('aria-label', 'Close');
        closeButton.innerHTML = '&times;';
        closeButton.style.marginLeft = '10px';
        closeButton.onclick = () => messageEl.remove();
        messageEl.appendChild(closeButton);
        
        // Add to container
        messageContainer.appendChild(messageEl);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl && messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    },
    
    /**
     * Authenticate user with username and password
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Promise<Object>} - User object if successful
     */
    async login(username, password) {
        try {
            const user = await ApiClient.auth.login(username, password);
            return user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },
    
    /**
     * Log out the current user
     */
    async logout() {
        try {
            await ApiClient.auth.logout();
            // The API client will handle redirect to login page
        } catch (error) {
            console.error('Logout error:', error);
            // Fallback logout handling if API call fails
            ApiClient.clearToken();
            sessionStorage.removeItem('current_user');
            window.location.href = this._getRootRelativePath('login.html');
        }
    },
    
    /**
     * Verify current authentication and refresh user data
     * @returns {Promise<Object|null>} - User object or null if not authenticated
     */
    async verifyAuthentication() {
        try {
            const user = await ApiClient.auth.verify();
            return user;
        } catch (error) {
            console.error('Verification error:', error);
            return null;
        }
    },
    
    /**
     * Redirect to login if not authenticated
     * @param {Array} requiredAccess - Array of required access levels
     * @returns {Promise<void>}
     */
    async requireAuthentication(requiredAccess = []) {
        const user = await this.verifyAuthentication();
        
        if (!user) {
            // Not authenticated, redirect to login
            window.location.href = this._getRootRelativePath('login.html') + '?redirect=' + encodeURIComponent(window.location.pathname);
            return;
        }
        
        // Check access level if required
        if (requiredAccess.length > 0) {
            const hasAccess = requiredAccess.some(access => user.access_levels.includes(access));
            
            if (!hasAccess) {
                this.showMessage(`You don't have permission to access this page`, 'error');
                // Redirect to home page or previous page
                window.location.href = this._getRootRelativePath('index.html');
                return;
            }
        }
        
        // Update UI with user info
        this.updateUserInfo(user);
    },
    
    /**
     * Update UI elements with current user info
     * @param {Object} user - User object
     */
    updateUserInfo(user) {
        if (!user) {
            user = this.getCurrentUser();
            if (!user) return;
        }
        
        // Find user-info elements
        const userInfoElements = document.querySelectorAll('.user-info');
        
        userInfoElements.forEach(el => {
            // Create username element if it doesn't exist
            let usernameEl = el.querySelector('.username');
            if (!usernameEl) {
                usernameEl = document.createElement('span');
                usernameEl.className = 'username';
                el.appendChild(usernameEl);
            }
            usernameEl.textContent = user.username;
            
            // Create access badges if they don't exist
            let accessEl = el.querySelector('.access-badges');
            if (!accessEl) {
                accessEl = document.createElement('div');
                accessEl.className = 'access-badges';
                el.appendChild(accessEl);
            }
            
            accessEl.innerHTML = '';
            user.access_levels.forEach(access => {
                const badge = document.createElement('span');
                badge.className = `badge badge-${this.getAccessBadgeClass(access)}`;
                badge.textContent = access;
                accessEl.appendChild(badge);
            });
            
            // Update navigation links based on access levels
            this.updateNavigationLinks(user.access_levels);
        });
    },
    
    /**
     * Update navigation links based on user access levels
     * @param {Array} accessLevels - User access levels
     */
    updateNavigationLinks(accessLevels) {
        // Show/hide admin link
        const adminLinks = document.querySelectorAll('.admin-link');
        adminLinks.forEach(link => {
            link.style.display = accessLevels.includes('admin') ? 'block' : 'none';
        });
        
        // Show/hide pharmacy link
        const pharmacyLinks = document.querySelectorAll('.pharmacy-link');
        pharmacyLinks.forEach(link => {
            link.style.display = accessLevels.includes('pharmacy') ? 'block' : 'none';
        });
        
        // Show/hide ordering link
        const orderingLinks = document.querySelectorAll('.ordering-link');
        orderingLinks.forEach(link => {
            link.style.display = accessLevels.includes('ordering') ? 'block' : 'none';
        });
    },
    
    /**
     * Get badge class for access level
     * @param {string} access - Access level
     * @returns {string} - CSS class
     */
    getAccessBadgeClass(access) {
        switch (access) {
            case 'admin':
                return 'danger';
            case 'pharmacy':
                return 'success';
            case 'ordering':
                return 'primary';
            default:
                return 'secondary';
        }
    },
    
    /**
     * Get the current logged in user
     * @returns {Object|null} - User object or null
     */
    getCurrentUser() {
        const userJson = sessionStorage.getItem('current_user');
        return userJson ? JSON.parse(userJson) : null;
    },
    
    /**
     * Check if current user has specified access level
     * @param {string} accessLevel - Access level to check
     * @returns {boolean} - True if user has access
     */
    hasAccess(accessLevel) {
        const user = this.getCurrentUser();
        return user && user.access_levels && user.access_levels.includes(accessLevel);
    },
    
    /**
     * Get all users (admin only)
     * @returns {Promise<Array>} - Array of users
     */
    async getAllUsers() {
        try {
            return await ApiClient.users.getAll();
        } catch (error) {
            console.error('Error getting users:', error);
            this.showMessage('Error loading users', 'error');
            return [];
        }
    },
    
    /**
     * Create a new user (admin only)
     * @param {Object} userData - User data
     * @returns {Promise<Object>} - Created user
     */
    async createUser(userData) {
        try {
            const result = await ApiClient.users.create(userData);
            this.showMessage(`User ${userData.username} created successfully`, 'success');
            return result;
        } catch (error) {
            console.error('Error creating user:', error);
            this.showMessage(`Error creating user: ${error.message}`, 'error');
            throw error;
        }
    },
    
    /**
     * Update a user (admin only)
     * @param {string} userId - User ID
     * @param {Object} userData - User data
     * @returns {Promise<Object>} - Updated user
     */
    async updateUser(userId, userData) {
        try {
            const result = await ApiClient.users.update(userId, userData);
            this.showMessage(`User ${userData.username} updated successfully`, 'success');
            return result;
        } catch (error) {
            console.error('Error updating user:', error);
            this.showMessage(`Error updating user: ${error.message}`, 'error');
            throw error;
        }
    },
    
    /**
     * Delete a user (admin only)
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async deleteUser(userId) {
        try {
            await ApiClient.users.delete(userId);
            this.showMessage('User deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showMessage(`Error deleting user: ${error.message}`, 'error');
            throw error;
        }
    },
    
    /**
     * Reset a user's password (admin only)
     * @param {string} userId - User ID
     * @param {string} newPassword - New password
     * @returns {Promise<void>}
     */
    async resetUserPassword(userId, newPassword) {
        try {
            await ApiClient.users.resetPassword(userId, newPassword);
            this.showMessage('Password reset successfully', 'success');
        } catch (error) {
            console.error('Error resetting password:', error);
            this.showMessage(`Error resetting password: ${error.message}`, 'error');
            throw error;
        }
    },
    
    /**
     * Change current user's password
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {Promise<void>}
     */
    async changePassword(currentPassword, newPassword) {
        try {
            await ApiClient.users.changePassword(currentPassword, newPassword);
            this.showMessage('Password changed successfully', 'success');
            // Refresh token and user data after password change
            await this.verifyAuthentication();
        } catch (error) {
            console.error('Error changing password:', error);
            this.showMessage(`Error changing password: ${error.message}`, 'error');
            throw error;
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserManager;
} else {
    // Add to window for browser use
    window.UserManager = UserManager;
}
