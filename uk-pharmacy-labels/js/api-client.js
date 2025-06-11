/**
 * UK Pharmacy Back-Up Label Generator
 * API Client Module
 * Handles communication with the secure local database server
 */

const ApiClient = {
    _getRootRelativePath(fileName) {
        if (window.location.pathname.includes('/admin/')) {
            return `../${fileName}`;
        }
        return fileName;
    },
    // API base URL - update this for your intranet deployment
    BASE_URL: 'http://localhost:3000/api',
    
    /**
     * Get authentication token from session storage
     * @returns {string|null} JWT token or null if not authenticated
     */
    getToken() {
        return sessionStorage.getItem('auth_token');
    },
    
    /**
     * Set authentication token in session storage
     * @param {string} token - JWT token
     */
    setToken(token) {
        sessionStorage.setItem('auth_token', token);
    },
    
    /**
     * Clear authentication token from session storage
     */
    clearToken() {
        sessionStorage.removeItem('auth_token');
    },
    
    /**
     * Make API request
     * @param {string} endpoint - API endpoint
     * @param {object} options - Fetch options
     * @returns {Promise<any>} - Response data
     */
    async request(endpoint, options = {}) {
        console.log('[API] Making request to:', this.BASE_URL + endpoint);
        console.log('[API] Request options:', JSON.stringify(options));
        
        const token = this.getToken();
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['x-auth-token'] = token;
        }
        
        try {
            console.log('[API] Sending fetch request...');
            const response = await fetch(`${this.BASE_URL}${endpoint}`, {
                ...options,
                headers
            });
            console.log('[API] Response status:', response.status);
            
            // Handle 401 Unauthorized - token expired or invalid
            if (response.status === 401) {
                this.clearToken();
                // Redirect to login page if not already there
                if (!window.location.pathname.includes('login.html')) {
                    window.location.href = ApiClient._getRootRelativePath('login.html') + '?expired=true';
                }
                throw new Error('Authentication expired. Please log in again.');
            }
            
            // Parse JSON response
            const data = await response.json();
            
            // Handle error responses
            if (!response.ok) {
                throw new Error(data.error || `API error: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    },
    
    /**
     * Authentication API endpoints
     */
    auth: {
        /**
         * Login user
         * @param {string} username - Username
         * @param {string} password - Password
         * @returns {Promise} User data and token
         */
        async login(username, password) {
            const data = await ApiClient.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            
            // Store token
            ApiClient.setToken(data.token);
            
            // Store user in session storage
            sessionStorage.setItem('current_user', JSON.stringify(data.user));
            
            return data.user;
        },
        
        /**
         * Verify current token and get user data
         * @returns {Promise} User data
         */
        async verify() {
            if (!ApiClient.getToken()) {
                return null;
            }
            
            try {
                const data = await ApiClient.request('/auth/verify');
                
                // Update user in session storage
                sessionStorage.setItem('current_user', JSON.stringify(data.user));
                
                return data.user;
            } catch (error) {
                return null;
            }
        },
        
        /**
         * Logout user
         */
        async logout() {
            try {
                if (ApiClient.getToken()) {
                    await ApiClient.request('/auth/logout', {
                        method: 'POST'
                    });
                }
            } catch (error) {
                console.error('Logout error:', error);
            } finally {
                // Clear token and user data
                ApiClient.clearToken();
                sessionStorage.removeItem('current_user');
                
                // Redirect to login page
                window.location.href = ApiClient._getRootRelativePath('login.html');
            }
        }
    },
    
    /**
     * User management API endpoints
     */
    users: {
        /**
         * Get all users
         * @returns {Promise} List of users
         */
        async getAll() {
            return ApiClient.request('/users');
        },
        
        /**
         * Get user by ID
         * @param {string} id - User ID
         * @returns {Promise} User data
         */
        async getById(id) {
            return ApiClient.request(`/users/${id}`);
        },
        
        /**
         * Create a new user
         * @param {Object} userData - User data
         * @returns {Promise} Created user
         */
        async create(userData) {
            return ApiClient.request('/users', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        },
        
        /**
         * Update a user
         * @param {string} id - User ID
         * @param {Object} userData - User data
         * @returns {Promise} Updated user
         */
        async update(id, userData) {
            return ApiClient.request(`/users/${id}`, {
                method: 'PUT',
                body: JSON.stringify(userData)
            });
        },
        
        /**
         * Delete a user
         * @param {string} id - User ID
         * @returns {Promise} Success message
         */
        async delete(id) {
            return ApiClient.request(`/users/${id}`, {
                method: 'DELETE'
            });
        },
        
        /**
         * Reset a user's password (admin function)
         * @param {string} id - User ID
         * @param {string} newPassword - New password
         * @returns {Promise} Success message
         */
        async resetPassword(id, newPassword) {
            return ApiClient.request(`/users/${id}/reset-password`, {
                method: 'PUT',
                body: JSON.stringify({ password: newPassword })
            });
        },
        
        /**
         * Change current user's password
         * @param {string} currentPassword - Current password
         * @param {string} newPassword - New password
         * @returns {Promise} Success message
         */
        async changePassword(currentPassword, newPassword) {
            return ApiClient.request('/users/change-password', {
                method: 'PUT',
                body: JSON.stringify({ currentPassword, newPassword })
            });
        }
    },
    
    /**
     * System settings API endpoints
     */
    system: {
        /**
         * Get all system settings
         * @returns {Promise} System settings
         */
        async getSettings() {
            return ApiClient.request('/system/settings');
        },
        
        /**
         * Update a system setting
         * @param {string} key - Setting key
         * @param {string} value - Setting value
         * @returns {Promise} Updated setting
         */
        async updateSetting(key, value) {
            return ApiClient.request(`/system/settings/${key}`, {
                method: 'PUT',
                body: JSON.stringify({ value })
            });
        },
        
        /**
         * Get audit logs
         * @param {number} page - Page number
         * @param {number} limit - Items per page
         * @returns {Promise} Audit logs with pagination
         */
        async getAuditLogs(page = 1, limit = 50) {
            return ApiClient.request(`/system/audit-logs?page=${page}&limit=${limit}`);
        },
        
        /**
         * Get database information
         * @returns {Promise} Database info
         */
        async getDatabaseInfo() {
            return ApiClient.request('/system/database-info');
        },
        
        /**
         * Get login statistics
         * @returns {Promise} Login stats
         */
        async getLoginStats() {
            return ApiClient.request('/system/login-stats');
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}
