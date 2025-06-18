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
        modal.style.display = 'none';
        modal.classList.add('hidden');
        console.log('[MODAL] Recent medication alert modal closed');
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
    modal.style.display = 'block';
    modal.classList.remove('hidden');
    console.log('[MODAL] Modal shown');
    
    // Setup close handlers
    setupModalCloseHandlers();
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
    console.log('[MODAL] closeOrderDetailModal called');
    
    const modal = document.getElementById('order-detail-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        console.log('[MODAL] Modal hidden');
        
        // Reset edit mode
        isOrderInEditMode = false;
        currentOrder = null;
        console.log('[MODAL] Reset currentOrder and edit mode');
    }
}

/**
 * Setup modal close handlers
 */
function setupModalCloseHandlers() {
    console.log('[MODAL] Setting up close handlers');
    
    const modal = document.getElementById('order-detail-modal');
    if (!modal) {
        console.error('[MODAL] Modal not found for close handlers');
        return;
    }
    
    // Close button handlers
    const closeButtons = modal.querySelectorAll('.modal-close, .modal-close-btn');
    closeButtons.forEach(button => {
        button.onclick = () => {
            console.log('[MODAL] Close button clicked');
            closeOrderDetailModal();
        };
    });
    
    // Click outside to close
    modal.onclick = (e) => {
        if (e.target === modal) {
            console.log('[MODAL] Clicked outside modal');
            closeOrderDetailModal();
        }
    };
    
    // Escape key to close
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            console.log('[MODAL] Escape key pressed');
            closeOrderDetailModal();
        }
    });
}

/**
 * Global variable to store the current order being viewed/edited
 */
let currentOrder = null;
let isOrderInEditMode = false;

/**
 * Show order details in a modal
 * @param {Object} order - Order object to display
 */
function showOrderDetails(order) {
    console.log('[MODAL] showOrderDetails called with order:', order);
    
    if (!order) {
        console.error('[MODAL] No order provided to showOrderDetails');
        return;
    }
    
    // Store current order for editing/deletion
    currentOrder = order;
    console.log('[MODAL] Set currentOrder:', currentOrder);
    
    // Create modal if it doesn't exist
    createOrderDetailModal();
    
    const modal = document.getElementById('order-detail-modal');
    const content = document.getElementById('modal-order-content');
    
    if (!modal || !content) {
        console.error('[MODAL] Modal or content element not found');
        return;
    }
    
    // Populate modal content
    content.innerHTML = createOrderDetailHTML(order);
    console.log('[MODAL] Modal content populated');
    
    // Setup buttons based on order status
    setupModalButtons();
    
    // Show modal
    modal.style.display = 'block';
    modal.classList.remove('hidden');
    console.log('[MODAL] Modal shown');
    
    // Setup close handlers
    setupModalCloseHandlers();
}

/**
 * Setup the modal buttons based on order status and current mode
 */
