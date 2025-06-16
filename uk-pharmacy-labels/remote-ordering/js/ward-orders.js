/**
 * Remote Ordering System
 * Ward Orders Module
 * Handles the ward ordering interface functionality
 */

// Store ward data for mapping IDs to names
window.wardsCache = {};

/**
 * Create the recent medication alert modal container
 */
function createRecentMedicationAlertModal() {
    // Check if container already exists
    if (document.getElementById('recent-medication-alert-modal')) {
        return;
    }
    
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.id = 'recent-medication-alert-modal';
    modalContainer.className = 'hidden';
    
    // Create modal content
    modalContainer.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Recent Medication Alert</h3>
                <span class="modal-close">&times;</span>
            </div>
            <div class="modal-body">
                <div class="alert alert-warning">
                    <strong>Warning:</strong> The following medications have been recently ordered for this patient within the last 14 days:
                </div>
                <div id="recent-medications-list"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" id="cancel-order-submit-btn">Cancel</button>
                <button type="button" class="btn btn-primary" id="proceed-order-submit-btn">Proceed Anyway</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalContainer);
    
    // Add close functionality
    document.querySelector('#recent-medication-alert-modal .modal-close').addEventListener('click', closeRecentMedicationAlertModal);
    
    // Close when clicking outside modal content
    modalContainer.addEventListener('click', (event) => {
        if (event.target === modalContainer) {
            closeRecentMedicationAlertModal();
        }
    });
}

/**
 * Close the recent medication alert modal
 */
