/**
 * UK Pharmacy Back-Up Label Generator
 * Admin Module
 * Handles admin functionality for user management
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in and has admin access
    const currentUser = UserManager.getCurrentUser();
    if (!currentUser) {
        // Redirect to login page if not logged in
        window.location.href = '../login.html';
        return;
    }
    
    if (!UserManager.hasAccess(UserManager.ACCESS_LEVELS.ADMIN)) {
        // Redirect to appropriate page if not admin
        if (UserManager.hasAccess(UserManager.ACCESS_LEVELS.PHARMACY)) {
            window.location.href = '../remote-ordering/pharmacy/index.html';
        } else if (UserManager.hasAccess(UserManager.ACCESS_LEVELS.ORDERING)) {
            window.location.href = '../remote-ordering/ward/index.html';
        } else {
            window.location.href = '../index.html';
        }
        return;
    }
    
    // Display current user
    document.getElementById('current-user').textContent = `Logged in as: ${currentUser.username}`;
    
    // Handle logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        UserManager.logout();
    });
    
    // Initialize admin sections
    initSections();
    
    // Initialize user management
    loadUsers();
    initUserManagement();
    
    // Initialize system settings
    initSystemSettings();
    
    // Initialize account settings
    initAccountSettings();
});

/**
 * Initialize admin sections
 */
function initSections() {
    const menuItems = document.querySelectorAll('.admin-menu li');
    const sections = document.querySelectorAll('.admin-section');
    
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all menu items
            menuItems.forEach(i => i.classList.remove('active'));
            
            // Add active class to clicked menu item
            item.classList.add('active');
            
            // Show corresponding section
            const sectionId = item.getAttribute('data-section');
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                }
            });
        });
    });
}

/**
 * Load users into the table
 */
function loadUsers() {
    const users = UserManager.getAllUsers();
    const tableBody = document.getElementById('users-table-body');
    
    // Clear table
    tableBody.innerHTML = '';
    
    // Add users to table
    users.forEach(user => {
        const row = document.createElement('tr');
        
        // Username
        const usernameCell = document.createElement('td');
        usernameCell.textContent = user.username;
        if (user.isDefault) {
            usernameCell.innerHTML += ' <span class="default-badge">Default</span>';
        }
        row.appendChild(usernameCell);
        
        // Email
        const emailCell = document.createElement('td');
        emailCell.textContent = user.email || '-';
        row.appendChild(emailCell);
        
        // Access levels
        const accessCell = document.createElement('td');
        const accessLevels = user.access.map(level => {
            const capitalizedLevel = level.charAt(0).toUpperCase() + level.slice(1);
            return `<span class="access-badge ${level}">${capitalizedLevel}</span>`;
        });
        accessCell.innerHTML = accessLevels.join(' ');
        row.appendChild(accessCell);
        
        // Last login
        const lastLoginCell = document.createElement('td');
        if (user.lastLogin) {
            const date = new Date(user.lastLogin);
            lastLoginCell.textContent = date.toLocaleString();
        } else {
            lastLoginCell.textContent = 'Never';
        }
        row.appendChild(lastLoginCell);
        
        // Status
        const statusCell = document.createElement('td');
        statusCell.innerHTML = user.isActive ? 
            '<span class="status-badge active">Active</span>' : 
            '<span class="status-badge inactive">Inactive</span>';
        row.appendChild(statusCell);
        
        // Actions
        const actionsCell = document.createElement('td');
        actionsCell.classList.add('actions-cell');
        
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.classList.add('action-btn', 'edit-btn');
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => openEditUserModal(user));
        actionsCell.appendChild(editBtn);
        
        // Reset password button
        const resetBtn = document.createElement('button');
        resetBtn.classList.add('action-btn', 'reset-btn');
        resetBtn.textContent = 'Reset Password';
        resetBtn.addEventListener('click', () => openResetPasswordModal(user));
        actionsCell.appendChild(resetBtn);
        
        // Delete button (disabled for default admin)
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('action-btn', 'delete-btn');
        deleteBtn.textContent = 'Delete';
        deleteBtn.disabled = user.isDefault;
        deleteBtn.addEventListener('click', () => deleteUser(user.id));
        actionsCell.appendChild(deleteBtn);
        
        row.appendChild(actionsCell);
        
        tableBody.appendChild(row);
    });
}

/**
 * Initialize user management functionality
 */
function initUserManagement() {
    // Add user button
    document.getElementById('add-user-btn').addEventListener('click', openAddUserModal);
    
    // Add user form
    document.getElementById('add-user-form').addEventListener('submit', (e) => {
        e.preventDefault();
        addUser();
    });
    
    // Edit user form
    document.getElementById('edit-user-form').addEventListener('submit', (e) => {
        e.preventDefault();
        editUser();
    });
    
    // Reset password form
    document.getElementById('reset-password-form').addEventListener('submit', (e) => {
        e.preventDefault();
        resetPassword();
    });
    
    // Modal close buttons
    document.querySelectorAll('.close-modal, .cancel-modal').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
}

/**
 * Open add user modal
 */
