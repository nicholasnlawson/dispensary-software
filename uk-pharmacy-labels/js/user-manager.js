/**
 * UK Pharmacy Back-Up Label Generator
 * User Manager Module
 * Handles user authentication, authorization, and management
 */

const UserManager = {
    // Storage keys with prefix to avoid conflicts
    KEYS: {
        USERS: 'uk_pharmacy_users',
        CURRENT_USER: 'uk_pharmacy_current_user'
    },
    
    // Access levels
    ACCESS_LEVELS: {
        ORDERING: 'ordering',  // Can place orders from wards
        PHARMACY: 'pharmacy',  // Can view and process orders
        ADMIN: 'admin'         // Can manage users and system settings
    },
    
    /**
     * Initialize the user system
     * Creates default admin user if no users exist
     */
    init() {
        const users = this.getAllUsers();
        
        // Create default admin user if no users exist
        if (users.length === 0) {
            this.createUser({
                username: 'admin',
                password: this.hashPassword('admin'),
                email: '',
                access: [
                    this.ACCESS_LEVELS.ORDERING,
                    this.ACCESS_LEVELS.PHARMACY,
                    this.ACCESS_LEVELS.ADMIN
                ],
                isActive: true,
                isDefault: true
            });
            console.log('Default admin user created');
        }
    },
    
    /**
     * Get all users from local storage
     * @returns {Array} List of user objects
     */
    getAllUsers() {
        try {
            const encryptedData = localStorage.getItem(this.KEYS.USERS);
            if (!encryptedData) return [];
            
            const decryptedData = this.decrypt(encryptedData);
            return JSON.parse(decryptedData);
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
        }
    },
    
    /**
     * Save all users to local storage
     * @param {Array} users - List of user objects
     */
    saveAllUsers(users) {
        try {
            const jsonData = JSON.stringify(users);
            const encryptedData = this.encrypt(jsonData);
            localStorage.setItem(this.KEYS.USERS, encryptedData);
        } catch (error) {
            console.error('Error saving users:', error);
        }
    },
    
    /**
     * Create a new user
     * @param {Object} userData - User data object
     * @returns {Object|null} Created user object or null if failed
     */
    createUser(userData) {
        if (!userData.username || !userData.password) {
            console.error('Username and password are required');
            return null;
        }
        
        const users = this.getAllUsers();
        
        // Check if username already exists
        if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
            console.error('Username already exists');
            return null;
        }
        
        // Create new user object
        const newUser = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            username: userData.username,
            password: userData.password, // Already hashed
            email: userData.email || '',
            access: userData.access || [],
            isActive: userData.isActive !== undefined ? userData.isActive : true,
            isDefault: userData.isDefault || false,
            created: new Date().toISOString(),
            lastLogin: null
        };
        
        // Add to users array
        users.push(newUser);
        this.saveAllUsers(users);
        
        // Return the new user without the password
        const { password, ...userWithoutPassword } = newUser;
        return userWithoutPassword;
    },
    
    /**
     * Update an existing user
     * @param {string} userId - User ID
     * @param {Object} userData - Updated user data
     * @returns {boolean} Success or failure
     */
    updateUser(userId, userData) {
        const users = this.getAllUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            console.error('User not found');
            return false;
        }
        
        // Update user properties
        const updatedUser = {
            ...users[userIndex],
            ...userData
        };
        
        // Don't allow changing the ID
        updatedUser.id = users[userIndex].id;
        
        users[userIndex] = updatedUser;
        this.saveAllUsers(users);
        return true;
    },
    
    /**
     * Delete a user
     * @param {string} userId - User ID
     * @returns {boolean} Success or failure
     */
    deleteUser(userId) {
        const users = this.getAllUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            console.error('User not found');
            return false;
        }
        
        // Don't allow deleting the default admin user
        if (users[userIndex].isDefault) {
            console.error('Cannot delete default admin user');
            return false;
        }
        
        users.splice(userIndex, 1);
        this.saveAllUsers(users);
        return true;
    },
    
    /**
     * Authenticate a user
     * @param {string} username - Username
     * @param {string} password - Plain text password
     * @returns {Object|null} User object without password or null if authentication fails
     */
    login(username, password) {
        const users = this.getAllUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) {
            console.error('User not found');
            return null;
        }
        
        if (!user.isActive) {
            console.error('User account is inactive');
            return null;
        }
        
        // Verify password
        if (!this.verifyPassword(password, user.password)) {
            console.error('Invalid password');
            return null;
        }
        
        // Update last login time
        user.lastLogin = new Date().toISOString();
        this.saveAllUsers(users);
        
        // Store current user in session
        const { password: _, ...userWithoutPassword } = user;
        this.setCurrentUser(userWithoutPassword);
        
        return userWithoutPassword;
    },
    
    /**
     * Log out the current user
     */
    logout() {
        localStorage.removeItem(this.KEYS.CURRENT_USER);
        // Redirect to login page
        window.location.href = '/uk-pharmacy-labels/login.html';
    },
    
    /**
     * Get the current logged-in user
     * @returns {Object|null} Current user object or null if not logged in
     */
    getCurrentUser() {
        try {
            const userData = localStorage.getItem(this.KEYS.CURRENT_USER);
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    },
    
    /**
     * Set the current logged-in user
     * @param {Object} user - User object
     */
    setCurrentUser(user) {
        localStorage.setItem(this.KEYS.CURRENT_USER, JSON.stringify(user));
    },
    
    /**
     * Check if the current user has a specific access level
     * @param {string} accessLevel - Access level to check
     * @returns {boolean} True if user has access, false otherwise
     */
    hasAccess(accessLevel) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return false;
        return currentUser.access.includes(accessLevel);
    },
    
    /**
     * Change a user's password
     * @param {string} userId - User ID
     * @param {string} oldPassword - Old password (plain text)
     * @param {string} newPassword - New password (plain text)
     * @returns {boolean} Success or failure
     */
    changePassword(userId, oldPassword, newPassword) {
        const users = this.getAllUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            console.error('User not found');
            return false;
        }
        
        // Verify old password
        if (!this.verifyPassword(oldPassword, users[userIndex].password)) {
            console.error('Invalid old password');
            return false;
        }
        
        // Update password
        users[userIndex].password = this.hashPassword(newPassword);
        this.saveAllUsers(users);
        return true;
    },
    
    /**
     * Reset a user's password (admin function)
     * @param {string} userId - User ID
     * @param {string} newPassword - New password (plain text)
     * @returns {boolean} Success or failure
     */
    resetPassword(userId, newPassword) {
        const currentUser = this.getCurrentUser();
        if (!currentUser || !currentUser.access.includes(this.ACCESS_LEVELS.ADMIN)) {
            console.error('Admin access required');
            return false;
        }
        
        const users = this.getAllUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            console.error('User not found');
            return false;
        }
        
        // Update password
        users[userIndex].password = this.hashPassword(newPassword);
        this.saveAllUsers(users);
        return true;
    },
    
    /**
     * Hash a password
     * @param {string} password - Plain text password
     * @returns {string} Hashed password
     */
    hashPassword(password) {
        // In a real application, use a proper hashing library
        // For this example, we'll use a simple hash function
        // DO NOT use this in production!
        return btoa(password + 'pharmacy-salt') + '.simple';
    },
    
    /**
     * Verify a password against a hash
     * @param {string} password - Plain text password
     * @param {string} hash - Hashed password
     * @returns {boolean} True if password matches hash
     */
    verifyPassword(password, hash) {
        // Simple verification to match our simple hash
        return hash === this.hashPassword(password);
    },
    
    /**
     * Encrypt data
     * @param {string} data - Data to encrypt
     * @returns {string} Encrypted data
     */
    encrypt(data) {
        // In a real application, use a proper encryption library
        // For this example, we'll use a simple encryption
        // DO NOT use this in production!
        return btoa(data) + '.encrypted';
    },
    
    /**
     * Decrypt data
     * @param {string} encryptedData - Data to decrypt
     * @returns {string} Decrypted data
     */
    decrypt(encryptedData) {
        // Simple decryption to match our simple encryption
        if (encryptedData.endsWith('.encrypted')) {
            return atob(encryptedData.slice(0, -10));
        }
        return encryptedData; // Fallback for unencrypted data
    }
};