function closeRecentMedicationAlertModal() {
    const modal = document.getElementById('recent-medication-alert-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Show the recent medication alert modal
 * @param {Array} recentOrders - Recent medication orders
 * @param {Function} confirmCallback - Function to call if user confirms
 */
function showRecentMedicationAlert(recentOrders, confirmCallback) {
    // Create modal if it doesn't exist
    createRecentMedicationAlertModal();
    
    const modal = document.getElementById('recent-medication-alert-modal');
    const listContainer = document.getElementById('recent-medications-list');
    
    if (!modal || !listContainer) return;
    
    // Clear previous content
    listContainer.innerHTML = '';
    
    // Build HTML for recent medications
    let alertHTML = '<table class="table table-striped">'
        + '<thead><tr>'
        + '<th>Medication</th>'
        + '<th>Dose</th>'
        + '<th>Order Date</th>'
        + '<th>Status</th>'
        + '<th>Requested By</th>'
        + '</tr></thead><tbody>';
    
    recentOrders.forEach(order => {
        const orderDate = new Date(order.timestamp);
        const formattedDate = orderDate.toLocaleDateString() + ' ' + orderDate.toLocaleTimeString();
        
        alertHTML += `
            <tr>
                <td>${order.medication.name}</td>
                <td>${order.medication.dose || '-'}</td>
                <td>${formattedDate}</td>
                <td>${order.status.toUpperCase()}</td>
                <td>${order.requesterName || 'Unknown'}</td>
            </tr>
        `;
    });
    
    alertHTML += '</tbody></table>';
    listContainer.innerHTML = alertHTML;
    
    // Setup buttons
    const cancelButton = document.getElementById('cancel-order-submit-btn');
    const proceedButton = document.getElementById('proceed-order-submit-btn');
    
    if (cancelButton && proceedButton) {
        cancelButton.onclick = () => {
            closeRecentMedicationAlertModal();
        };
        
        proceedButton.onclick = () => {
            closeRecentMedicationAlertModal();
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
        };
    }
    
    // Show modal
    modal.classList.remove('hidden');
}

/**
 * Check for recent medication orders for a patient
 * @param {Object} patientData - Patient data
 * @param {Array} medications - Medications to check
 * @returns {Promise} - Promise resolving to array of recent orders
 */
async function checkRecentMedicationOrders(patientData, medications) {
    try {
        // If no API client, skip check
        if (!window.apiClient || typeof window.apiClient.post !== 'function') {
            console.warn('API client not available for recent medication check');
            return [];
        }
        
        // Call the API endpoint
        // Using the correct structure expected by the API
        // Server expects {patient: {...}, medications: [...]}
        console.log('Checking recent medications with data:', { patientData, medications });
        
        // Transform data to match the server's expected format
        const patient = {
            name: patientData.patientName,
            nhsNumber: patientData.nhsNumber,
            hospitalNumber: patientData.hospitalNumber
        };
        
        const response = await window.apiClient.post('/orders/recent-check', {
            patient: patient,
            medications: medications
        });
        
        if (response && response.success) {
            return response.recentOrders || [];
        } else {
            console.error('Error checking recent medications:', response?.message || 'Unknown error');
            return [];
        }
    } catch (error) {
        console.error('Exception checking recent medications:', error);
        return [];
    }
}

/**
 * Create the order detail modal container
 */
function createOrderDetailModal() {
    // Check if container already exists
    if (document.getElementById('order-detail-modal')) {
        return;
    }
        // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.id = 'order-detail-modal';
    modalContainer.className = 'hidden';
    
    // Create modal content
    modalContainer.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Order Details</h3>
                <span class="modal-close">&times;</span>
            </div>
            <div class="modal-body">
                <div id="modal-order-content"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary modal-close-btn">Close</button>
                <button type="button" class="btn btn-edit" id="edit-order-btn">Edit Order</button>
                <button type="button" class="btn btn-save hidden" id="save-order-btn">Save Changes</button>
                <button type="button" class="btn btn-cancel" id="cancel-order-btn">Cancel Order</button>
            </div>
        </div>
    `;
    
    // Add styling for the modal
    const modalStyle = document.createElement('style');
    modalStyle.textContent = `
        #order-detail-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            z-index: 1000;
            overflow-y: auto;
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .modal-content {
            background-color: white;
            margin: 5% auto;
            padding: 25px;
            width: 85%;
            max-width: 800px;
            border-radius: 8px;
            box-shadow: 0 5px 25px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
            position: relative;
        }
        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .modal-title {
            font-size: 1.4em;
            font-weight: bold;
            color: #2196F3;
            margin: 0;
        }
        .modal-close {
            cursor: pointer;
            font-size: 1.8em;
            font-weight: bold;
            color: #999;
            transition: color 0.2s ease;
        }
        .modal-close:hover {
            color: #f44336;
        }
        .modal-body {
            max-height: 60vh;
            overflow-y: auto;
            padding: 10px 0;
        }
        .modal-footer {
            border-top: 2px solid #f0f0f0;
            padding-top: 15px;
            margin-top: 20px;
            text-align: right;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .btn {
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            border: none;
            font-weight: bold;
            font-size: 0.9em;
            transition: all 0.2s ease;
        }
        .btn-secondary {
            background-color: #f0f0f0;
            color: #333;
        }
        .btn-secondary:hover {
            background-color: #e0e0e0;
        }
        .btn-edit {
            background-color: #2196F3;
            color: white;
        }
        .btn-edit:hover {
            background-color: #0d8aee;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        }
        .btn-save {
            background-color: #4CAF50;
            color: white;
        }
        .btn-save:hover {
            background-color: #3d8b40;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        }
        .btn-cancel {
            background-color: #f44336;
            color: white;
        }
        .btn-cancel:hover {
            background-color: #d32f2f;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        }
    `;
    document.head.appendChild(modalStyle);
    
    document.body.appendChild(modalContainer);
    
    // Add close functionality
    document.querySelector('.modal-close').addEventListener('click', closeOrderDetailModal);
    document.querySelector('.modal-close-btn').addEventListener('click', closeOrderDetailModal);
    
    // Close when clicking outside modal content
    modalContainer.addEventListener('click', (event) => {
        if (event.target === modalContainer) {
            closeOrderDetailModal();
        }
    });
}

/**
 * Close the order detail modal
 */
function closeOrderDetailModal() {
    const modal = document.getElementById('order-detail-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Global variable to store the current order being viewed/edited
 */
let currentOrder = null;
let isOrderInEditMode = false;

/**
 * Show order details in modal
 * @param {Object} order - Order object
 */
function showOrderDetails(order) {
    if (!order) return;
    
    // Save the order for reference in edit/save functions
    currentOrder = JSON.parse(JSON.stringify(order)); // Deep clone to avoid modifying the original
    isOrderInEditMode = false;
    
    const modal = document.getElementById('order-detail-modal');
    const contentContainer = document.getElementById('modal-order-content');
    
    if (!modal || !contentContainer) return;
    
    // Render the order in view mode
    renderOrderDetails(false);
    
    // Show modal
    modal.style.display = 'block';
    
    // Setup button handlers
    setupModalButtons();
}

/**
 * Setup the modal buttons based on order status and current mode
 */
function setupModalButtons() {
    // Cancel order button
    const cancelButton = document.getElementById('cancel-order-btn');
    if (cancelButton) {
        if (currentOrder.status === 'pending') {
            cancelButton.classList.remove('hidden');
            cancelButton.onclick = () => cancelOrder(currentOrder.id);
        } else {
            cancelButton.classList.add('hidden');
        }
    }
    
    // Edit order button
    const editButton = document.getElementById('edit-order-btn');
    if (editButton) {
        if (currentOrder.status === 'pending') {
            editButton.classList.remove('hidden');
            editButton.onclick = () => toggleOrderEditMode(true);
        } else {
            editButton.classList.add('hidden');
        }
    }
    
    // Save changes button
    const saveButton = document.getElementById('save-order-btn');
    if (saveButton) {
        saveButton.classList.add('hidden');
        saveButton.onclick = saveOrderChanges;
    }
}

/**
 * Toggle between view and edit modes for an order
 * @param {boolean} editMode - Whether to switch to edit mode
 */
function toggleOrderEditMode(editMode) {
    isOrderInEditMode = editMode;
    
    // Toggle button visibility
    const editButton = document.getElementById('edit-order-btn');
    const saveButton = document.getElementById('save-order-btn');
    
    if (editButton) editButton.classList.toggle('hidden', editMode);
    if (saveButton) saveButton.classList.toggle('hidden', !editMode);
    
    // Re-render the order in the appropriate mode
    renderOrderDetails(editMode);
}

/**
 * Render the order details in either view or edit mode
 * @param {boolean} editMode - Whether to render in edit mode
 */
function renderOrderDetails(editMode) {
    const contentContainer = document.getElementById('modal-order-content');
    if (!contentContainer || !currentOrder) return;
    
    // Format timestamp
    const orderDate = new Date(currentOrder.timestamp);
    const formattedDate = orderDate.toLocaleDateString() + ' ' + orderDate.toLocaleTimeString();
    
    // Build order details HTML
    let detailsHTML = `
        <div class="modal-section">
            <h4 class="modal-section-title">Order Information</h4>
            <table class="order-metadata-table">
                <tr>
                    <th>Order ID</th>
                    <td>${currentOrder.id}</td>
                </tr>
                <tr>
                    <th>Date & Time</th>
                    <td>${formattedDate}</td>
                </tr>
                <tr>
                    <th>Order Type</th>
                    <td>${currentOrder.type === 'patient' ? 'Patient Medication' : 'Ward Stock'}</td>
                </tr>
                <tr>
                    <th>Ward</th>
                    <td>${getWardName(currentOrder.ward)}</td>
                </tr>
                <tr>
                    <th>Status</th>
                    <td><span class="order-status status-${currentOrder.status}">${currentOrder.status.toUpperCase()}</span></td>
                </tr>
                <tr>
                    <th>Requester</th>
                    <td>${currentOrder.requester ? currentOrder.requester.name : 'Unknown'} (${currentOrder.requester ? currentOrder.requester.role : 'Unknown'})</td>
                </tr>
            </table>
        </div>
    `;
    
    // Add patient details if patient order
    if (currentOrder.type === 'patient' && currentOrder.patient) {
        detailsHTML += `
            <div class="modal-section">
                <h4 class="modal-section-title">Patient Information</h4>
                <table class="order-metadata-table">
                    <tr>
                        <th>Name</th>
                        <td>${currentOrder.patient.name || 'Not provided'}</td>
                    </tr>
                    <tr>
                        <th>Hospital ID</th>
                        <td>${currentOrder.patient.hospitalId || 'Not provided'}</td>
                    </tr>
                    ${currentOrder.patient.nhs ? `<tr><th>NHS Number</th><td>${currentOrder.patient.nhs}</td></tr>` : ''}
                    ${currentOrder.patient.dob ? `<tr><th>Date of Birth</th><td>${currentOrder.patient.dob}</td></tr>` : ''}
                </table>
            </div>
        `;
    }
    
    // Add medications list
    detailsHTML += `
        <div class="modal-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 class="modal-section-title" style="margin: 0;">Medications</h4>
                ${editMode ? `<button type="button" class="btn btn-sm" id="add-medication-btn" onclick="addNewMedication()">Add Medication</button>` : ''}
            </div>
            <table class="order-metadata-table" id="medications-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Details</th>
                        ${editMode ? '<th class="medication-actions">Actions</th>' : ''}
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (editMode) {
        // Edit mode: Show editable fields for each medication
        currentOrder.medications.forEach((med, index) => {
            detailsHTML += `
                <tr class="medication-row" data-index="${index}">
                    <td>
                        <input type="text" class="medication-name" value="${med.name || ''}" placeholder="Medication name">
                    </td>
                    <td>
                        <div class="medication-form-row">
                            <input type="text" class="medication-strength" value="${med.strength || ''}" placeholder="Strength">
                            <input type="text" class="medication-form" value="${med.form || ''}" placeholder="Form">
                            <input type="number" class="medication-quantity medication-small-input" value="${med.quantity || ''}" placeholder="Qty">
                        </div>
                        <div class="medication-form-row">
                            <input type="text" class="medication-dose" value="${med.dose || ''}" placeholder="Dose instructions">
                        </div>
                        <div class="medication-form-row">
                            <input type="text" class="medication-notes" value="${med.notes || ''}" placeholder="Notes (optional)">
                        </div>
                    </td>
                    <td class="medication-actions">
                        <button type="button" class="btn btn-danger btn-sm" onclick="removeMedication(${index})">Remove</button>
                    </td>
                </tr>
            `;
        });
    } else {
        // View mode: Show medication details
        currentOrder.medications.forEach(med => {
            const medDetails = [];
            if (med.strength) medDetails.push(med.strength);
            if (med.form) medDetails.push(med.form);
            if (med.quantity) medDetails.push(`Quantity: ${med.quantity}`);
            if (med.dose) medDetails.push(`Dose: ${med.dose}`);
            if (med.notes) medDetails.push(`Notes: ${med.notes}`);
            
            detailsHTML += `
                <tr>
                    <td>${med.name || 'Unknown'}</td>
                    <td>${medDetails.join(', ') || 'No details'}</td>
                </tr>
            `;
        });
    }
    
    detailsHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    // Update content 
    contentContainer.innerHTML = detailsHTML;
}

/**
 * Add a new blank medication to the current order
 */
function addNewMedication() {
    if (!currentOrder || !currentOrder.medications) return;
    
    // Add a new empty medication
    currentOrder.medications.push({
        name: '',
        strength: '',
        form: '',
        quantity: '',
        dose: '',
        notes: ''
    });
    
    // Re-render in edit mode
    renderOrderDetails(true);
    
    // Focus the new medication's name field
    setTimeout(() => {
        const medicationRows = document.querySelectorAll('.medication-row');
        if (medicationRows.length > 0) {
            const lastRow = medicationRows[medicationRows.length - 1];
            const nameInput = lastRow.querySelector('.medication-name');
            if (nameInput) nameInput.focus();
        }
    }, 0);
}

/**
 * Remove a medication from the current order
 * @param {number} index - Index of the medication to remove
 */
function removeMedication(index) {
    if (!currentOrder || !currentOrder.medications || index < 0 || index >= currentOrder.medications.length) return;
    
    // Remove the medication
    currentOrder.medications.splice(index, 1);
    
    // Re-render in edit mode
    renderOrderDetails(true);
}

/**
 * Save changes made to the order
 */
async function saveOrderChanges() {
    if (!currentOrder) return;
    
    try {
        // Gather medication data from the form
        if (isOrderInEditMode) {
            // Parse all medication fields from form inputs
            const medicationRows = document.querySelectorAll('.medication-row');
            const medications = [];
            
            medicationRows.forEach(row => {
                const nameInput = row.querySelector('.medication-name');
                const strengthInput = row.querySelector('.medication-strength');
                const formInput = row.querySelector('.medication-form');
                const quantityInput = row.querySelector('.medication-quantity');
                const doseInput = row.querySelector('.medication-dose');
                const notesInput = row.querySelector('.medication-notes');
                
                // Only add medications with at least a name
                if (nameInput && nameInput.value.trim()) {
                    medications.push({
                        name: nameInput.value.trim(),
                        strength: strengthInput ? strengthInput.value.trim() : '',
                        form: formInput ? formInput.value.trim() : '',
                        quantity: quantityInput ? quantityInput.value.trim() : '',
                        dose: doseInput ? doseInput.value.trim() : '',
                        notes: notesInput ? notesInput.value.trim() : ''
                    });
                }
            });
            
            // Update the current order
            currentOrder.medications = medications;
        }
        
        // Check if there are any medications
        if (!currentOrder.medications.length) {
            showToastNotification('Order must have at least one medication', 'error');
            return;
        }
        
        // If we have an API client with updateOrder method
        if (window.apiClient && typeof window.apiClient.updateOrder === 'function') {
            showToastNotification('Saving changes...', 'info');
            
            // Call API to update order
            const response = await window.apiClient.updateOrder(currentOrder.id, currentOrder);
            
            if (response && response.success) {
                showToastNotification('Order updated successfully', 'success');
                
                // Update local order cache if using OrderManager
                if (OrderManager) {
                    OrderManager.updateOrder(currentOrder);
                }
                
                // Switch back to view mode and refresh orders list
                toggleOrderEditMode(false);
                loadRecentOrders();
            } else {
                showToastNotification(`Error updating order: ${response.message || 'Unknown error'}`, 'error');
            }
        } 
        // If we only have local OrderManager
        else if (OrderManager) {
            OrderManager.updateOrder(currentOrder);
            showToastNotification('Order updated successfully', 'success');
            toggleOrderEditMode(false);
            loadRecentOrders();
        } else {
            showToastNotification('Order update not supported', 'error');
        }
    } catch (error) {
        console.error('Error updating order:', error);
        showToastNotification(`Error: ${error.message || 'Unknown error'}`, 'error');
    }
}

/**
 * Cancel an order
 * @param {string} orderId - Order ID to cancel
 */
async function cancelOrder(orderId) {
    try {
        if (!orderId) return;
        
        if (window.confirm('Are you sure you want to cancel this order?')) {
            // If we have an API client with cancelOrder method
            if (window.apiClient && typeof window.apiClient.cancelOrder === 'function') {
                showToastNotification('Cancelling order...', 'info');
                
                // Call API to cancel order
                const response = await window.apiClient.cancelOrder(orderId);
                
                if (response && response.success) {
                    showToastNotification('Order cancelled successfully', 'success');
                    
                    // Update local order status if using OrderManager
                    if (OrderManager) {
                        OrderManager.updateOrderStatus(orderId, 'cancelled');
                    }
                    
                    // Close modal and refresh orders list
                    closeOrderDetailModal();
                    loadRecentOrders();
                } else {
                    showToastNotification(`Error cancelling order: ${response.message || 'Unknown error'}`, 'error');
                }
            } 
            // If we only have local OrderManager
            else if (OrderManager) {
                OrderManager.updateOrderStatus(orderId, 'cancelled');
                showToastNotification('Order cancelled successfully', 'success');
                closeOrderDetailModal();
                loadRecentOrders();
            } else {
                showToastNotification('Order cancellation not supported', 'error');
            }
        }
    } catch (error) {
        console.error('Error cancelling order:', error);
        showToastNotification(`Error: ${error.message || 'Unknown error'}`, 'error');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Create toast container for notifications
    createToastContainer();
    
    // Create order details modal
    createOrderDetailModal();
    
    // Load user information
    await loadCurrentUser();
    
    // Load wards from database
    await populateWardDropdowns();
    
    // Initialize medication autocomplete
    if (typeof MedicationManager !== 'undefined') {
        initMedicationAutocomplete();
    } else {
        console.error('MedicationManager not found');
    }
    
    // Tab switching
    initializeTabs();
    
    // Form functionality
    initializePatientOrderForm();
    initializeWardStockForm();
    
    // Load recent orders
    loadRecentOrders();
});

/**
 * Create toast container for notifications
 */
function createToastContainer() {
    // Check if container already exists
    if (document.getElementById('toast-container')) {
        return;
    }
    
    // Create toast container
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
    
    // Add basic styles if not already in stylesheet
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            #toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
            }
            .toast {
                min-width: 250px;
                margin-bottom: 10px;
                padding: 12px 20px;
                border-radius: 4px;
                color: white;
                box-shadow: 0 3px 6px rgba(0,0,0,0.16);
                transition: all 0.3s ease;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .toast.success {
                background-color: #4caf50;
            }
            .toast.info {
                background-color: #2196F3;
            }
            .toast.warning {
                background-color: #ff9800;
            }
            .toast.error {
                background-color: #f44336;
            }
            .toast-close {
                cursor: pointer;
                margin-left: 10px;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Show a toast notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, info, warning, error)
 */
function showToastNotification(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        createToastContainer();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div>${message}</div>
        <span class="toast-close">&times;</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Add click event to close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

/**
 * Load and set current user information
 */
async function loadCurrentUser() {
    try {
        console.log('Loading current user information...');
        
        // Check if API client is available
        if (!window.apiClient) {
            console.error('API client not available for user authentication');
            // Set default values to prevent form submission errors
            setRequesterFields('Unknown User', 'ordering');
            return;
        }
        
        try {
            // Get the current user using the API client (which handles auth tokens)
            console.log('Calling apiClient.getCurrentUser()...');
            const userData = await window.apiClient.getCurrentUser();
            console.log('getCurrentUser result:', userData);
            
            // First method: Direct API response format
            if (userData && userData.success && userData.user) {
                // Store user info in window object for easy access
                window.currentUser = userData.user;
                
                // Get name and role from user data
                const name = userData.user.first_name && userData.user.surname 
                    ? `${userData.user.first_name} ${userData.user.surname}` 
                    : userData.user.username;
                const role = userData.user.roles && userData.user.roles.length > 0 
                    ? userData.user.roles[0] 
                    : 'ordering';
                
                // Set requester fields
                setRequesterFields(name, role);
                
                // Display user info in header if applicable
                const userInfoElement = document.getElementById('user-info');
                if (userInfoElement) {
                    userInfoElement.textContent = `Logged in as: ${name} (${role})`;
                }
                
                console.log(`User set to: ${name} (${role})`);
                return; // Successfully set user
            } 
            
            // Second method: Direct localStorage userData format
            else if (userData && (userData.first_name || userData.surname || userData.name || userData.username)) {
                // Use pre-computed name if available
                let name = userData.name;
                
                // Fallback to constructing from first_name/surname
                if (!name && (userData.first_name || userData.surname)) {
                    name = `${userData.first_name || ''} ${userData.surname || ''}`.trim();
                }
                
                // Last resort: username
                if (!name) {
                    name = userData.username || 'Unknown User';
                }
                
                // Get role
                const role = userData.roles && userData.roles.length > 0 
                    ? userData.roles[0] 
                    : 'ordering';
                
                // Store in window object
                window.currentUser = userData;
                
                // Set requester fields
                setRequesterFields(name, role);
                
                // Display user info in header if applicable
                const userInfoElement = document.getElementById('user-info');
                if (userInfoElement) {
                    userInfoElement.textContent = `Logged in as: ${name} (${role})`;
                }
                
                console.log(`User set to: ${name} (${role})`);
                return; // Successfully set user
            }
            
            else {
                console.error('Failed to load user data or missing user info');
                console.log('userData received:', userData);
            }
        } catch (apiError) {
            console.error('API error loading user data:', apiError);
        }
        
        // Try to get user data directly from localStorage as fallback
        console.log('Trying localStorage fallback...');
        const storedUserDataEncrypted = localStorage.getItem('userData');
        const token = localStorage.getItem('token');
        console.log('token exists:', !!token);
        console.log('userData exists:', !!storedUserDataEncrypted);
        
        if (storedUserDataEncrypted) {
            try {
                // Attempt to decrypt manually
                if (window.apiClient && typeof window.apiClient.decryptData === 'function') {
                    console.log('Manually decrypting userData...');
                    const decrypted = window.apiClient.decryptData(storedUserDataEncrypted);
                    if (decrypted) {
                        const userData = JSON.parse(decrypted);
                        console.log('Manually decrypted userData:', userData);
                        
                        // Use name field if available (added in our updated login function)
                        const name = userData.name || userData.username || 'Unknown User';
                        const role = userData.roles?.[0] || 'ordering';
                        
                        setRequesterFields(name, role);
                        console.log(`User set to: ${name} (${role})`);
                        return;
                    }
                }
            } catch (decryptError) {
                console.error('Error decrypting stored user data:', decryptError);
            }
        }
        
        // Last resort - hardcode user info for testing only
        const testUserName = 'Test User';
        const testUserRole = 'ordering';
        console.warn(`Setting default test user: ${testUserName}`);
        setRequesterFields(testUserName, testUserRole);
    } catch (error) {
        console.error('Unexpected error in loadCurrentUser:', error);
        setRequesterFields('Unknown User', 'ordering'); // Set defaults
    }
}

/**
 * Helper to set requester fields throughout the forms
 * @param {string} name - Requester name
 * @param {string} role - Requester role
 */
function setRequesterFields(name, role) {
    // Set hidden requester fields in patient order form
    const patientRequesterName = document.getElementById('requester-name');
    const patientRequesterRole = document.getElementById('requester-role');
    if (patientRequesterName) patientRequesterName.value = name;
    if (patientRequesterRole) patientRequesterRole.value = role;
    
    // Set requester fields in ward stock form
    const wsRequesterName = document.getElementById('ws-requester-name');
    const wsRequesterRole = document.getElementById('ws-requester-role');
    if (wsRequesterName) wsRequesterName.value = name;
    if (wsRequesterRole) wsRequesterRole.value = role;
}

/**
 * Populate ward dropdowns with data from database
 */
async function populateWardDropdowns() {
    try {
        // Get ward data using the API client
        if (!window.apiClient) {
            console.error('API client not available');
            return;
        }
        
        const response = await window.apiClient.getAllWards();
        
        if (response && response.success && Array.isArray(response.wards)) {
            const wards = response.wards;
            
            // Store ward data in global cache for mapping IDs to names
            window.wardsCache = {};
            wards.forEach(ward => {
                window.wardsCache[ward.id] = ward;
            });
            
            // Populate patient form ward dropdown
            const patientWardDropdown = document.getElementById('ward-name');
            if (patientWardDropdown) {
                // Clear all options except the first placeholder
                patientWardDropdown.innerHTML = '<option value="">Select Ward</option>';
                
                // Add ward options
                wards.forEach(ward => {
                    const option = document.createElement('option');
                    option.value = ward.id.toString();
                    option.textContent = ward.name;
                    patientWardDropdown.appendChild(option);
                });
            }
            
            // Populate ward stock form ward dropdown
            const wardStockWardDropdown = document.getElementById('ws-ward-name');
            if (wardStockWardDropdown) {
                // Clear all options except the first placeholder
                wardStockWardDropdown.innerHTML = '<option value="">Select Ward</option>';
                
                // Add ward options
                wards.forEach(ward => {
                    const option = document.createElement('option');
                    option.value = ward.id.toString();
                    option.textContent = ward.name;
                    wardStockWardDropdown.appendChild(option);
                });
            }
        } else {
            console.error('Failed to load wards data');
        }
    } catch (error) {
        console.error('Error loading wards:', error);
    }
}

/**
 * Get ward name from ID using the cache
 * @param {string|number} wardId - Ward ID
 * @returns {string} - Ward name or ID if not found
 */
function getWardName(wardId) {
    if (!wardId) return 'Unknown';
    
    // Try to get from cache
    if (window.wardsCache && window.wardsCache[wardId]) {
        return window.wardsCache[wardId].name;
    }
    
    // Fallback: return ID
    return wardId;
}

/**
 * Initialize tab switching functionality
 */
function initializeTabs() {
    const patientTab = document.getElementById('patient-tab');
    const wardStockTab = document.getElementById('ward-stock-tab');
    const patientForm = document.getElementById('patient-order-form');
    const wardStockForm = document.getElementById('ward-stock-form');
    
    if (patientTab && wardStockTab && patientForm && wardStockForm) {
        // Set initial state
        patientForm.classList.add('active');
        wardStockForm.classList.remove('active');
        patientTab.classList.add('active');
        wardStockTab.classList.remove('active');
        
        patientTab.addEventListener('click', () => {
            patientTab.classList.add('active');
            wardStockTab.classList.remove('active');
            patientForm.classList.add('active');
            wardStockForm.classList.remove('active');
        });
        
        wardStockTab.addEventListener('click', () => {
            wardStockTab.classList.add('active');
            patientTab.classList.remove('active');
            wardStockForm.classList.add('active');
            patientForm.classList.remove('active');
        });
    } else {
        console.error('Tab elements not found');
    }
}

/**
 * Initialize patient order form functionality
 */
function initializePatientOrderForm() {
    const patientForm = document.getElementById('patient-med-form');
    const addMedicationBtn = document.getElementById('add-medication-btn');
    const medicationsContainer = document.getElementById('medications-container');
    
    if (addMedicationBtn && medicationsContainer) {
        // Add new medication field
        addMedicationBtn.addEventListener('click', () => {
            const medicationItems = document.querySelectorAll('.medication-item');
            const newIndex = medicationItems.length + 1;
            
            const newItem = createMedicationItem(newIndex);
            medicationsContainer.appendChild(newItem);
            
            // Setup autocomplete for the new medication field
            if (typeof MedicationManager !== 'undefined') {
                setupMedicationAutocomplete(document.getElementById(`med-name-${newIndex}`));
                setupFormulationAutocomplete(document.getElementById(`med-form-${newIndex}`));
            }
        });
        
        // Form submission
        if (patientForm) {
            patientForm.addEventListener('submit', (event) => {
                event.preventDefault();
                submitPatientOrder();
            });
            
            // Save draft button
            const saveDraftBtn = document.getElementById('save-draft-btn');
            if (saveDraftBtn) {
                saveDraftBtn.addEventListener('click', () => {
                    saveOrderAsDraft('patient');
                });
            }
        }
    }
}

/**
 * Initialize ward stock form functionality
 */
function initializeWardStockForm() {
    const wardStockForm = document.getElementById('ward-stock-med-form');
    const addMedicationBtn = document.getElementById('ws-add-medication-btn');
    const medicationsContainer = document.getElementById('ws-medications-container');
    
    if (addMedicationBtn && medicationsContainer) {
        // Add new medication field
        addMedicationBtn.addEventListener('click', () => {
            const medicationItems = document.querySelectorAll('#ws-medications-container .medication-item');
            const newIndex = medicationItems.length + 1;
            
            const newItem = createWardStockMedicationItem(newIndex);
            medicationsContainer.appendChild(newItem);
            
            // Setup autocomplete for the new medication field
            if (typeof MedicationManager !== 'undefined') {
                setupMedicationAutocomplete(document.getElementById(`ws-med-name-${newIndex}`));
                setupFormulationAutocomplete(document.getElementById(`ws-med-form-${newIndex}`));
            }
        });
        
        // Form submission
        if (wardStockForm) {
            wardStockForm.addEventListener('submit', (event) => {
                event.preventDefault();
                submitWardStockOrder();
            });
            
            // Save draft button
            const saveDraftBtn = document.getElementById('ws-save-draft-btn');
            if (saveDraftBtn) {
                saveDraftBtn.addEventListener('click', () => {
                    saveOrderAsDraft('ward-stock');
                });
            }
        }
    }
}

/**
 * Initialize medication autocomplete
 */
function initMedicationAutocomplete() {
    // Load medication data from JSON files
    loadMedicationData()
        .then(() => {
            // Set up autocomplete for initial medication fields
            setupMedicationAutocomplete(document.getElementById('med-name-1'));
            setupFormulationAutocomplete(document.getElementById('med-form-1'));
            
            // Set up autocomplete for initial ward stock medication fields
            setupMedicationAutocomplete(document.getElementById('ws-med-name-1'));
            setupFormulationAutocomplete(document.getElementById('ws-med-form-1'));
        })
        .catch(error => {
            console.error('Error loading medication data:', error);
        });
}

/**
 * Load medication data from JSON files
 */
async function loadMedicationData() {
    try {
        // Load drug aliases from the comprehensive JSON file
        const drugAliasesResponse = await fetch('/data/drug_aliases.json');
        let drugAliasesData = await drugAliasesResponse.json();
        
        // Load formulation aliases from the comprehensive JSON file
        const formulationAliasesResponse = await fetch('/data/formulation_aliases.json');
        let formulationAliasesData = await formulationAliasesResponse.json();
        
        // Load brand exceptions list
        const brandExceptionsResponse = await fetch('/data/brand_exceptions.json');
        let brandExceptionsData = await brandExceptionsResponse.json();
        
        // Create a flat array of all brand exception drugs
        const brandExceptionsList = [];
        if (brandExceptionsData && brandExceptionsData.brandExceptions) {
            brandExceptionsData.brandExceptions.forEach(category => {
                if (category.drugs && Array.isArray(category.drugs)) {
                    category.drugs.forEach(drug => {
                        brandExceptionsList.push(drug.toLowerCase());
                    });
                }
            });
        }
        
        // Process drug aliases into a format suitable for autocomplete
        const processedMedications = [];
        
        // Create alias-to-generic mapping
        const aliasToGenericMap = {};
        
        drugAliasesData.forEach(drug => {
            // Add the main drug name
            processedMedications.push(drug.name);
            
            // Add all aliases and build the mapping
            if (drug.aliases && Array.isArray(drug.aliases)) {
                drug.aliases.forEach(alias => {
                    if (!processedMedications.includes(alias)) {
                        processedMedications.push(alias);
                    }
                    
                    // Create mapping from alias to generic name
                    // Check if this drug should be prescribed by brand
                    // Check if this is a combination medication (contains '/')
                    const isCombinationMedication = drug.name.includes('/');
                    
                    // Check if this drug should be prescribed by brand
                    const shouldUseGeneric = !brandExceptionsList.some(exception => {
                        // Check if the drug name or alias contains any of the brand exceptions
                        return drug.name.toLowerCase().includes(exception) || 
                               alias.toLowerCase().includes(exception);
                    });
                    
                    // Map the alias to generic name only if:
                    // 1. It's not a brand exception AND
                    // 2. It's not a combination medication
                    if (shouldUseGeneric && !isCombinationMedication) {
                        aliasToGenericMap[alias.toLowerCase()] = drug.name;
                    } else if (isCombinationMedication) {
                        console.log(`Skipping alias mapping for combination medication: ${alias} -> ${drug.name}`);
                    }
                });
            }
        });
        
        // Process formulation aliases
        const processedFormulations = {};
        if (formulationAliasesData && formulationAliasesData.formulations) {
            Object.entries(formulationAliasesData.formulations).forEach(([key, aliases]) => {
                processedFormulations[key] = aliases;
            });
        }
        
        console.log(`Loaded ${processedMedications.length} medications and ${Object.keys(processedFormulations).length} formulation categories`);
        console.log(`Created mapping for ${Object.keys(aliasToGenericMap).length} drug aliases to generic names`);
        console.log(`Loaded ${brandExceptionsList.length} brand exceptions that should not be converted to generic`);
        
        // Setup autocomplete data
        window.medicationsData = processedMedications;
        window.formulationsData = processedFormulations;
        window.rawDrugAliasesData = drugAliasesData; // Keep the original structured data for reference
        window.aliasToGenericMap = aliasToGenericMap; // Store the alias-to-generic mapping
        window.brandExceptionsList = brandExceptionsList; // Store the brand exceptions list
    } catch (error) {
        console.error('Error loading medication data:', error);
        
        // Fallback to some basic data if loading fails
        window.medicationsData = [
            'Paracetamol', 'Ibuprofen', 'Aspirin', 'Amoxicillin',
            'Omeprazole', 'Salbutamol', 'Simvastatin', 'Ramipril'
        ];
        
        window.formulationsData = {
            'tablets': ['tablet', 'tablets', 'tab', 'tabs'],
            'capsules': ['capsule', 'capsules', 'cap', 'caps'],
            'liquid': ['syrup', 'solution', 'suspension', 'elixir'],
            'injection': ['injection', 'injectable', 'vial', 'ampoule']
        };
        
        window.aliasToGenericMap = {};
        window.brandExceptionsList = [];
    }
}

/**
 * Setup medication name autocomplete
 * @param {HTMLInputElement} inputElement - Input element
 */
function setupMedicationAutocomplete(inputElement) {
    if (!inputElement || !window.medicationsData || !window.medicationsData.length) return;
    
    // Create a simple autocomplete wrapper around the input
    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';
    inputElement.parentNode.insertBefore(wrapper, inputElement);
    wrapper.appendChild(inputElement);
    
    // Add autocomplete="off" to prevent browser autofill
    inputElement.setAttribute('autocomplete', 'off');
    
    // Create the autocomplete dropdown
    const dropdownList = document.createElement('ul');
    dropdownList.className = 'autocomplete-list';
    wrapper.appendChild(dropdownList);
    
    // Create a tooltip element for brand name information
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'medication-tooltip';
    tooltipElement.style.display = 'none';
    tooltipElement.style.position = 'absolute';
    tooltipElement.style.backgroundColor = '#f9f9f9';
    tooltipElement.style.border = '1px solid #ccc';
    tooltipElement.style.borderRadius = '4px';
    tooltipElement.style.padding = '8px';
    tooltipElement.style.zIndex = '1000';
    tooltipElement.style.maxWidth = '300px';
    tooltipElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    wrapper.appendChild(tooltipElement);
    
    // Function to check if a medication should be prescribed by brand name
    function shouldPrescribeByBrand(medicationName) {
        if (!window.brandExceptionsList || !medicationName) return false;
        
        const medNameLower = medicationName.toLowerCase();
        return window.brandExceptionsList.some(exception => {
            return medNameLower.includes(exception);
        });
    }
    
    // Function to get the generic name for an alias
    function getGenericName(alias) {
        if (!window.aliasToGenericMap || !alias) return alias;
        
        const aliasLower = alias.toLowerCase();
        return window.aliasToGenericMap[aliasLower] || alias;
    }
    
    // Show options based on input
    inputElement.addEventListener('input', () => {
        const value = inputElement.value.toLowerCase().trim();
        dropdownList.innerHTML = '';
        tooltipElement.style.display = 'none';
        
        if (value.length < 2) {
            dropdownList.style.display = 'none';
            return;
        }
        
        // Find matching medications from our comprehensive list
        const matches = window.medicationsData
            .filter(med => {
                if (typeof med === 'string') {
                    return med.toLowerCase().includes(value);
                }
                return false;
            })
            .sort((a, b) => {
                // Sort exact matches first, then by string length (shorter first), then alphabetically
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();
                
                // Exact matches first
                if (aLower === value && bLower !== value) return -1;
                if (bLower === value && aLower !== value) return 1;
                
                // Then matches that start with the search term
                if (aLower.startsWith(value) && !bLower.startsWith(value)) return -1;
                if (bLower.startsWith(value) && !aLower.startsWith(value)) return 1;
                
                // Then by length (shorter first)
                if (a.length !== b.length) return a.length - b.length;
                
                // Finally alphabetically
                return a.localeCompare(b);
            })
            .slice(0, 15); // Limit to 15 results for better performance
        
        if (matches.length > 0) {
            dropdownList.style.display = 'block';
            matches.forEach(med => {
                const item = document.createElement('li');
                item.textContent = med;
                
                // Add visual indicator if this is a brand name exception
                if (shouldPrescribeByBrand(med)) {
                    item.classList.add('brand-name-exception');
                    item.style.fontWeight = 'bold';
                    item.style.color = '#0066cc';
                }
                
                item.addEventListener('click', () => {
                    const selectedMed = item.textContent;
                    
                    // Check if this medication should be prescribed by brand name
                    if (shouldPrescribeByBrand(selectedMed)) {
                        // Use the selected brand name as is
                        inputElement.value = selectedMed;
                        
                        // Show tooltip with brand name information
                        tooltipElement.textContent = 'This medication should be prescribed by brand name for patient safety.';
                        tooltipElement.style.display = 'block';
                        
                        // Hide tooltip after 5 seconds
                        setTimeout(() => {
                            tooltipElement.style.display = 'none';
                        }, 5000);
                    } else {
                        // Convert to generic name if it's an alias
                        const genericName = getGenericName(selectedMed);
                        inputElement.value = genericName;
                        
                        // If we converted to a generic name, show a tooltip
                        if (genericName !== selectedMed) {
                            tooltipElement.textContent = `Converted "${selectedMed}" to generic name "${genericName}"`;
                            tooltipElement.style.display = 'block';
                            
                            // Hide tooltip after 5 seconds
                            setTimeout(() => {
                                tooltipElement.style.display = 'none';
                            }, 5000);
                        }
                    }
                    
                    dropdownList.style.display = 'none';
                    
                    // Trigger change event to update related fields (e.g., formulation)
                    const event = new Event('change');
                    inputElement.dispatchEvent(event);
                });
                
                // Add hover effect for brand name exceptions
                if (shouldPrescribeByBrand(med)) {
                    item.addEventListener('mouseenter', () => {
                        tooltipElement.textContent = 'This medication should be prescribed by brand name for patient safety.';
                        tooltipElement.style.display = 'block';
                    });
                    
                    item.addEventListener('mouseleave', () => {
                        tooltipElement.style.display = 'none';
                    });
                }
                
                dropdownList.appendChild(item);
            });
        } else {
            dropdownList.style.display = 'none';
        }
    });
    
    // Hide dropdown when clicking elsewhere
    document.addEventListener('click', (event) => {
        if (!wrapper.contains(event.target)) {
            dropdownList.style.display = 'none';
            tooltipElement.style.display = 'none';
        }
    });
}

/**
 * Setup formulation autocomplete
 * @param {HTMLInputElement} inputElement - Input element
 */
function setupFormulationAutocomplete(inputElement) {
    if (!inputElement || !window.formulationsData) return;
    
    // Create a simple autocomplete wrapper around the input
    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';
    inputElement.parentNode.insertBefore(wrapper, inputElement);
    wrapper.appendChild(inputElement);
    
    // Add autocomplete="off" to prevent browser autofill
    inputElement.setAttribute('autocomplete', 'off');
    
    // Create the autocomplete dropdown
    const dropdownList = document.createElement('ul');
    dropdownList.className = 'autocomplete-list';
    wrapper.appendChild(dropdownList);
    
    // Show options based on input
    inputElement.addEventListener('input', () => {
        const value = inputElement.value.toLowerCase().trim();
        dropdownList.innerHTML = '';
        
        if (value.length < 2) {
            dropdownList.style.display = 'none';
            return;
        }
        
        // Collect all formulation terms
        const allFormulations = [];
        for (const [category, terms] of Object.entries(window.formulationsData)) {
            terms.forEach(term => {
                if (!allFormulations.includes(term)) {
                    allFormulations.push(term);
                }
            });
        }
        
        // Find matching formulations
        const matches = allFormulations
            .filter(form => form.toLowerCase().includes(value))
            .sort((a, b) => {
                // Sort exact matches first, then by string length (shorter first), then alphabetically
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();
                
                // Exact matches first
                if (aLower === value && bLower !== value) return -1;
                if (bLower === value && aLower !== value) return 1;
                
                // Then matches that start with the search term
                if (aLower.startsWith(value) && !bLower.startsWith(value)) return -1;
                if (bLower.startsWith(value) && !aLower.startsWith(value)) return 1;
                
                // Then by length (shorter first)
                if (a.length !== b.length) return a.length - b.length;
                
                // Finally alphabetically
                return a.localeCompare(b);
            })
            .slice(0, 15); // Limit to 15 results
        
        if (matches.length > 0) {
            dropdownList.style.display = 'block';
            matches.forEach(form => {
                const item = document.createElement('li');
                item.textContent = form;
                item.addEventListener('click', () => {
                    inputElement.value = item.textContent;
                    dropdownList.style.display = 'none';
                    
                    // Trigger change event
                    const event = new Event('change');
                    inputElement.dispatchEvent(event);
                });
                dropdownList.appendChild(item);
            });
        } else {
            dropdownList.style.display = 'none';
        }
    });
    
    // Hide dropdown when clicking elsewhere
    document.addEventListener('click', (event) => {
        if (!wrapper.contains(event.target)) {
            dropdownList.style.display = 'none';
        }
    });
}

/**
 * Create a new medication item element
 * @param {number} index - Medication index
 * @returns {HTMLElement} - Medication item element
 */
function createMedicationItem(index) {
    const newItem = document.createElement('div');
    newItem.className = 'medication-item';
    newItem.innerHTML = `
        <button type="button" class="remove-med-btn" data-index="${index}">&times;</button>
        <div class="form-row">
            <div class="form-column">
                <label for="med-name-${index}">Medicine Name:</label>
                <input type="text" id="med-name-${index}" class="med-name" required />
            </div>
            <div class="form-column">
                <label for="med-form-${index}">Form:</label>
                <input type="text" id="med-form-${index}" class="med-form" placeholder="e.g., tablets, capsules" />
            </div>
        </div>

        <div class="form-row">
            <div class="form-column">
                <label for="med-strength-${index}">Strength:</label>
                <input type="text" id="med-strength-${index}" class="med-strength" placeholder="e.g., 500mg" />
            </div>
            <div class="form-column">
                <label for="med-quantity-${index}">Quantity:</label>
                <input type="text" id="med-quantity-${index}" class="med-quantity" placeholder="e.g., 28" required />
            </div>
        </div>

        <div class="form-row">
            <div class="form-column">
                <label for="med-dose-${index}">Dose:</label>
                <input type="text" id="med-dose-${index}" class="med-dose" placeholder="e.g., 1-2 tablets daily" autocomplete="off" />
            </div>
            <div class="form-column full-width">
                <label for="med-notes-${index}">Special Instructions:</label>
                <textarea id="med-notes-${index}" class="med-notes" rows="2" placeholder="Any special instructions or notes"></textarea>
            </div>
        </div>
    `;
    
    // Add remove button functionality
    newItem.querySelector('.remove-med-btn').addEventListener('click', (event) => {
        newItem.remove();
    });
    
    return newItem;
}

/**
 * Create a new ward stock medication item element
 * @param {number} index - Medication index
 * @returns {HTMLElement} - Medication item element
 */
function createWardStockMedicationItem(index) {
    const newItem = document.createElement('div');
    newItem.className = 'medication-item';
    newItem.innerHTML = `
        <button type="button" class="remove-med-btn" data-index="${index}">&times;</button>
        <div class="form-row">
            <div class="form-column">
                <label for="ws-med-name-${index}">Medicine Name:</label>
                <input type="text" id="ws-med-name-${index}" class="med-name" required />
            </div>
            <div class="form-column">
                <label for="ws-med-form-${index}">Form:</label>
                <input type="text" id="ws-med-form-${index}" class="med-form" placeholder="e.g., tablets, capsules" />
            </div>
        </div>

        <div class="form-row">
            <div class="form-column">
                <label for="ws-med-strength-${index}">Strength:</label>
                <input type="text" id="ws-med-strength-${index}" class="med-strength" placeholder="e.g., 500mg" />
            </div>
            <div class="form-column">
                <label for="ws-med-quantity-${index}">Quantity:</label>
                <input type="text" id="ws-med-quantity-${index}" class="med-quantity" placeholder="e.g., 28" required />
            </div>
        </div>

        <div class="form-row">
            <div class="form-column">
                <label for="ws-med-dose-${index}">Dose:</label>
                <input type="text" id="ws-med-dose-${index}" class="med-dose" placeholder="e.g., 1-2 tablets daily" autocomplete="off" />
            </div>
        </div>
    `;
    
    // Add remove button functionality
    newItem.querySelector('.remove-med-btn').addEventListener('click', (event) => {
        newItem.remove();
    });
    
    return newItem;
}

/**
 * Submit patient medication order
 */
/**
 * Collect medication data from patient order form
 * @returns {Array} - Array of medication objects
 */
function collectMedicationsData() {
    const medicationItems = document.querySelectorAll('#medications-container .medication-item');
    const medications = [];
    
    medicationItems.forEach(item => {
        const nameInput = item.querySelector('.med-name');
        const formInput = item.querySelector('.med-form');
        const strengthInput = item.querySelector('.med-strength');
        const quantityInput = item.querySelector('.med-quantity');
        const doseInput = item.querySelector('.med-dose');
        const notesInput = item.querySelector('.med-notes');
        
        // Only add if we have at least a name and quantity
        if (nameInput && nameInput.value && quantityInput && quantityInput.value) {
            medications.push({
                name: nameInput.value,
                form: formInput ? formInput.value : '',
                strength: strengthInput ? strengthInput.value : '',
                quantity: quantityInput.value,
                dose: doseInput ? doseInput.value : '',
                notes: notesInput ? notesInput.value : ''
            });
        }
    });
    
    return medications;
}

/**
 * Collect medication data from ward stock order form
 * @returns {Array} - Array of medication objects
 */
function collectWardStockMedicationsData() {
    const medicationItems = document.querySelectorAll('#ward-stock-medications-container .medication-item');
    const medications = [];
    
    medicationItems.forEach(item => {
        const nameInput = item.querySelector('.med-name');
        const formInput = item.querySelector('.med-form');
        const strengthInput = item.querySelector('.med-strength');
        const quantityInput = item.querySelector('.med-quantity');
        const doseInput = item.querySelector('.med-dose');
        
        // Only add if we have at least a name and quantity
        if (nameInput && nameInput.value && quantityInput && quantityInput.value) {
            medications.push({
                name: nameInput.value,
                form: formInput ? formInput.value : '',
                strength: strengthInput ? strengthInput.value : '',
                quantity: quantityInput.value,
                dose: doseInput ? doseInput.value : ''
            });
        }
    });
    
    return medications;
}

/**
 * Submit patient medication order
 */
async function submitPatientOrder() {
    try {
        // Collect form data
        const wardId = document.getElementById('ward-name').value;
        const patientName = document.getElementById('patient-name').value;
        const patientDOB = document.getElementById('patient-dob').value;
        const patientNHS = document.getElementById('patient-nhs').value;
        const patientID = document.getElementById('hospital-id').value;
        
        // Get requester info from hidden fields (populated from logged-in user)
        const requesterName = document.getElementById('requester-name').value;
        const requesterRole = document.getElementById('requester-role').value;
        
        // Validate required fields
        if (!wardId) {
            alert('Please select a ward.');
            return;
        }
        
        if (!patientName) {
            alert('Patient name is required.');
            return;
        }
        
        if (!patientID) {
            alert('Hospital ID is required.');
            return;
        }
        
        if (!requesterName || !requesterRole) {
            alert('User information not available. Please log in again.');
            return;
        }
        
        // Collect medications
        const medications = collectMedicationsData();
        const hasValidMedications = medications.length > 0;
        
        if (!hasValidMedications) {
            alert('Please add at least one medication with name and quantity.');
            return;
        }
        
        // Create order object
        const orderData = {
            type: 'patient',
            wardId: wardId,
            patient: {
                name: patientName,
                dob: patientDOB || '',
                nhs: patientNHS || '',
                hospitalId: patientID
            },
            medications: medications,
            requester: {
                name: requesterName,
                role: requesterRole
            }
        };
        
        // Check for recent medication orders before submission
        const patientData = {
            patientName: patientName,
            nhsNumber: patientNHS,
            hospitalNumber: patientID
        };
        
        // Attempt to check for recent orders
        try {
            const recentOrders = await checkRecentMedicationOrders(patientData, medications);
            
            // If recent orders found, show alert and wait for user confirmation
            if (recentOrders && recentOrders.length > 0) {
                showRecentMedicationAlert(recentOrders, () => {
                    // User clicked 'Proceed Anyway'
                    submitPatientOrderFinal(orderData);
                });
                return; // Exit here, submitPatientOrderFinal will be called by callback if user confirms
            }
        } catch (error) {
            // Log error but continue with submission
            console.error('Error checking recent medication orders:', error);
        }
        
        // No recent orders found or check failed, proceed with submission
        submitPatientOrderFinal(orderData);
    } catch (error) {
        console.error('Error submitting patient order:', error);
        alert(`Error: ${error.message || 'Unknown error submitting order'}`);
    }
}

/**
 * Final step of patient order submission after recent medication check
 * @param {Object} orderData - Order data to submit
 */
async function submitPatientOrderFinal(orderData) {
    try {
        // Submit order using apiClient
        const order = await apiClient.createOrder(orderData);
        
        // Display toast notification instead of alert
        showToastNotification(`Order ${order.id} submitted successfully!`, 'success');
        document.getElementById('patient-med-form').reset();
        
        // Reload recent orders
        loadRecentOrders();
        
        // Re-populate autocomplete fields for first medication
        setupMedicationAutocomplete(document.getElementById('med-name-1'));
        setupFormulationAutocomplete(document.getElementById('med-form-1'));
    } catch (error) {
        console.error('Error submitting order:', error);
        showToastNotification(`Error submitting order: ${error.message}`, 'error');
    }
}

/**
 * Submit ward stock order
 */
async function submitWardStockOrder() {
    try {
        // Collect form data
        const wardId = document.getElementById('ws-ward-name').value;
        const requesterName = document.getElementById('ws-requester-name').value;
        const requesterRole = document.getElementById('ws-requester-role').value;
        const orderNotes = document.getElementById('ws-order-notes').value;
        
        // Validate required fields
        if (!wardId) {
            alert('Please select a ward.');
            return;
        }
        
        if (!requesterName || !requesterRole) {
            alert('User information not available. Please log in again.');
            return;
        }
        
        // Collect medications
        const medications = collectWardStockMedicationsData();
        const hasValidMedications = medications.length > 0;
        
        if (!hasValidMedications) {
            alert('Please add at least one medication with name and quantity.');
            return;
        }
        
        // Create order object
        const orderData = {
            type: 'ward-stock',
            wardId: wardId,
            medications: medications,
            requester: {
                name: requesterName,
                role: requesterRole
            },
            notes: orderNotes || ''
        };
        
        // For ward stock, we still want to check if these medications have been ordered recently
        // This is a bit different from patient orders as we're checking by ward rather than patient
        // We use the ward ID as a proxy for "patient" in the recent check API
        try {
            const patientData = {
                // Use ward ID as the hospital number to check for ward-specific recent orders
                hospitalNumber: wardId
            };
            
            const recentOrders = await checkRecentMedicationOrders(patientData, medications);
            
            // If recent orders found, show alert and wait for user confirmation
            if (recentOrders && recentOrders.length > 0) {
                showRecentMedicationAlert(recentOrders, () => {
                    // User clicked 'Proceed Anyway'
                    submitWardStockOrderFinal(orderData);
                });
                return; // Exit here, submitWardStockOrderFinal will be called by callback if user confirms
            }
        } catch (error) {
            // Log error but continue with submission
            console.error('Error checking recent ward stock orders:', error);
        }
        
        // No recent orders found or check failed, proceed with submission
        submitWardStockOrderFinal(orderData);
    } catch (error) {
        console.error('Error submitting ward stock order:', error);
        alert(`Error: ${error.message || 'Unknown error submitting order'}`);
    }
}

/**
 * Final step of ward stock order submission after recent medication check
 * @param {Object} orderData - Order data to submit
 */
async function submitWardStockOrderFinal(orderData) {
    try {
        // Submit order using apiClient
        const order = await apiClient.createOrder(orderData);
        
        // Display toast notification instead of alert
        showToastNotification(`Order ${order.id} submitted successfully!`, 'success');
        document.getElementById('ward-stock-med-form').reset();
        
        // Reload recent orders
        loadRecentOrders();
        
        // Re-populate autocomplete fields for first medication
        setupMedicationAutocomplete(document.getElementById('ws-med-name-1'));
        setupFormulationAutocomplete(document.getElementById('ws-med-form-1'));
    } catch (error) {
        console.error('Error submitting order:', error);
        showToastNotification(`Error submitting order: ${error.message}`, 'error');
    }
}

/**
 * Save order as draft
 * @param {string} type - Order type ('patient' or 'ward-stock')
 */
function saveOrderAsDraft(type) {
    // Implementation for saving drafts will go here
    alert('Draft saving functionality will be implemented in a future update.');
}

/**
 * Load and display recent orders from database
 */
async function loadRecentOrders() {
    const recentOrdersList = document.getElementById('recent-orders-list');
    if (!recentOrdersList) return;
    
    try {
        // Show loading indicator
        recentOrdersList.innerHTML = '<div class="loading-orders">Loading recent orders...</div>';
        
        // Check if API client is available
        if (!window.apiClient) {
            console.error('API client not available for fetching orders');
            recentOrdersList.innerHTML = '<div class="error-message">Error: Unable to fetch orders. API client not available.</div>';
            return;
        }
        
        // Fetch recent orders from server (last 10)
        const response = await window.apiClient.getRecentOrders({ limit: 10 });
        console.log('Recent orders response:', response);
        
        const orders = response.orders || [];
        
        if (orders.length > 0) {
            // Add table header
            recentOrdersList.innerHTML = `
                <table class="orders-table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Patient</th>
                            <th>Ward</th>
                            <th>Medication Details</th>
                            <th>Status</th>
                            <th>Requester</th>
                        </tr>
                    </thead>
                    <tbody id="orders-table-body"></tbody>
                </table>
            `;
            
            const tableBody = document.getElementById('orders-table-body');
            
            orders.forEach(order => {
                const row = document.createElement('tr');
                row.className = 'order-row';
                
                // Format timestamp and order ID
                const orderDate = new Date(order.timestamp);
                const formattedDate = orderDate.toLocaleDateString() + ' ' + orderDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                // Format patient info (if patient order)
                let patientInfo = '';
                if (order.type === 'patient' && order.patient) {
                    // Patient name may be encrypted, use identifiers as default display
                    const patientDetails = [];
                    if (order.patient.name && order.patient.name !== 'undefined') {
                        // Try to decrypt if encrypted
                        let patientName = order.patient.name;
                        try {
                            if (window.apiClient && typeof window.apiClient.decryptData === 'function' && 
                                patientName.startsWith('U2FsdGVk')) {
                                const decrypted = window.apiClient.decryptData(patientName);
                                if (decrypted) patientName = decrypted;
                            }
                        } catch (e) {
                            console.warn('Failed to decrypt patient name:', e);
                        }
                        patientDetails.push(patientName);
                    }
                    
                    // Add identifiers if available
                    const identifier = order.patient.hospitalId || order.patient.nhs || '';
                    if (identifier) patientDetails.push(`(${identifier})`);
                    
                    patientInfo = patientDetails.join(' ');
                } else {
                    patientInfo = '<span class="ward-stock-label">Ward Stock</span>';
                }
                
                // Format medications - concatenate all medications into a single string
                const medicationsList = order.medications.map(med => {
                    const details = [];
                    if (med.name) details.push(med.name);
                    if (med.strength) details.push(med.strength);
                    if (med.form) details.push(med.form);
                    if (med.dose) details.push(med.dose);
                    if (med.quantity) details.push(`× ${med.quantity}`);
                    return details.join(' ');
                }).join('<br>');
                
                // Format requester info
                const requesterInfo = order.requesterName || 'Unknown';
                
                row.innerHTML = `
                    <td class="order-id">
                        <div>${order.id}</div>
                        <div class="order-time">${formattedDate}</div>
                    </td>
                    <td class="patient-info">${patientInfo}</td>
                    <td class="ward-info">${getWardName(order.wardId)}</td>
                    <td class="medications-info">${medicationsList}</td>
                    <td class="status-cell">
                        <span class="order-status status-${order.status}">${order.status.toUpperCase()}</span>
                    </td>
                    <td class="requester-info">${requesterInfo}</td>
                `;
                
                // Make row clickable to show details
                row.style.cursor = 'pointer';
                row.dataset.orderId = order.id;
                row.addEventListener('click', () => showOrderDetails(order));
                
                tableBody.appendChild(row);
            });
            
            // Add table styling if not already in stylesheet
            if (!document.getElementById('orders-table-styles')) {
                const style = document.createElement('style');
                style.id = 'orders-table-styles';
                style.textContent = `
                    .orders-table {
                        width: 100%;
                        border-collapse: separate;
                        border-spacing: 0;
                        margin-top: 15px;
                        font-size: 0.9em;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                        border-radius: 8px;
                        overflow: hidden;
                    }
                    .orders-table thead th {
                        text-align: left;
                        padding: 12px 15px;
                        background-color: #2196F3;
                        color: white;
                        font-weight: bold;
                        letter-spacing: 0.5px;
                        border-bottom: 2px solid #0d8aee;
                    }
                    .orders-table tbody tr {
                        transition: all 0.2s ease;
                        border-bottom: 1px solid #f0f0f0;
                    }
                    .orders-table tbody tr:last-child {
                        border-bottom: none;
                    }
                    .orders-table tbody td {
                        padding: 12px 15px;
                        border-bottom: 1px solid #eee;
                        vertical-align: middle;
                    }
                    .orders-table tbody tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .orders-table tbody tr:hover {
                        background-color: #e3f2fd;
                        cursor: pointer;
                        transform: translateY(-1px);
                        box-shadow: 0 2px 8px rgba(33, 150, 243, 0.15);
                    }
                    .order-row {
                        position: relative;
                    }
                    .order-row::after {
                        content: "View Details";
                        position: absolute;
                        right: 15px;
                        top: 50%;
                        transform: translateY(-50%);
                        background-color: #2196F3;
                        color: white;
                        border-radius: 4px;
                        padding: 4px 8px;
                        font-size: 0.8em;
                        opacity: 0;
                        transition: opacity 0.2s ease;
                    }
                    .order-row:hover::after {
                        opacity: 1;
                    }
                    .order-id {
                        font-weight: bold;
                        color: #2196F3;
                    }
                    .order-time {
                        font-size: 0.85em;
                        color: #666;
                        margin-top: 4px;
                    }
                    .ward-stock-label {
                        font-style: italic;
                        background-color: #e8eaf6;
                        padding: 3px 8px;
                        border-radius: 4px;
                        color: #3f51b5;
                        display: inline-block;
                    }
                    .loading-orders, .error-message {
                        padding: 25px;
                        text-align: center;
                        color: #666;
                        background-color: #f9f9f9;
                        border-radius: 8px;
                        margin: 15px 0;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    }
                    .error-message {
                        color: #d32f2f;
                        border-left: 4px solid #f44336;
                    }
                    .medications-info {
                        max-width: 300px;
                        line-height: 1.5;
                    }
                    .status-cell {
                        text-align: center;
                    }
                    .order-status {
                        display: inline-block;
                        padding: 5px 8px;
                        border-radius: 4px;
                        font-weight: bold;
                        font-size: 0.8em;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .status-pending {
                        background-color: #fff9c4;
                        color: #ff8f00;
                    }
                    .status-processing {
                        background-color: #bbdefb;
                        color: #1565c0;
                    }
                    .status-completed {
                        background-color: #c8e6c9;
                        color: #2e7d32;
                    }
                    .status-cancelled {
                        background-color: #ffcdd2;
                        color: #c62828;
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            recentOrdersList.innerHTML = '<div class="no-orders">No recent orders found in database. Create a new order to see it here.</div>';
            
            // Add some styling
            if (!document.getElementById('no-orders-styles')) {
                const style = document.createElement('style');
                style.id = 'no-orders-styles';
                style.textContent = `
                    .no-orders {
                        padding: 30px;
                        text-align: center;
                        color: #666;
                        background-color: #f5f5f5;
                        border-radius: 8px;
                        margin: 20px 0;
                        font-size: 1.1em;
                        border: 1px dashed #ddd;
                    }
                `;
                document.head.appendChild(style);
            }
        }  
    } catch (error) {
        console.error('Error loading recent orders:', error);
        recentOrdersList.innerHTML = `<div class="error-message">Error loading orders: ${error.message}</div>`;
    }
}