function openAddUserModal() {
    document.getElementById('add-user-modal').style.display = 'block';
    document.getElementById('add-user-form').reset();
}

/**
 * Open edit user modal
 * @param {Object} user - User object
 */
function openEditUserModal(user) {
    const modal = document.getElementById('edit-user-modal');
    const form = document.getElementById('edit-user-form');
    
    // Set form values
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-username').value = user.username;
    document.getElementById('edit-email').value = user.email || '';
    
    // Set access checkboxes
    const accessCheckboxes = form.querySelectorAll('input[name="access"]');
    accessCheckboxes.forEach(checkbox => {
        checkbox.checked = user.access.includes(checkbox.value);
    });
    
    // Set status radio buttons
    const statusRadios = form.querySelectorAll('input[name="isActive"]');
    statusRadios.forEach(radio => {
        radio.checked = (radio.value === 'true' && user.isActive) || 
                        (radio.value === 'false' && !user.isActive);
    });
    
    // Disable username field for default admin
    document.getElementById('edit-username').disabled = user.isDefault;
    
    modal.style.display = 'block';
}

/**
 * Open reset password modal
 * @param {Object} user - User object
 */
function openResetPasswordModal(user) {
    const modal = document.getElementById('reset-password-modal');
    
    document.getElementById('reset-user-id').value = user.id;
    document.getElementById('reset-username').textContent = user.username;
    document.getElementById('reset-new-password').value = '';
    
    modal.style.display = 'block';
}

/**
 * Close all modals
 */
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

/**
 * Add a new user
 */
function addUser() {
    const form = document.getElementById('add-user-form');
    const username = document.getElementById('new-username').value.trim();
    const email = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value;
    
    // Get selected access levels
    const accessCheckboxes = form.querySelectorAll('input[name="access"]:checked');
    const access = Array.from(accessCheckboxes).map(checkbox => checkbox.value);
    
    // Get selected status
    const isActive = form.querySelector('input[name="isActive"]:checked').value === 'true';
    
    // Create user
    const newUser = UserManager.createUser({
        username,
        password: UserManager.hashPassword(password),
        email,
        access,
        isActive
    });
    
    if (newUser) {
        // Reload users table
        loadUsers();
        closeAllModals();
        alert('User added successfully');
    } else {
        alert('Failed to add user. Username may already exist.');
    }
}

/**
 * Edit an existing user
 */
function editUser() {
    const form = document.getElementById('edit-user-form');
    const userId = document.getElementById('edit-user-id').value;
    const username = document.getElementById('edit-username').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    
    // Get selected access levels
    const accessCheckboxes = form.querySelectorAll('input[name="access"]:checked');
    const access = Array.from(accessCheckboxes).map(checkbox => checkbox.value);
    
    // Get selected status
    const isActive = form.querySelector('input[name="isActive"]:checked').value === 'true';
    
    // Update user
    const success = UserManager.updateUser(userId, {
        username,
        email,
        access,
        isActive
    });
    
    if (success) {
        // Reload users table
        loadUsers();
        closeAllModals();
        alert('User updated successfully');
    } else {
        alert('Failed to update user');
    }
}

/**
 * Reset a user's password
 */
function resetPassword() {
    const userId = document.getElementById('reset-user-id').value;
    const newPassword = document.getElementById('reset-new-password').value;
    
    if (!newPassword) {
        alert('Please enter a new password');
        return;
    }
    
    // Reset password
    const success = UserManager.resetPassword(userId, newPassword);
    
    if (success) {
        closeAllModals();
        alert('Password reset successfully');
    } else {
        alert('Failed to reset password');
    }
}

/**
 * Delete a user
 * @param {string} userId - User ID
 */
function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        const success = UserManager.deleteUser(userId);
        
        if (success) {
            loadUsers();
            alert('User deleted successfully');
        } else {
            alert('Failed to delete user');
        }
    }
}

/**
 * Initialize system settings
 */
function initSystemSettings() {
    document.getElementById('system-settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const systemName = document.getElementById('system-name').value.trim();
        const sessionTimeout = document.getElementById('session-timeout').value;
        
        // Save settings to local storage
        localStorage.setItem('uk_pharmacy_system_name', systemName);
        localStorage.setItem('uk_pharmacy_session_timeout', sessionTimeout);
        
        alert('System settings saved successfully');
    });
    
    // Load existing settings
    const systemName = localStorage.getItem('uk_pharmacy_system_name') || 'Pharmacy System';
    const sessionTimeout = localStorage.getItem('uk_pharmacy_session_timeout') || '30';
    
    document.getElementById('system-name').value = systemName;
    document.getElementById('session-timeout').value = sessionTimeout;
}

/**
 * Initialize account settings
 */
function initAccountSettings() {
    document.getElementById('password-change-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const currentUser = UserManager.getCurrentUser();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (newPassword !== confirmPassword) {
            alert('New passwords do not match');
            return;
        }
        
        // Change password
        const success = UserManager.changePassword(currentUser.id, currentPassword, newPassword);
        
        if (success) {
            document.getElementById('password-change-form').reset();
            alert('Password changed successfully');
        } else {
            alert('Failed to change password. Please check your current password.');
        }
    });
}
