/**
 * UK Pharmacy Back-Up Label Generator
 * Secure Admin Module
 * Handles admin functionality with secure backend
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize user manager
    UserManager.init();
    
    // Check if user is logged in and has admin access
    try {
        await UserManager.requireAuthentication(['admin']);
    } catch (error) {
        console.error('Authentication error:', error);
        return; // Stop execution if authentication fails
    }
    
    // DOM elements
    const userTable = document.getElementById('user-table');
    const userTableBody = userTable.querySelector('tbody');
    const addUserBtn = document.getElementById('add-user-btn');
    const addUserForm = document.getElementById('add-user-form');
    const editUserForm = document.getElementById('edit-user-form');
    const resetPasswordForm = document.getElementById('reset-password-form');
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close-modal, .cancel-modal');
    
    // Load users
    loadUsers();
    
    // Event listeners
    addUserBtn.addEventListener('click', showAddUserModal);
    addUserForm.addEventListener('submit', handleAddUser);
    editUserForm.addEventListener('submit', handleEditUser);
    resetPasswordForm.addEventListener('submit', handleResetPassword);
    
    // Close modal buttons
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modals.forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    /**
     * Load users from API
     */
    async function loadUsers() {
        try {
            const users = await UserManager.getAllUsers();
            renderUsers(users);
        } catch (error) {
            console.error('Error loading users:', error);
            showMessage('Error loading users: ' + error.message, 'error');
        }
    }
    
    /**
     * Render users in the table
     * @param {Array} users - Array of user objects
     */
    function renderUsers(users) {
        userTableBody.innerHTML = '';
        
        if (users.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="6" class="text-center">No users found</td>';
            userTableBody.appendChild(row);
            return;
        }
        
        users.forEach(user => {
            const row = document.createElement('tr');
            
            // Create username cell
            const usernameCell = document.createElement('td');
            usernameCell.textContent = user.username;
            if (user.is_default) {
                const defaultBadge = document.createElement('span');
                defaultBadge.className = 'badge badge-secondary';
                defaultBadge.textContent = 'Default';
                usernameCell.appendChild(document.createTextNode(' '));
                usernameCell.appendChild(defaultBadge);
            }
            row.appendChild(usernameCell);
            
            // Create email cell
            const emailCell = document.createElement('td');
            emailCell.textContent = user.email || '-';
            row.appendChild(emailCell);
            
            // Create access cell
            const accessCell = document.createElement('td');
            if (user.access_levels && user.access_levels.length > 0) {
                user.access_levels.forEach(access => {
                    const badge = document.createElement('span');
                    badge.className = `badge badge-${getBadgeClass(access)}`;
                    badge.textContent = access;
                    accessCell.appendChild(badge);
                    accessCell.appendChild(document.createTextNode(' '));
                });
            } else {
                accessCell.textContent = '-';
            }
            row.appendChild(accessCell);
            
            // Create status cell
            const statusCell = document.createElement('td');
            const statusBadge = document.createElement('span');
            statusBadge.className = `badge badge-${user.is_active ? 'success' : 'danger'}`;
            statusBadge.textContent = user.is_active ? 'Active' : 'Inactive';
            statusCell.appendChild(statusBadge);
            row.appendChild(statusCell);
            
            // Create last login cell
            const lastLoginCell = document.createElement('td');
            if (user.last_login) {
                const date = new Date(user.last_login);
                lastLoginCell.textContent = date.toLocaleString();
            } else {
                lastLoginCell.textContent = 'Never';
            }
            row.appendChild(lastLoginCell);
            
            // Create actions cell
            const actionsCell = document.createElement('td');
            actionsCell.className = 'actions';
            
            // Edit button
            const editButton = document.createElement('button');
            editButton.className = 'action-btn edit-btn';
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            editButton.title = 'Edit User';
            editButton.addEventListener('click', () => showEditUserModal(user));
            actionsCell.appendChild(editButton);
            
            // Reset password button
            const resetButton = document.createElement('button');
            resetButton.className = 'action-btn reset-btn';
            resetButton.innerHTML = '<i class="fas fa-key"></i>';
            resetButton.title = 'Reset Password';
            resetButton.addEventListener('click', () => showResetPasswordModal(user));
            actionsCell.appendChild(resetButton);
            
            // Delete button (disabled for default admin)
            const deleteButton = document.createElement('button');
            deleteButton.className = 'action-btn delete-btn';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'Delete User';
            
            if (user.is_default) {
                deleteButton.disabled = true;
                deleteButton.title = 'Cannot delete default admin';
            } else {
                deleteButton.addEventListener('click', () => confirmDeleteUser(user));
            }
            
            actionsCell.appendChild(deleteButton);
            row.appendChild(actionsCell);
            
            userTableBody.appendChild(row);
        });
    }
    
    /**
     * Show add user modal
     */
    function showAddUserModal() {
        // Reset form
        addUserForm.reset();
        
        // Show modal
        document.getElementById('add-user-modal').style.display = 'block';
    }
    
    /**
     * Show edit user modal
     * @param {Object} user - User object to edit
     */
    function showEditUserModal(user) {
        // Set form values
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('edit-username').value = user.username;
        document.getElementById('edit-email').value = user.email || '';
        
        // Set access checkboxes
        const accessCheckboxes = editUserForm.querySelectorAll('input[name="access"]');
        accessCheckboxes.forEach(checkbox => {
            checkbox.checked = user.access_levels && user.access_levels.includes(checkbox.value);
        });
        
        // Set status radio button
        const statusRadios = editUserForm.querySelectorAll('input[name="status"]');
        statusRadios.forEach(radio => {
            radio.checked = (radio.value === 'active') === user.is_active;
        });
        
        // Disable editing for default admin
        const isDefault = user.is_default;
        if (isDefault) {
            document.getElementById('edit-username').disabled = true;
            
            // Find admin checkbox and disable it
            const adminCheckbox = Array.from(accessCheckboxes).find(cb => cb.value === 'admin');
            if (adminCheckbox) {
                adminCheckbox.checked = true;
                adminCheckbox.disabled = true;
            }
            
            // Find active radio and disable the inactive option
            const inactiveRadio = Array.from(statusRadios).find(radio => radio.value === 'inactive');
            if (inactiveRadio) {
                inactiveRadio.disabled = true;
            }
        } else {
            document.getElementById('edit-username').disabled = false;
            
            // Enable all checkboxes and radios
            accessCheckboxes.forEach(cb => cb.disabled = false);
            statusRadios.forEach(radio => radio.disabled = false);
        }
        
        // Show modal
        document.getElementById('edit-user-modal').style.display = 'block';
    }
    
    /**
     * Show reset password modal
     * @param {Object} user - User object
     */
    function showResetPasswordModal(user) {
        // Set form values
        document.getElementById('reset-user-id').value = user.id;
        document.getElementById('reset-username').textContent = user.username;
        
        // Clear password field
        document.getElementById('reset-new-password').value = '';
        
        // Show modal
        document.getElementById('reset-password-modal').style.display = 'block';
    }
    
    /**
     * Handle add user form submit
     * @param {Event} e - Form submit event
     */
    async function handleAddUser(e) {
        e.preventDefault();
        
        const username = document.getElementById('add-username').value.trim();
        const email = document.getElementById('add-email').value.trim();
        const password = document.getElementById('add-password').value;
        
        // Get selected access levels
        const accessCheckboxes = addUserForm.querySelectorAll('input[name="access"]:checked');
        const access_levels = Array.from(accessCheckboxes).map(cb => cb.value);
        
        if (access_levels.length === 0) {
            showMessage('Please select at least one access level', 'error');
            return;
        }
        
        try {
            // Create user object
            const userData = {
                username,
                email,
                password,
                access_levels,
                is_active: true
            };
            
            // Call API to create user
            await UserManager.createUser(userData);
            
            // Close modal
            document.getElementById('add-user-modal').style.display = 'none';
            
            // Reload users
            loadUsers();
            
        } catch (error) {
            console.error('Error adding user:', error);
            showMessage(`Error adding user: ${error.message}`, 'error');
        }
    }
    
    /**
     * Handle edit user form submit
     * @param {Event} e - Form submit event
     */
    async function handleEditUser(e) {
        e.preventDefault();
        
        const userId = document.getElementById('edit-user-id').value;
        const username = document.getElementById('edit-username').value.trim();
        const email = document.getElementById('edit-email').value.trim();
        
        // Get selected access levels
        const accessCheckboxes = editUserForm.querySelectorAll('input[name="access"]:checked');
        const access_levels = Array.from(accessCheckboxes).map(cb => cb.value);
        
        if (access_levels.length === 0) {
            showMessage('Please select at least one access level', 'error');
            return;
        }
        
        // Get selected status
        const statusRadio = editUserForm.querySelector('input[name="status"]:checked');
        const is_active = statusRadio ? statusRadio.value === 'active' : true;
        
        try {
            // Create user object
            const userData = {
                username,
                email,
                access_levels,
                is_active
            };
            
            // Call API to update user
            await UserManager.updateUser(userId, userData);
            
            // Close modal
            document.getElementById('edit-user-modal').style.display = 'none';
            
            // Reload users
            loadUsers();
            
        } catch (error) {
            console.error('Error updating user:', error);
            showMessage(`Error updating user: ${error.message}`, 'error');
        }
    }
    
    /**
     * Handle reset password form submit
     * @param {Event} e - Form submit event
     */
    async function handleResetPassword(e) {
        e.preventDefault();
        
        const userId = document.getElementById('reset-user-id').value;
        const newPassword = document.getElementById('reset-new-password').value;
        
        try {
            // Call API to reset password
            await UserManager.resetUserPassword(userId, newPassword);
            
            // Close modal
            document.getElementById('reset-password-modal').style.display = 'none';
            
        } catch (error) {
            console.error('Error resetting password:', error);
            showMessage(`Error resetting password: ${error.message}`, 'error');
        }
    }
    
    /**
     * Confirm delete user
     * @param {Object} user - User object to delete
     */
    function confirmDeleteUser(user) {
        if (confirm(`Are you sure you want to delete user ${user.username}? This cannot be undone.`)) {
            deleteUser(user.id);
        }
    }
    
    /**
     * Delete user
     * @param {string} userId - User ID to delete
     */
    async function deleteUser(userId) {
        try {
            // Call API to delete user
            await UserManager.deleteUser(userId);
            
            // Reload users
            loadUsers();
            
        } catch (error) {
            console.error('Error deleting user:', error);
            showMessage(`Error deleting user: ${error.message}`, 'error');
        }
    }
    
    /**
     * Get badge class for access level
     * @param {string} access - Access level
     * @returns {string} - Badge class
     */
    function getBadgeClass(access) {
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
    }
    
    /**
     * Show message to user
     * @param {string} message - Message text
     * @param {string} type - Message type (success, error, warning, info)
     */
    function showMessage(message, type = 'info') {
        UserManager.showMessage(message, type);
    }
});