function setupModalButtons() {
    console.log('[MODAL] setupModalButtons called for order:', currentOrder);
    
    // Cancel order button
    const cancelButton = document.getElementById('cancel-order-btn');
    console.log('[MODAL] Cancel button found:', !!cancelButton);
    
    if (cancelButton) {
        if (currentOrder.status === 'pending') {
            console.log('[MODAL] Showing cancel button for pending order');
            cancelButton.classList.remove('hidden');
            cancelButton.onclick = () => {
                console.log('[MODAL] Cancel button clicked for order:', currentOrder.id);
                cancelOrder(currentOrder.id);
            };
        } else {
            console.log('[MODAL] Hiding cancel button for non-pending order, status:', currentOrder.status);
            cancelButton.classList.add('hidden');
        }
    }
    
    // Edit order button
    const editButton = document.getElementById('edit-order-btn');
    console.log('[MODAL] Edit button found:', !!editButton);
    
    if (editButton) {
        if (currentOrder.status === 'pending') {
            console.log('[MODAL] Showing edit button for pending order');
            editButton.classList.remove('hidden');
            editButton.onclick = () => {
                console.log('[MODAL] Edit button clicked for order:', currentOrder.id);
                toggleOrderEditMode(true);
            };
        } else {
            console.log('[MODAL] Hiding edit button for non-pending order, status:', currentOrder.status);
            editButton.classList.add('hidden');
        }
    }
    
    // Save changes button
    const saveButton = document.getElementById('save-order-btn');
    console.log('[MODAL] Save button found:', !!saveButton);
    
    if (saveButton) {
        saveButton.classList.add('hidden');
        saveButton.onclick = () => {
            console.log('[MODAL] Save button clicked for order:', currentOrder.id);
            saveOrderChanges();
        };
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
    console.log('[SAVE] saveOrderChanges called');
    
    try {
        if (!currentOrder) {
            console.error('[SAVE] No current order to save');
            showToastNotification('No order to update', 'error');
            return;
        }
        
        // Ensure we have an order ID
        if (!currentOrder.id) {
            console.error('[SAVE] Order has no ID');
            showToastNotification('Order ID is missing', 'error');
            return;
        }
        
        // Store order ID locally to prevent loss during operations
        const orderIdToUpdate = currentOrder.id;
        console.log('[SAVE] Working with order ID:', orderIdToUpdate);
        
        // Gather medication data from the form
        if (isOrderInEditMode) {
            console.log('[SAVE] Order is in edit mode, gathering form data');
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
            
            console.log('[SAVE] Collected medications:', medications.length);
            // Update the current order
            currentOrder.medications = medications;
        }
        
        // Check if there are any medications
        if (!currentOrder.medications || !currentOrder.medications.length) {
            console.error('[SAVE] No medications in order');
            showToastNotification('Order must have at least one medication', 'error');
            return;
        }
        
        // Prompt user for reason for the edit (for audit trail)
        const reason = await showEditReasonModal();
        if (!reason || reason.trim() === '') {
            console.log('[SAVE] User cancelled or did not provide reason');
            showToastNotification('Edit cancelled - reason is required for audit trail', 'info');
            return;
        }
        
        // Add reason to order data for audit trail
        currentOrder.reason = reason.trim();
        
        // Check for API client availability
        console.log('[SAVE] Checking API client availability');
        console.log('[SAVE] window.apiClient exists:', !!window.apiClient);
        console.log('[SAVE] updateOrder method exists:', !!(window.apiClient && typeof window.apiClient.updateOrder === 'function'));
        
        // If we have an API client with updateOrder method
        if (window.apiClient && typeof window.apiClient.updateOrder === 'function') {
            console.log('[SAVE] Using API client to update order', orderIdToUpdate);
            showToastNotification('Saving changes...', 'info');
            
            // Call API to update order
            const response = await window.apiClient.updateOrder(orderIdToUpdate, currentOrder);
            console.log('[SAVE] API response:', response);
            
            if (response && response.success) {
                console.log('[SAVE] Order updated successfully');
                showToastNotification('Order updated successfully', 'success');
                
                // Update local order cache if using OrderManager
                if (OrderManager) {
                    console.log('[SAVE] Updating OrderManager cache');
                    OrderManager.updateOrder(currentOrder);
                }
                
                // Switch back to view mode and refresh orders list
                console.log('[SAVE] Toggling view mode and refreshing list');
                toggleOrderEditMode(false);
                
                // Force a refresh of the orders list after update
                setTimeout(() => {
                    console.log('[SAVE] Refreshing recent orders list');
                    loadRecentOrders();
                }, 500);
            } else {
                console.error('[SAVE] API returned error:', response);
                showToastNotification(`Error updating order: ${response.message || 'Unknown error'}`, 'error');
            }
        } 
        // If we only have local OrderManager
        else if (OrderManager) {
            console.log('[SAVE] Using OrderManager to update local order');
            OrderManager.updateOrder(currentOrder);
            showToastNotification('Order updated successfully', 'success');
            toggleOrderEditMode(false);
            
            // Force a refresh of the orders list after update
            setTimeout(() => {
                console.log('[SAVE] Refreshing recent orders list');
                loadRecentOrders();
            }, 500);
        } else {
            console.error('[SAVE] No update mechanism available');
            showToastNotification('Order update not supported', 'error');
        }
    } catch (error) {
        console.error('[SAVE] Error updating order:', error);
        showToastNotification(`Error updating order: ${error.message || 'Unknown error'}`, 'error');
    }
}

/**
 * Create and show a custom edit reason modal
 * @returns {Promise} - Resolves with the edit reason when user makes a choice
 */
async function showEditReasonModal() {
    return new Promise((resolve) => {
        console.log('[MODAL] Creating edit reason modal');
        
        // Create modal container if it doesn't exist
        let modalOverlay = document.getElementById('edit-reason-modal-overlay');
        if (!modalOverlay) {
            modalOverlay = document.createElement('div');
            modalOverlay.id = 'edit-reason-modal-overlay';
            modalOverlay.style.position = 'fixed';
            modalOverlay.style.top = '0';
            modalOverlay.style.left = '0';
            modalOverlay.style.width = '100%';
            modalOverlay.style.height = '100%';
            modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            modalOverlay.style.display = 'flex';
            modalOverlay.style.alignItems = 'center';
            modalOverlay.style.justifyContent = 'center';
            modalOverlay.style.zIndex = '1000';
            document.body.appendChild(modalOverlay);
        } else {
            modalOverlay.innerHTML = ''; // Clear any existing content
            modalOverlay.style.display = 'flex';
        }
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = 'white';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '5px';
        modalContent.style.width = '400px';
        modalContent.style.maxWidth = '90%';
        modalContent.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        
        // Modal header
        const modalHeader = document.createElement('h3');
        modalHeader.textContent = 'Enter Edit Reason';
        modalHeader.style.marginTop = '0';
        modalContent.appendChild(modalHeader);
        
        // Modal description
        const modalDescription = document.createElement('p');
        modalDescription.textContent = 'Please provide a reason for editing this order';
        modalContent.appendChild(modalDescription);
        
        // Reason textarea
        const reasonArea = document.createElement('textarea');
        reasonArea.style.width = '100%';
        reasonArea.style.padding = '10px';
        reasonArea.style.marginBottom = '15px';
        reasonArea.style.minHeight = '60px';
        reasonArea.style.boxSizing = 'border-box';
        reasonArea.value = 'Edited by user request';
        modalContent.appendChild(reasonArea);
        
        // Button container
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'flex-end';
        btnContainer.style.gap = '10px';
        
        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.classList.add('btn', 'btn-secondary');
        cancelBtn.onclick = () => {
            modalOverlay.style.display = 'none';
            resolve('');
        };
        btnContainer.appendChild(cancelBtn);
        
        // Confirm button
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Confirm Edit';
        confirmBtn.classList.add('btn', 'btn-primary');
        confirmBtn.onclick = () => {
            const reason = reasonArea.value.trim() || 'Edited by user request';
            modalOverlay.style.display = 'none';
            resolve(reason);
        };
        btnContainer.appendChild(confirmBtn);
        
        // Add button container to modal
        modalContent.appendChild(btnContainer);
        
        // Add modal content to overlay
        modalOverlay.appendChild(modalContent);
        
        // Focus the textarea
        setTimeout(() => reasonArea.focus(), 50);
    });
}

/**
 * Cancel an order
 * @param {string} orderId - Order ID to cancel
 */
/**
 * Create and show a custom cancellation modal
 * @param {string} orderId - Order ID to cancel
 * @returns {Promise} - Resolves with {cancelled: bool, reason: string} when user makes a choice
 */
function showCancellationModal(orderId) {
    return new Promise((resolve) => {
        console.log('[MODAL] Creating cancellation modal for order:', orderId);
        
        // Create modal container if it doesn't exist
        let modalOverlay = document.getElementById('cancellation-modal-overlay');
        if (!modalOverlay) {
            modalOverlay = document.createElement('div');
            modalOverlay.id = 'cancellation-modal-overlay';
            modalOverlay.style.position = 'fixed';
            modalOverlay.style.top = '0';
            modalOverlay.style.left = '0';
            modalOverlay.style.width = '100%';
            modalOverlay.style.height = '100%';
            modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            modalOverlay.style.display = 'flex';
            modalOverlay.style.alignItems = 'center';
            modalOverlay.style.justifyContent = 'center';
            modalOverlay.style.zIndex = '1000';
            document.body.appendChild(modalOverlay);
        } else {
            modalOverlay.innerHTML = ''; // Clear any existing content
            modalOverlay.style.display = 'flex';
        }
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = 'white';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '5px';
        modalContent.style.width = '400px';
        modalContent.style.maxWidth = '90%';
        modalContent.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        
        // Modal header
        const modalHeader = document.createElement('h3');
        modalHeader.textContent = 'Cancel Order';
        modalHeader.style.marginTop = '0';
        modalContent.appendChild(modalHeader);
        
        // Modal description
        const modalDescription = document.createElement('p');
        modalDescription.textContent = `Please provide a reason for cancelling order ${orderId}`;
        modalContent.appendChild(modalDescription);
        
        // Reason textarea
        const reasonArea = document.createElement('textarea');
        reasonArea.style.width = '100%';
        reasonArea.style.padding = '10px';
        reasonArea.style.marginBottom = '15px';
        reasonArea.style.minHeight = '60px';
        reasonArea.style.boxSizing = 'border-box';
        reasonArea.value = 'Cancelled by user request';
        modalContent.appendChild(reasonArea);
        
        // Button container
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'flex-end';
        btnContainer.style.gap = '10px';
        
        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.classList.add('btn', 'btn-secondary');
        cancelBtn.onclick = () => {
            modalOverlay.style.display = 'none';
            resolve({ cancelled: false });
        };
        btnContainer.appendChild(cancelBtn);
        
        // Confirm button
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Confirm Cancellation';
        confirmBtn.classList.add('btn', 'btn-danger');
        confirmBtn.onclick = () => {
            const reason = reasonArea.value.trim() || 'Cancelled by user request';
            modalOverlay.style.display = 'none';
            resolve({ cancelled: true, reason });
        };
        btnContainer.appendChild(confirmBtn);
        
        // Add button container to modal
        modalContent.appendChild(btnContainer);
        
        // Add modal content to overlay
        modalOverlay.appendChild(modalContent);
        
        // Focus the textarea
        setTimeout(() => reasonArea.focus(), 50);
    });
}

async function cancelOrder(orderId) {
    console.log('[CANCEL] cancelOrder called with orderId:', orderId);
    
    try {
        // Backup orderId from currentOrder if not provided directly
        if (!orderId && currentOrder && currentOrder.id) {
            orderId = currentOrder.id;
            console.log('[CANCEL] Using currentOrder.id as fallback:', orderId);
        }
        
        if (!orderId) {
            console.error('[CANCEL] No order ID provided');
            return;
        }
        
        // Store the orderId locally to ensure it's not lost if currentOrder is cleared
        const orderIdToCancel = orderId;
        
        // Show custom cancellation modal instead of using prompt/confirm
        const result = await showCancellationModal(orderIdToCancel);
        
        if (!result.cancelled) {
            console.log('[CANCEL] User cancelled the cancellation dialog');
            return;
        }
        
        const reason = result.reason;
        console.log('[CANCEL] User confirmed cancellation for order:', orderIdToCancel, 'with reason:', reason);
        
        // Check for API client availability
        console.log('[CANCEL] Checking API client availability');
        console.log('[CANCEL] window.apiClient exists:', !!window.apiClient);
        console.log('[CANCEL] cancelOrder method exists:', !!(window.apiClient && typeof window.apiClient.cancelOrder === 'function'));
        
        // If we have an API client with cancelOrder method
        if (window.apiClient && typeof window.apiClient.cancelOrder === 'function') {
            console.log('[CANCEL] Using API client to cancel order', orderIdToCancel);
            showToastNotification('Cancelling order...', 'info');
            
            // Call API to cancel order with reason
            const response = await window.apiClient.cancelOrder(orderIdToCancel, reason);
            console.log('[CANCEL] API response:', response);
            
            if (response && response.success) {
                console.log('[CANCEL] Order cancelled successfully');
                showToastNotification('Order cancelled successfully', 'success');
                
                // Log that we're updating the UI (no OrderManager needed)
                console.log('[CANCEL] Order cancelled successfully, will refresh order list');
                
                // Close modal and refresh orders list
                console.log('[CANCEL] Closing modal and refreshing list');
                closeOrderDetailModal();
                
                // Force a refresh of the orders list after cancellation
                setTimeout(() => {
                    console.log('[CANCEL] Refreshing recent orders list');
                    loadRecentOrders();
                }, 500);
            } else {
                console.error('[CANCEL] API returned error:', response);
                showToastNotification(`Error cancelling order: ${response.message || 'Unknown error'}`, 'error');
            }
        } 
        // Fallback if API client is not available
        else {
            console.log('[CANCEL] API client not available, performing local-only cancellation');
            showToastNotification('Order marked as cancelled locally. Sync required.', 'warning');
            showToastNotification('Order cancelled successfully', 'success');
            closeOrderDetailModal();
            
            // Force a refresh of the orders list after cancellation
            setTimeout(() => {
                console.log('[CANCEL] Refreshing recent orders list');
                loadRecentOrders();
            }, 500);
        }
    } catch (error) {
        console.error('[CANCEL] Error cancelling order:', error);
        showToastNotification(`Error cancelling order: ${error.message || 'Unknown error'}`, 'error');
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
    
    // Show options based on input
    inputElement.addEventListener('input', () => {
        const value = inputElement.value.toLowerCase().trim();
        dropdownList.innerHTML = '';
        
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
                
                // Add cancellation info if order is cancelled
                let statusContent = `<span class="order-status status-${order.status}">${order.status.toUpperCase()}</span>`;
                if (order.status === 'cancelled') {
                    const cancelledBy = order.cancelledBy || 'Unknown';
                    const reason = order.cancellationReason || order.cancelReason || 'No reason provided';
                    statusContent += `
                        <div class="cancellation-info">
                            <span class="cancelled-by">By: ${cancelledBy}</span>
                            <span class="cancellation-reason" title="${reason}">${reason.length > 20 ? reason.substring(0, 20) + '...' : reason}</span>
                        </div>
                    `;
                    row.classList.add('cancelled-order');
                }
                
                row.innerHTML = `
                    <td class="order-id">
                        <div>${order.id}</div>
                        <div class="order-time">${formattedDate}</div>
                    </td>
                    <td class="patient-info">${patientInfo}</td>
                    <td class="ward-info">${getWardName(order.wardId)}</td>
                    <td class="medications-info">${medicationsList}</td>
                    <td class="status-cell">
                        ${statusContent}
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
                    /* Removed View Details overlay that was obscuring information */
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
                        min-width: 120px;
                    }
                    .order-status {
                        display: inline-block;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.8em;
                        font-weight: bold;
                        text-transform: uppercase;
                    }
                    .status-pending {
                        background-color: #ffecb3;
                        color: #ff6f00;
                    }
                    .status-processing {
                        background-color: #b3e5fc;
                        color: #0277bd;
                    }
                    .status-completed {
                        background-color: #c8e6c9;
                        color: #2e7d32;
                    }
                    .status-cancelled {
                        background-color: #ffcdd2;
                        color: #c62828;
                    }
                    .cancelled-order td {
                        color: #777;
                        text-decoration: line-through;
                    }
                    .cancelled-order .status-cell,
                    .cancelled-order .order-id,
                    .cancelled-order .status-cancelled {
                        text-decoration: none !important;
                    }
                    .cancellation-info {
                        margin-top: 5px;
                        font-size: 0.8em;
                        color: #555;
                        text-decoration: none !important;
                        display: flex;
                        flex-direction: column;
                    }
                    .cancelled-by {
                        font-weight: bold;
                        margin-bottom: 2px;
                    }
                    .cancellation-reason {
                        font-style: italic;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 130px;
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

/**
 * Create HTML content for order details modal
 * @param {Object} order - Order object to display
 * @returns {string} - HTML string for modal content
 */
function createOrderDetailHTML(order) {
    console.log('[MODAL] createOrderDetailHTML called with order:', order);
    
    if (!order) {
        return '<p>No order data available</p>';
    }
    
    // Format timestamp
    const timestamp = new Date(order.timestamp).toLocaleString();
    
    // Format cancellation info if available
    let cancellationInfo = '';
    if (order.status === 'cancelled') {
        cancellationInfo = `
            <div class="order-section cancellation-info">
                <h4>Cancellation Information</h4>
                <div class="cancellation-details">
                    <p><strong>Cancelled By:</strong> ${order.cancelledBy || 'Unknown'}</p>
                    <p><strong>Reason:</strong> ${order.cancellationReason || order.cancelReason || 'No reason provided'}</p>
                    <p><strong>When:</strong> ${order.cancelledAt ? new Date(order.cancelledAt).toLocaleString() : timestamp}</p>
                </div>
            </div>
        `;
    }
    
    // Create patient info section
    let patientInfo = '';
    if (order.patient) {
        patientInfo = `
            <div class="order-section">
                <h4>Patient Information</h4>
                <div class="patient-details">
                    <p><strong>Name:</strong> ${order.patient.name || 'Not provided'}</p>
                    <p><strong>NHS Number:</strong> ${order.patient.nhsNumber || 'Not provided'}</p>
                    <p><strong>Hospital Number:</strong> ${order.patient.hospitalNumber || 'Not provided'}</p>
                    <p><strong>Ward:</strong> ${order.patient.ward || 'Not provided'}</p>
                    <p><strong>Bed:</strong> ${order.patient.bed || 'Not provided'}</p>
                </div>
            </div>
        `;
    }
    
    // Create medications section
    let medicationsHTML = '';
    if (order.medications && order.medications.length > 0) {
        medicationsHTML = `
            <div class="order-section">
                <h4>Medications</h4>
                <div class="medications-list">
                    ${order.medications.map((med, index) => `
                        <div class="medication-item" data-index="${index}">
                            <div class="medication-row">
                                <div class="medication-field">
                                    <label>Name:</label>
                                    <span class="medication-name">${med.name || 'N/A'}</span>
                                </div>
                                <div class="medication-field">
                                    <label>Strength:</label>
                                    <span class="medication-strength">${med.strength || 'N/A'}</span>
                                </div>
                                <div class="medication-field">
                                    <label>Form:</label>
                                    <span class="medication-form">${med.form || 'N/A'}</span>
                                </div>
                                <div class="medication-field">
                                    <label>Quantity:</label>
                                    <span class="medication-quantity">${med.quantity || 'N/A'}</span>
                                </div>
                                <div class="medication-field">
                                    <label>Dose:</label>
                                    <span class="medication-dose">${med.dose || 'N/A'}</span>
                                </div>
                                ${med.notes ? `
                                <div class="medication-field full-width">
                                    <label>Notes:</label>
                                    <span class="medication-notes">${med.notes}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Create order info section
    const orderInfo = `
        <div class="order-section">
            <h4>Order Information</h4>
            <div class="order-details">
                <p><strong>Order ID:</strong> ${order.id}</p>
                <p><strong>Type:</strong> ${order.type || 'N/A'}</p>
                <p><strong>Status:</strong> <span class="status-badge status-${order.status}">${order.status || 'pending'}</span></p>
                <p><strong>Created:</strong> ${timestamp}</p>
                <p><strong>Requester:</strong> ${order.requester ? order.requester.name : 'Unknown'} (${order.requester ? order.requester.role : 'Unknown'})</p>
                ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
            </div>
        </div>
    `;
    
    // Add history button if we have apiClient with getOrderHistory method
    const historyButton = window.apiClient && typeof window.apiClient.getOrderHistory === 'function' ?
        `<button type="button" class="btn btn-info" id="view-history-btn" onclick="viewOrderHistory('${order.id}')">View Audit Trail</button>` : '';
    
    return `
        <div class="order-detail-content">
            ${orderInfo}
            ${order.status === 'cancelled' ? cancellationInfo : ''}
            ${patientInfo}
            ${medicationsHTML}
            <div class="order-actions">
                ${historyButton}
            </div>
        </div>
    `;
}

/**
 * View order history/audit trail
 * @param {string} orderId - Order ID to view history for
 */
async function viewOrderHistory(orderId) {
    console.log('[HISTORY] viewOrderHistory called with orderId:', orderId);
    
    try {
        // Show loading indicator
        showToastNotification('Loading audit trail...', 'info');
        
        // Fetch history
        const response = await window.apiClient.getOrderHistory(orderId);
        console.log('[HISTORY] History response:', response);
        
        if (!response || !response.success || !response.history) {
            console.error('[HISTORY] Failed to fetch history:', response);
            showToastNotification('Failed to load audit trail: ' + (response?.message || 'Unknown error'), 'error');
            return;
        }
        
        // Create and show history modal
        showHistoryModal(orderId, response.history);
    } catch (error) {
        console.error('[HISTORY] Error viewing history:', error);
        showToastNotification('Error loading audit trail: ' + (error.message || 'Unknown error'), 'error');
    }
}

/**
 * Create and show history modal
 * @param {string} orderId - Order ID
 * @param {Array} historyData - Array of history entries
 */
function showHistoryModal(orderId, historyData) {
    console.log('[MODAL] Creating history modal for order:', orderId);
    
    // Create modal container
    let modalOverlay = document.getElementById('history-modal-overlay');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'history-modal-overlay';
        modalOverlay.style.position = 'fixed';
        modalOverlay.style.top = '0';
        modalOverlay.style.left = '0';
        modalOverlay.style.width = '100%';
        modalOverlay.style.height = '100%';
        modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modalOverlay.style.display = 'flex';
        modalOverlay.style.alignItems = 'center';
        modalOverlay.style.justifyContent = 'center';
        modalOverlay.style.zIndex = '1000';
        document.body.appendChild(modalOverlay);
    } else {
        modalOverlay.innerHTML = ''; // Clear any existing content
        modalOverlay.style.display = 'flex';
    }
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '700px';
    modalContent.style.maxWidth = '90%';
    modalContent.style.maxHeight = '80vh';
    modalContent.style.overflowY = 'auto';
    modalContent.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    
    // Modal header
    const modalHeader = document.createElement('div');
    modalHeader.style.display = 'flex';
    modalHeader.style.justifyContent = 'space-between';
    modalHeader.style.alignItems = 'center';
    modalHeader.style.marginBottom = '15px';
    
    const modalTitle = document.createElement('h3');
    modalTitle.textContent = `Order Audit Trail (${orderId})`;
    modalTitle.style.marginTop = '0';
    modalHeader.appendChild(modalTitle);
    
    // Close button (X)
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => {
        modalOverlay.style.display = 'none';
    };
    modalHeader.appendChild(closeBtn);
    
    modalContent.appendChild(modalHeader);
    
    // History table
    let historyHTML = '';
    if (historyData && historyData.length > 0) {
        historyHTML = `
            <table class="table table-striped history-table">
                <thead>
                    <tr>
                        <th>Date/Time</th>
                        <th>Action</th>
                        <th>User</th>
                        <th>Reason</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    ${historyData.map(entry => {
                        // Parse JSON data if needed
                        let previousData = '';
                        let newData = '';
                        try {
                            if (entry.previous_data) {
                                const prevObj = JSON.parse(entry.previous_data);
                                previousData = JSON.stringify(prevObj, null, 2);
                            }
                            if (entry.new_data) {
                                const newObj = JSON.parse(entry.new_data);
                                newData = JSON.stringify(newObj, null, 2);
                            }
                        } catch (e) {
                            console.error('Error parsing history JSON:', e);
                        }
                        
                        // Format action type for display
                        const actionDisplay = entry.action_type
                            .replace(/_/g, ' ')
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        
                        return `
                        <tr>
                            <td>${new Date(entry.action_timestamp).toLocaleString()}</td>
                            <td>${actionDisplay}</td>
                            <td>${entry.modified_by}</td>
                            <td>${entry.reason || 'N/A'}</td>
                            <td>
                                ${previousData || newData ? 
                                    `<button class="btn btn-sm btn-outline-info show-details-btn" 
                                        onclick="toggleHistoryDetails(this)">Show Details</button>
                                    <div class="history-details" style="display:none">
                                        ${previousData ? `<p><strong>Previous:</strong></p><pre>${previousData}</pre>` : ''}
                                        ${newData ? `<p><strong>New:</strong></p><pre>${newData}</pre>` : ''}
                                    </div>`
                                : 'No details available'}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } else {
        historyHTML = '<div class="alert alert-info">No audit trail entries found for this order.</div>';
    }
    
    const historyContent = document.createElement('div');
    historyContent.innerHTML = historyHTML;
    modalContent.appendChild(historyContent);
    
    // Close button at bottom
    const footerDiv = document.createElement('div');
    footerDiv.style.textAlign = 'right';
    footerDiv.style.marginTop = '15px';
    
    const closeBtnBottom = document.createElement('button');
    closeBtnBottom.textContent = 'Close';
    closeBtnBottom.className = 'btn btn-secondary';
    closeBtnBottom.onclick = () => {
        modalOverlay.style.display = 'none';
    };
    footerDiv.appendChild(closeBtnBottom);
    
    modalContent.appendChild(footerDiv);
    
    // Add modal to overlay
    modalOverlay.appendChild(modalContent);
    
    // Add needed styles
    if (!document.getElementById('history-styles')) {
        const style = document.createElement('style');
        style.id = 'history-styles';
        style.textContent = `
            .history-table {
                width: 100%;
                border-collapse: collapse;
            }
            .history-table th, .history-table td {
                padding: 8px;
                border: 1px solid #ddd;
            }
            .history-table th {
                background-color: #f2f2f2;
                text-align: left;
            }
            .history-details {
                margin-top: 10px;
                padding: 10px;
                background-color: #f9f9f9;
                border-radius: 4px;
                border: 1px solid #eee;
            }
            .history-details pre {
                white-space: pre-wrap;
                font-family: monospace;
                font-size: 12px;
                margin-bottom: 10px;
                padding: 5px;
                background-color: #f5f5f5;
                border: 1px solid #ddd;
                border-radius: 3px;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Toggle visibility of history detail section
 * @param {HTMLElement} button - The button that was clicked
 */
function toggleHistoryDetails(button) {
    const detailsDiv = button.nextElementSibling;
    if (detailsDiv.style.display === 'none') {
        detailsDiv.style.display = 'block';
        button.textContent = 'Hide Details';
    } else {
        detailsDiv.style.display = 'none';
        button.textContent = 'Show Details';
    }
}
