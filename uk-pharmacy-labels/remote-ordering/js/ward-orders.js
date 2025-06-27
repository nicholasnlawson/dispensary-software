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
                    <strong id="recent-medications-header">Warning: Recent Medication Orders (Last 14 days)</strong>
                    <p>These medications have been recently ordered:</p>
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
    const headerElement = document.getElementById('recent-medications-header');
    
    if (!modal || !listContainer) return;
    
    // Clear previous content
    listContainer.innerHTML = '';
    
    // Determine if these are ward stock orders    // Check for ward stock vs patient order type
    const isWardStock = recentOrders.length > 0 && recentOrders[0].type === 'ward-stock';
    
    // Debug log entire order structure
    console.log('[DEBUG] Recent order data structure:', JSON.stringify(recentOrders, null, 2));
    if (recentOrders.length > 0) {
        console.log('[DEBUG] First order type:', recentOrders[0].type);
        console.log('[DEBUG] First order medication:', recentOrders[0].medication);
        console.log('[DEBUG] Ward ID available:', recentOrders[0].wardId);
    }
    
    // Update header message to reflect correct time window
    if (headerElement) {
        const timeWindow = isWardStock ? '2 days' : '14 days';
        headerElement.textContent = `Warning: Recent Medication Orders (Last ${timeWindow})`;
    }
    
    // Build HTML for recent medications
    let alertHTML = '<table class="table table-striped">'
        + '<thead><tr>'
        + '<th>Medication</th>'
        + '<th>Formulation</th>'
        + '<th>Strength</th>'
        + '<th>Dose</th>'  // Always show dose column
        + '<th>Quantity</th>'
        + '<th>Ward</th>'  // Always show ward column
        + '<th>Order Date</th>'
        + '<th>Status</th>'
        + '<th>Requested By</th>'
        + '</tr></thead><tbody>';
    
    recentOrders.forEach(order => {
        const orderDate = new Date(order.timestamp);
        const formattedDate = orderDate.toLocaleDateString() + ' ' + orderDate.toLocaleTimeString();
        
        // Extract medication details - handle potential missing data gracefully
        const medName = order.medication.name || '-';
        const formulation = order.medication.formulation || '-';
        
        // Get strength directly from the medication object
        const strength = order.medication.strength || '-';
        
        const quantity = order.medication.quantity || '-';
        const dose = order.medication.dose || '-';
        
        // Get ward info
        const wardInfo = order.wardName || order.wardId || '-';
        
        // Log medication object to see if dose is present
        console.log(`[DEBUG] Medication data for ${medName}:`, order.medication);
        
        alertHTML += `
            <tr>
                <td>${medName}</td>
                <td>${formulation}</td>
                <td>${strength}</td>
                <td>${dose}</td>
                <td>${quantity}</td>
                <td>${wardInfo}</td>
                <td>${formattedDate}</td>
                <td>${formatStatusDisplay(order.status)}</td>
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
 * @returns {Promise} - Promise resolving to object with recentOrders array and warning flag
 */
async function checkRecentMedicationOrders(patientData, medications) {
    try {
        // If no API client, skip check
        if (!window.apiClient || typeof window.apiClient.post !== 'function') {
            console.warn('API client not available for recent medication check');
            return { recentOrders: [], warning: false };
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
        
        console.log('[DEBUG] Recent check API response:', response);
        
        if (response && response.success) {
            // Return both the orders array and the warning flag
            return {
                recentOrders: response.recentOrders || [],
                warning: response.warning === true,
                warningMessage: response.warningMessage
            };
        } else {
            console.error('Error checking recent medications:', response?.message || 'Unknown error');
            return { recentOrders: [], warning: false };
        }
    } catch (error) {
        console.error('Exception checking recent medications:', error);
        return { recentOrders: [], warning: false };
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
        // Create modal container with enhanced cross-browser compatibility
    const modalContainer = document.createElement('div');
    modalContainer.id = 'order-detail-modal';
    modalContainer.className = 'hidden';
    
    // Add explicit styling to improve cross-browser compatibility
    modalContainer.style.position = 'fixed';
    modalContainer.style.zIndex = '1000';
    
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
                <button type="button" class="btn btn-audit" id="view-history-btn">View Audit Trail</button>
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
async function showOrderDetails(order) {
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
    
    // Show/hide audit trail button based on access permissions
    const auditTrailBtn = document.getElementById('view-history-btn');
    if (auditTrailBtn) {
        const hasHistoryAccess = window.apiClient && typeof window.apiClient.getOrderHistory === 'function';
        auditTrailBtn.style.display = hasHistoryAccess ? 'inline-block' : 'none';
        if (hasHistoryAccess) {
            auditTrailBtn.setAttribute('data-order-id', order.id);
        }
    }
    
    // Show modal
    modal.style.display = 'block';
    modal.classList.remove('hidden');
    console.log('[MODAL] Modal shown');
    
    // Setup close handlers
    setupModalCloseHandlers();
}

/**
 * Enhance modal for cross-browser compatibility
 * @param {HTMLElement} modal - Modal element to enhance
 */
function enhanceModalForCrossBrowser(modal) {
    if (!modal) return;
    
    console.log('[MODAL] Applying cross-browser enhancements');
    
    // Apply animations via class
    modal.classList.add('show-modal');
    
    // Ensure consistent modal rendering across browsers
    modal.style.zIndex = '1000';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    
    // Ensure buttons have consistent styling
    const buttons = modal.querySelectorAll('.btn');
    buttons.forEach(button => {
        // Ensure cursor is pointer on all browsers
        button.style.cursor = 'pointer';
    });
    
    // Force browser to recompute styles for better rendering
    void modal.offsetWidth;
}

/**
 * Setup the modal buttons based on order status and current mode
 */
function setupModalButtons() {
    console.log('[MODAL] Setting up modal buttons');
    // Get button elements
    const editBtn = document.getElementById('edit-order-btn');
    const saveBtn = document.getElementById('save-order-btn');
    const cancelBtn = document.getElementById('cancel-order-btn');
    const closeBtn = document.getElementById('close-detail-btn');
    
    // Set up history button if it exists
    const historyBtn = document.getElementById('view-history-btn');
    if (historyBtn) {
        console.log('[MODAL] Found history button, setting up event listener');
        historyBtn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            console.log('[MODAL] View History button clicked for order:', orderId);
            if (orderId) {
                viewOrderHistory(orderId);
            }
        });
    }
    
    if (cancelBtn) {
        if (currentOrder && currentOrder.status === 'pending') {
            console.log('[MODAL] Showing cancel button for pending order');
            cancelBtn.classList.remove('hidden');
            cancelBtn.onclick = () => {
                console.log('[MODAL] Cancel button clicked for order:', currentOrder.id);
                cancelOrder(currentOrder.id);
            };
        } else {
            console.log('[MODAL] Hiding cancel button for non-pending order');
            cancelBtn.classList.add('hidden');
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
            <table class="order-metadata-table table-full-width" id="medications-table">
                <thead>
                    <tr>
                        ${editMode ? '<th class="th-full-width">Medication Details</th>' : `<th>Name</th>
                        <th>Details</th>`}
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (editMode) {
        // Edit mode: Show editable fields for each medication using form-group layout
        currentOrder.medications.forEach((med, index) => {
            detailsHTML += `
                <tr class="medication-row" data-index="${index}">
                    <td class="th-full-width cell-no-padding">
                        <div class="medication-item medication-edit-item medication-full-width">
                            <!-- Name field -->
                            <div class="form-group">
                                <label>Name:</label>
                                <input type="text" class="form-control medication-name" value="${med.name || ''}" placeholder="Medication name">
                            </div>
                            
                            <!-- Strength field -->
                            <div class="form-group">
                                <label>Strength:</label>
                                <input type="text" class="form-control medication-strength" value="${med.strength || ''}" placeholder="Strength">
                            </div>
                            
                            <!-- Form field -->
                            <div class="form-group">
                                <label>Form:</label>
                                <input type="text" class="form-control medication-form" value="${med.form || ''}" placeholder="Form">
                            </div>
                            
                            <!-- Quantity field -->
                            <div class="form-group">
                                <label>Quantity:</label>
                                <input type="text" class="form-control medication-quantity" value="${med.quantity || ''}" placeholder="Quantity">
                            </div>
                            
                            <!-- Dose field -->
                            <div class="form-group">
                                <label>Dose:</label>
                                <input type="text" class="form-control medication-dose" value="${med.dose || ''}" placeholder="Dose instructions">
                            </div>
                            
                            <!-- Notes field -->
                            <div class="form-group">
                                <label>Notes:</label>
                                <input type="text" class="form-control medication-notes" value="${med.notes || ''}" placeholder="Notes (optional)">
                            </div>
                            
                            <!-- Action buttons -->
                            <div class="form-group medication-actions">
                                <button type="button" class="btn btn-danger btn-sm" onclick="removeMedication(${index})">Remove</button>
                            </div>
                        </div>
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
                
                // Only add medications with at least a name AND quantity
                const medName = nameInput && nameInput.value.trim();
                const medQuantity = quantityInput && quantityInput.value.trim();
                
                if (medName) {
                    // Ensure quantity is always set - default to '1' if empty
                    const finalQuantity = medQuantity || '1';
                    
                    // Log validation info
                    console.log(`[SAVE] Medication: ${medName}, Quantity: ${finalQuantity}`);
                    
                    medications.push({
                        name: medName,
                        strength: strengthInput ? strengthInput.value.trim() : '',
                        form: formInput ? formInput.value.trim() : '',
                        quantity: finalQuantity, // Always set quantity
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

/**
 * Create the search orders modal container
 */
function createSearchOrdersModal() {
    // This modal is now created in HTML
    // Just need to add event listeners and ensure it's properly set up
    setupSearchModalHandlers();
}

/**
 * Open the search orders modal
 */
function openSearchOrdersModal() {
    const modal = document.getElementById('search-orders-modal');
    if (!modal) return;
    
    // Clear previous search results and reset form
    document.getElementById('search-orders-form').reset();
    document.getElementById('search-results').innerHTML = '<p class="empty-state">Enter a search term to find medication orders</p>';
    
    // Populate location dropdown with wards
    populateLocationDropdown();
    
    // Show the modal with animation classes
    modal.style.display = 'block';
    modal.classList.add('show-modal');
    
    // Enhance modal for cross-browser compatibility
    enhanceModalForCrossBrowser(modal);
}

/**
 * Populate the location dropdown with available wards
 */
function populateLocationDropdown() {
    const locationSelect = document.getElementById('location-filter');
    if (!locationSelect) return;
    
    // Keep the first 'All Locations' option
    while (locationSelect.options.length > 1) {
        locationSelect.options.remove(1);
    }
    
    // Add ward options from cache
    const wards = Object.entries(window.wardsCache || {});
    wards.sort((a, b) => a[1].name.localeCompare(b[1].name));
    
    wards.forEach(([wardId, wardData]) => {
        const option = document.createElement('option');
        option.value = wardId;
        option.textContent = wardData.name;
        locationSelect.appendChild(option);
    });
}

/**
 * Close the search orders modal
 */
function closeSearchOrdersModal() {
    const modal = document.getElementById('search-orders-modal');
    if (!modal) return;
    
    modal.style.display = 'none';
    modal.classList.remove('show-modal');
}

/**
 * Setup search modal event handlers
 */
function setupSearchModalHandlers() {
    // Close button handler
    const closeButton = document.querySelector('#search-orders-modal .close-modal');
    if (closeButton) {
        closeButton.addEventListener('click', closeSearchOrdersModal);
    }
    
    // Close when clicking outside the modal
    const modal = document.getElementById('search-orders-modal');
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeSearchOrdersModal();
            }
        });
    }
    
    // Search form submission
    const searchForm = document.getElementById('search-orders-form');
    if (searchForm) {
        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const searchTerm = document.getElementById('medication-search').value.trim();
            const locationId = document.getElementById('location-filter').value;
            
            if (searchTerm) {
                searchOrdersByMedication(searchTerm, locationId);
            }
        });
    }
    
    // Open modal button handler
    const searchButton = document.getElementById('search-orders-btn');
    if (searchButton) {
        searchButton.addEventListener('click', openSearchOrdersModal);
    }
}

/**
 * Search orders by medication name and other optional filters
 * @param {string} searchTerm - Term to search for in medication names and patient names
 * @param {string} locationId - Optional ward/location ID to filter by
 */
async function searchOrdersByMedication(searchTerm, locationId) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    
    try {
        // Show loading indicator
        resultsContainer.innerHTML = '<div class="loading-results">Searching orders...</div>';
        
        // Check if API client is available
        if (!window.apiClient) {
            console.error('API client not available for searching orders');
            resultsContainer.innerHTML = '<div class="error-message">Error: Unable to search orders. API client not available.</div>';
            return;
        }
        
        // Split search term into individual tokens for multi-word search
        const searchTokens = searchTerm.toLowerCase().split(/\s+/).filter(token => token.length > 0);
        
        // Call the API endpoint to search orders
        const response = await window.apiClient.searchOrdersByMedication({ 
            medicationName: searchTerm,
            searchTokens: searchTokens.join(','),
            wardId: locationId || undefined
        });
        
        console.log('Search orders response:', response);
        
        const orders = response.orders || [];
        
        if (orders.length > 0) {
            // Display search results using the same format as recent orders
            resultsContainer.innerHTML = `
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
                    <tbody id="search-results-table-body"></tbody>
                </table>
            `;
            
            const tableBody = document.getElementById('search-results-table-body');
            
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
                const requesterInfo = extractRequesterName(order) || 'Unknown';
                
                // Add cancellation info if order is cancelled
                let statusContent = `<span class="order-status status-${order.status}">${formatStatusDisplay(order.status)}</span>`;
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
        } else {
            resultsContainer.innerHTML = `
                <div class="no-results">No orders found containing "${searchTerm}". Try a different search term.</div>
            `;
        }
    } catch (error) {
        console.error('Error searching orders:', error);
        resultsContainer.innerHTML = `<div class="error-message">Error searching orders: ${error.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Create toast container for notifications
    createToastContainer();
    // Create search orders modal
    createSearchOrdersModal();
    
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
    console.log('[AUTO] Initializing medication autocomplete');
    loadMedicationData()
        .then(() => {
            console.log('[AUTO] Medication data loaded successfully');
            console.log('[AUTO] medicationsData loaded:', window.medicationsData ? window.medicationsData.length : 'None');
            console.log('[AUTO] aliasToGenericMap loaded:', window.aliasToGenericMap ? Object.keys(window.aliasToGenericMap).length : 'None');
            
            const medicationNameInputs = document.querySelectorAll('.medication-name');
            console.log('[AUTO] Found medication name inputs:', medicationNameInputs.length);
            medicationNameInputs.forEach(input => {
                setupMedicationAutocomplete(input);
            });
            
            // Setup specific inputs that might not be captured by the class selector
            const specificInputs = [
                { id: 'med-name-1', found: false },
                { id: 'med-form-1', found: false, formulation: true },
                { id: 'ws-med-name-1', found: false },
                { id: 'ws-med-form-1', found: false, formulation: true }
            ];
            
            specificInputs.forEach(spec => {
                const input = document.getElementById(spec.id);
                spec.found = !!input;
                if (input) {
                    if (spec.formulation) {
                        setupFormulationAutocomplete(input);
                    } else {
                        setupMedicationAutocomplete(input);
                    }
                }
            });
            
            console.log('[AUTO] Specific inputs status:', specificInputs);
        })
        .catch(error => {
            console.error('[AUTO] Error loading medication data:', error);
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
        
        // Add shouldPrescribeByBrand function to check if medication is in the brand exception list
        window.shouldPrescribeByBrand = function(medicationName) {
            if (!medicationName || !brandExceptionsList.length) return false;
            
            // Normalize the medication name for comparison
            const normalizedName = medicationName.toLowerCase().trim();
            
            // Check if this medication is in our brand exceptions list
            return brandExceptionsList.some(brand => {
                return normalizedName === brand || 
                       normalizedName.includes(brand) || 
                       brand.includes(normalizedName);
            });
        };
        
        // Add getGenericName function to map aliases to generic names
        window.getGenericName = function(medicationName) {
            if (!medicationName) return medicationName;
            
            // Check if this medication has a generic name mapping
            const normalizedName = medicationName.toLowerCase().trim();
            const genericName = window.aliasToGenericMap[normalizedName];
            
            // Return the generic name if found, otherwise return the original name
            return genericName || medicationName;
        };
        
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
                    
                    // Create tooltip element if it doesn't exist
                    let tooltipElement = wrapper.querySelector('.medication-tooltip');
                    if (!tooltipElement) {
                        tooltipElement = document.createElement('div');
                        tooltipElement.className = 'medication-tooltip';
                        tooltipElement.style.display = 'none';
                        tooltipElement.style.position = 'absolute';
                        tooltipElement.style.backgroundColor = '#f9f9f9';
                        tooltipElement.style.border = '1px solid #ccc';
                        tooltipElement.style.padding = '8px';
                        tooltipElement.style.borderRadius = '4px';
                        tooltipElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                        tooltipElement.style.zIndex = '1000';
                        tooltipElement.style.maxWidth = '250px';
                        wrapper.appendChild(tooltipElement);
                    }
                    
                    // Check if this medication should be prescribed by brand name
                    if (shouldPrescribeByBrand(selectedMed)) {
                        // Use the selected brand name as is
                        inputElement.value = selectedMed;
                        
                        // Show tooltip with brand name information
                        tooltipElement.textContent = 'This medication should be prescribed by brand name for patient safety.';
                        tooltipElement.style.display = 'block';
                        
                        // Hide tooltip after 5 seconds
                        setTimeout(() => {
                            if (tooltipElement) tooltipElement.style.display = 'none';
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
                                if (tooltipElement) tooltipElement.style.display = 'none';
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
            // No tooltipElement in this function
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
                <input type="text" id="med-strength-${index}" class="med-strength" placeholder="e.g., 500mg" 
                       autocomplete="nope" autocorrect="off" spellcheck="false" 
                       name="strength_${index}_${Math.random().toString(36).substring(2, 10)}" />
            </div>
            <div class="form-column">
                <label for="med-quantity-${index}">Quantity:</label>
                <input type="text" id="med-quantity-${index}" class="med-quantity" placeholder="e.g., 28" 
                       autocomplete="nope" autocorrect="off" spellcheck="false" required 
                       name="quantity_${index}_${Math.random().toString(36).substring(2, 10)}" />
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
                <input type="text" id="ws-med-strength-${index}" class="med-strength" placeholder="e.g., 500mg" 
                       autocomplete="nope" autocorrect="off" spellcheck="false" 
                       name="ws_strength_${index}_${Math.random().toString(36).substring(2, 10)}" />
            </div>
            <div class="form-column">
                <label for="ws-med-quantity-${index}">Quantity:</label>
                <input type="text" id="ws-med-quantity-${index}" class="med-quantity" placeholder="e.g., 28" 
                       autocomplete="nope" autocorrect="off" spellcheck="false" required 
                       name="ws_quantity_${index}_${Math.random().toString(36).substring(2, 10)}" />
            </div>
        </div>

        <div class="form-row">
            <div class="form-column">
                <label for="ws-med-dose-${index}">Dose:</label>
                <input type="text" id="ws-med-dose-${index}" class="med-dose" placeholder="e.g., 1-2 tablets daily" 
                       autocomplete="nope" autocorrect="off" spellcheck="false" 
                       name="ws_dose_${index}_${Math.random().toString(36).substring(2, 10)}" />
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
    console.log('[DEBUG] Starting collectWardStockMedicationsData');
    
    // Get all medication items
    const medicationItems = document.querySelectorAll('#ws-medications-container .medication-item');
    console.log('[DEBUG] Found medication items:', medicationItems.length);
    
    const medications = [];
    
    medicationItems.forEach((item, index) => {
        console.log(`[DEBUG] Processing item ${index}:`, item);
        
        const nameInput = item.querySelector('.med-name');
        const formInput = item.querySelector('.med-form');
        const strengthInput = item.querySelector('.med-strength');
        const quantityInput = item.querySelector('.med-quantity');
        const doseInput = item.querySelector('.med-dose');
        
        console.log(`[DEBUG] Item ${index} inputs:`, {
            nameInput: nameInput ? { found: true, value: nameInput.value } : 'not found',
            formInput: formInput ? { found: true, value: formInput.value } : 'not found',
            strengthInput: strengthInput ? { found: true, value: strengthInput.value } : 'not found',
            quantityInput: quantityInput ? { found: true, value: quantityInput.value } : 'not found',
            doseInput: doseInput ? { found: true, value: doseInput.value } : 'not found'
        });
        
        // Only add if we have at least a name and quantity
        if (nameInput && nameInput.value && quantityInput && quantityInput.value) {
            const medication = {
                name: nameInput.value,
                form: formInput ? formInput.value : '',
                strength: strengthInput ? strengthInput.value : '',
                quantity: quantityInput.value,
                dose: doseInput ? doseInput.value : ''
            };
            
            medications.push(medication);
            console.log(`[DEBUG] Added medication:`, medication);
        } else {
            console.log(`[DEBUG] Item ${index} skipped: missing name or quantity`, {
                hasNameInput: !!nameInput,
                nameValue: nameInput ? nameInput.value : 'N/A',
                hasQuantityInput: !!quantityInput,
                quantityValue: quantityInput ? quantityInput.value : 'N/A'
            });
        }
    });
    
    console.log('[DEBUG] Final medications array:', medications);
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
        const patient = {
            patientName: patientName,
            nhsNumber: patientNHS,
            hospitalNumber: patientID
        };
        
        // Attempt to check for recent orders
        try {
            console.log(`[DEBUG] Checking recent patient orders`);
            const result = await checkRecentMedicationOrders(patient, medications);
            console.log('[DEBUG] Patient check result:', result);
            
            // Check the warning flag from API response (preferred) or fall back to checking order count
            if (result.warning || (result.recentOrders && result.recentOrders.length > 0)) {
                showRecentMedicationAlert(result.recentOrders, () => {
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
            // Format the ward ID with 'ward-' prefix to signal this is a ward stock check
            // This allows the backend to distinguish between ward stock and patient orders
            const formattedWardId = wardId.startsWith('ward-') ? wardId : `ward-${wardId}`;
            
            const patientData = {
                // Use formatted ward ID as the hospital number to check for ward-specific recent orders
                hospitalNumber: formattedWardId
            };
            
            console.log(`[DEBUG] Checking recent ward stock orders for ward: ${formattedWardId}`);
            apiClient.checkRecentMedications(patientData, medications, wardId)
              .then(result => {
                console.log('[DEBUG] Recent medications API response:', JSON.stringify(result, null, 2));
                if (result && result.warning) {
                  const {recentOrders, warningMessage} = result;
                  console.log('[DEBUG] Recent orders to display:', JSON.stringify(recentOrders, null, 2));
                  showRecentMedicationAlert(recentOrders, warningMessage, () => {
                    // User clicked 'Proceed Anyway'
                    submitWardStockOrderFinal(orderData);
                  });
                  return; // Exit here, submitWardStockOrderFinal will be called by callback if user confirms
                } else {
                  // No recent orders, continue with normal submission
                  submitWardStockOrderFinal(orderData);
                }
              });
        } catch (error) {
            // Log error but continue with submission
            console.error('Error checking recent ward stock orders:', error);
        }
        
        // We no longer need this call - submission is handled inside the API callback
        // Removed to fix duplicate order submission
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
                const requesterInfo = extractRequesterName(order) || 'Unknown';
                
                // Add cancellation info if order is cancelled
                let statusContent = `<span class="order-status status-${order.status}">${formatStatusDisplay(order.status)}</span>`;
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
 * Extract requester name from an order object, handling various data formats
 * @param {Object} order - Order object to parse
 * @returns {string} - Requester name or 'Unknown' if not found
 */
function extractRequesterName(order) {
    if (!order) return 'Unknown';
    
    // Debug the requester object
    console.log('[MODAL] Extracting requester name from:', order);
    
    // Handle various formats and nested structures
    if (order.requester) {
        if (typeof order.requester === 'string') {
            return order.requester;
        }
        if (order.requester.name) {
            return order.requester.name;
        }
        if (order.requester.firstName && order.requester.surname) {
            return `${order.requester.firstName} ${order.requester.surname}`;
        }
        if (order.requester.first_name && order.requester.surname) {
            return `${order.requester.first_name} ${order.requester.surname}`;
        }
        if (order.requester.fullName) {
            return order.requester.fullName;
        }
        if (order.requester.userName || order.requester.username) {
            return order.requester.userName || order.requester.username;
        }
    }
    
    // Check for flattened properties
    if (order.requesterName) {
        return order.requesterName;
    }
    if (order.requester_name) {
        return order.requester_name;
    }
    if (order.requesterFirstName && order.requesterSurname) {
        return `${order.requesterFirstName} ${order.requesterSurname}`;
    }
    if (order.requester_first_name && order.requester_surname) {
        return `${order.requester_first_name} ${order.requester_surname}`;
    }
    
    return 'Unknown';
}

/**
 * Extract requester role from an order object, handling various data formats
 * @param {Object} order - Order object to parse
 * @returns {string} - Requester role or 'Unknown' if not found
 */
function extractRequesterRole(order) {
    if (!order) return 'Unknown';
    
    // Handle various formats
    if (order.requester) {
        if (order.requester.role) {
            return order.requester.role;
        }
        if (order.requester.userRole) {
            return order.requester.userRole;
        }
        if (order.requester.user_role) {
            return order.requester.user_role;
        }
    }
    
    // Check for flattened properties
    if (order.requesterRole) {
        return order.requesterRole;
    }
    if (order.requester_role) {
        return order.requester_role;
    }
    
    return 'Unknown';
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
    
    // Debug the entire order object to find all available fields
    console.log('[MODAL] Complete order object:', JSON.parse(JSON.stringify(order)));
    
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
        // Log full patient object to help debug
        console.log('[MODAL] Patient data:', order.patient);
        
        // Handle different possible field names with more varied formats
        const patientName = order.patient.name || order.patient.patientName || 'Not provided';
        const nhsNumber = order.patient.nhsNumber || order.patient.nhs_number || order.patient.nhsId || 
                         order.patient.nhs || order.nhs_number || order.nhsNumber || order.nhsId || 'Not provided';
        const hospitalNumber = order.patient.hospitalNumber || order.patient.hospitalId || 
                             order.patient.hospital_number || order.patient.hospital_id || 
                             order.hospitalNumber || order.hospitalId || 'Not provided';
        const wardName = getWardName(order.wardId) || order.patient.ward || 'Not provided';
        //const bedNumber = order.patient.bed || order.patient.bedNumber || 'Not provided';
        
        patientInfo = `
            <div class="order-section">
                <h4>Patient Information</h4>
                <div class="patient-details">
                    <p><strong>Name:</strong> ${patientName}</p>
                    <p><strong>NHS Number:</strong> ${nhsNumber}</p>
                    <p><strong>Hospital Number:</strong> ${hospitalNumber}</p>
                    <p><strong>Ward:</strong> ${wardName}</p>

                </div>
            </div>
        `;
    } else if (order.type === 'patient') {
        // If patient order type but no patient object, try alternative data paths
        console.log('[MODAL] No patient object, looking for alternative data paths');
        
        // For backward compatibility with older order formats
        const patientName = order.patientName || 'Not provided';
        const nhsNumber = order.nhsNumber || order.nhsId || order.nhs || order.nhs_number || 'Not provided';
        const hospitalNumber = order.hospitalNumber || order.hospitalId || order.hospital_number || order.hospital_id || 'Not provided';
        const wardName = getWardName(order.wardId) || 'Not provided';
        
        patientInfo = `
            <div class="order-section">
                <h4>Patient Information</h4>
                <div class="patient-details">
                    <p><strong>Name:</strong> ${patientName}</p>
                    <p><strong>NHS Number:</strong> ${nhsNumber}</p>
                    <p><strong>Hospital Number:</strong> ${hospitalNumber}</p>
                    <p><strong>Ward:</strong> ${wardName}</p>
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
                            <p><strong>Name:</strong> ${med.name || 'N/A'}</p>
                            <p><strong>Strength:</strong> ${med.strength || 'N/A'}</p>
                            <p><strong>Form:</strong> ${med.form || 'N/A'}</p>
                            <p><strong>Quantity:</strong> ${med.quantity || 'N/A'}</p>
                            <p><strong>Dose:</strong> ${med.dose || 'N/A'}</p>
                            ${med.notes ? `<p><strong>Notes:</strong> ${med.notes}</p>` : ''}
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
                <p><strong>Requester:</strong> ${extractRequesterName(order)} (${extractRequesterRole(order)})</p>
                ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
            </div>
        </div>
    `;
    
    // History button is now in the modal footer
    const hasHistoryAccess = window.apiClient && typeof window.apiClient.getOrderHistory === 'function';
    
    return `
        <div class="order-detail-content">
            ${orderInfo}
            ${order.status === 'cancelled' ? cancellationInfo : ''}
            ${patientInfo}
            ${medicationsHTML}
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
        
        if (!response || !response.success) {
            console.error('[HISTORY] Failed to fetch history:', response);
            showToastNotification('Failed to load audit trail: ' + (response?.message || 'Unknown error'), 'error');
            return;
        }
        
        // Extract history array from the response
        // API now returns {success: true, history: [array], pagination: {...}}
        const historyArray = response.history && Array.isArray(response.history) ? response.history : [];
        console.log('[HISTORY] Extracted history array:', historyArray);
        
        // Log the first history entry for debugging if available
        if (historyArray.length > 0) {
            console.log('[HISTORY] First history entry:', historyArray[0]);
            if (historyArray[0].previousData) {
                console.log('[HISTORY] First entry has previousData:', historyArray[0].previousData);
            }
            if (historyArray[0].newData) {
                console.log('[HISTORY] First entry has newData:', historyArray[0].newData);
            }
        }
        
        // Create and show history modal
        showHistoryModal(orderId, historyArray);
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
/**
 * Generates a readable diff between two objects
 * @param {Object} prevObj - Previous state object
 * @param {Object} newObj - New state object
 * @returns {string} - HTML string showing the differences
 */
function generateReadableDiff(prevObj, newObj) {
    // Initialize the HTML output
    let diffHTML = '<div class="changes-table">';
    
    // Special handling for status changes
    if (prevObj && newObj && 'status' in prevObj && 'status' in newObj && prevObj.status !== newObj.status) {
        diffHTML += `
            <div class="status-change-section">
                <h5>Status Change</h5>
                <div class="status-change-container">
                    <span class="status-tag status-${prevObj.status}">${formatStatusDisplay(prevObj.status)}</span>
                    <span class="status-arrow">→</span>
                    <span class="status-tag status-${newObj.status}">${formatStatusDisplay(newObj.status)}</span>
                </div>
            </div>
        `;
    }
    
    // Track if we found any differences
    let hasDifferences = false;
    
    // Use a consistent table structure but skip generic fields
    diffHTML += '<h5>Medication Changes</h5>';
    diffHTML += '<table class="table table-bordered table-sm">';
    
    // Special handling for medications array - compare item by item
    if (prevObj && newObj && 
        prevObj.medications && newObj.medications && 
        Array.isArray(prevObj.medications) && Array.isArray(newObj.medications)) {
        
        // Map previous medications by name for easy lookup
        const prevMedMap = new Map();
        prevObj.medications.forEach((med, index) => {
            // Use name as key, store with index
            if (med.name) prevMedMap.set(med.name, { data: med, index });
        });
        
        // Check each medication in the new state
        newObj.medications.forEach((newMed, newIndex) => {
            if (!newMed.name) return;
            
            const matchingPrevMed = prevMedMap.get(newMed.name);
            
            if (matchingPrevMed) {
                // This med exists in both - check for field changes
                const prevMed = matchingPrevMed.data;
                const medFields = new Set([...Object.keys(prevMed), ...Object.keys(newMed)]);
                
                let medChanges = [];
                medFields.forEach(field => {
                    const prevVal = prevMed[field];
                    const newVal = newMed[field];
                    
                    // Skip fields that aren't actually changing meaningfully
                    if (JSON.stringify(prevVal) === JSON.stringify(newVal)) {
                        return; // No change
                    }
                    
                    // Skip fields where both values are essentially empty/not set
                    const isEmptyValue = val => 
                        val === undefined || 
                        val === null || 
                        val === '' || 
                        val === 'Not set' || 
                        val === 'not set' ||
                        val === 'undefined';
                        
                    if (isEmptyValue(prevVal) && isEmptyValue(newVal)) {
                        return; // Both empty/not set, don't show
                    }
                    
                    medChanges.push({
                        field,
                        prev: prevVal,
                        new: newVal
                    });
                });
                
                if (medChanges.length > 0) {
                    hasDifferences = true;
                    diffHTML += `<tr>
                        <td><strong>Medication: ${newMed.name}</strong></td>
                        <td colspan="2">
                            <ul class="med-changes-list">`;
                    
                    medChanges.forEach(change => {
                        diffHTML += `<li>
                            <strong>${formatFieldName(change.field)}:</strong>
                            <span class="prev-value">${formatValueForDisplay(change.prev)}</span>
                            <span class="arrow-symbol">→</span>
                            <span class="new-value">${formatValueForDisplay(change.new)}</span>
                        </li>`;
                    });
                    
                    diffHTML += `</ul></td></tr>`;
                }
                
                // Remove from map to mark as processed
                prevMedMap.delete(newMed.name);
            } else {
                // This is a new medication
                hasDifferences = true;
                diffHTML += `<tr>
                    <td><strong>Added Medication</strong></td>
                    <td>-</td>
                    <td class="new-value">${newMed.name} ${newMed.strength || ''} ${newMed.form || ''} (${newMed.quantity || 1})</td>
                </tr>`;
            }
        });
        
        // Any medications left in prevMedMap were removed
        prevMedMap.forEach((value, medName) => {
            hasDifferences = true;
            const prevMed = value.data;
            diffHTML += `<tr>
                <td><strong>Removed Medication</strong></td>
                <td class="prev-value">${prevMed.name} ${prevMed.strength || ''} ${prevMed.form || ''} (${prevMed.quantity || 1})</td>
                <td>-</td>
            </tr>`;
        });
    }
    
    diffHTML += '</tbody></table></div>';
    
    // If no differences found, return a message
    if (!hasDifferences) {
        return '<div class="alert alert-info">No detailed changes detected</div>';
    }
    
    return diffHTML;
}

/**
 * Format a field name for display (converts snake_case/camelCase to Title Case)
 * @param {string} fieldName - The field name to format
 * @returns {string} - Formatted field name
 */
function formatFieldName(fieldName) {
    if (!fieldName) return 'Unknown Field';
    
    // Replace underscores with spaces
    const withSpaces = fieldName.replace(/_/g, ' ');
    
    // Handle camelCase - insert spaces before capital letters
    const withCamelSpaces = withSpaces.replace(/([A-Z])/g, ' $1');
    
    // Title case - capitalize first letter of each word
    return withCamelSpaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Formats a status value for display in a user-friendly format
 * @param {string} status - The raw status value from the database
 * @returns {string} - Formatted status for display
 */
function formatStatusDisplay(status) {
    if (!status) return 'Unknown';
    
    // Handle hyphenated statuses (e.g., 'in-progress')
    const formattedStatus = status
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    
    return formattedStatus;
}

/**
 * Format a value for display in the diff
 * @param {*} value - Value to format
 * @returns {string} - Formatted value
 */
function formatValueForDisplay(value) {
    if (value === undefined || value === null) {
        return '<em class="text-muted">Not set</em>';
    }
    
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            if (value.length === 0) return '<em class="text-muted">Empty list</em>';
            return `<em>${value.length} items</em>`;
        }
        return JSON.stringify(value);
    }
    
    // For simple values
    return String(value);
}

function showHistoryModal(orderId, historyData) {
    console.log('[MODAL] Creating history modal for order:', orderId, 'with data:', historyData);
    
    // Ensure we have an array (API might send different structures)
    const historyArray = Array.isArray(historyData) ? historyData : 
                         (historyData && historyData.history && Array.isArray(historyData.history)) ? 
                         historyData.history : [];
    
    console.log('[MODAL] Normalized history array length:', historyArray.length);
    
    // Add CSS for history diff styling if not already added
    if (!document.getElementById('history-diff-styles')) {
        const styles = document.createElement('style');
        styles.id = 'history-diff-styles';
        styles.textContent = `
            .changes-table { margin-top: 15px; }
            .changes-table table { width: 100%; margin-bottom: 15px; }
            .prev-value { color: #dc3545; text-decoration: line-through; }
            .new-value { color: #28a745; font-weight: 500; }
            .med-changes-list { list-style: none; padding-left: 0; }
            .med-changes-list li { margin-bottom: 5px; padding: 3px; border-bottom: 1px dotted #ccc; }
            .show-details-btn { margin-bottom: 5px; }
            .history-details { padding: 10px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9; margin-top: 5px; }
            
            /* Status change styling */
            .status-change-section { margin: 10px 0; padding: 10px; border-radius: 4px; background-color: #f5f5f5; }
            .status-change-container { display: flex; align-items: center; justify-content: center; gap: 15px; }
            .status-tag { padding: 5px 10px; border-radius: 4px; font-weight: 500; }
            .status-arrow { font-size: 20px; color: #666; }
            
            /* Status tag colors */
            .status-pending { background-color: #fff3cd; border: 1px solid #ffeeba; color: #856404; }
            .status-in-progress { background-color: #e6e6fa; border: 1px solid #d1d1f0; color: #4b0082; }
            .status-processing { background-color: #cce5ff; border: 1px solid #b8daff; color: #004085; }
            .status-completed { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
            .status-cancelled { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
            .status-unfulfilled { background-color: #fff6f6; border: 1px solid #f5c6cb; color: #9a3f38; }
        `;
        document.head.appendChild(styles);
    }
    
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
    modalContent.className = 'history-modal'; // Add class for targeting in CSS
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '800px'; // Slightly wider for better table display
    modalContent.style.maxWidth = '90%';
    modalContent.style.maxHeight = '80vh';
    modalContent.style.overflowY = 'auto';
    modalContent.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    // Ensure consistent rendering across browsers
    modalContent.style.boxSizing = 'border-box';
    
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
    if (historyArray && historyArray.length > 0) {
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
                    ${historyArray.map(entry => {
                        // Parse JSON data if needed and create useful diffs
                        let previousData = '';
                        let newData = '';
                        let changesHTML = '';
                        
                        try {
                            let prevObj = null;
                            let newObj = null;
                            
                            // Check for various field name formats (camelCase and snake_case)
                            if (entry.previousData) {
                                prevObj = typeof entry.previousData === 'string' ? 
                                    JSON.parse(entry.previousData) : entry.previousData;
                                previousData = JSON.stringify(prevObj, null, 2);
                                console.log('[MODAL] Found previousData (camelCase):', prevObj);
                            } else if (entry.previous_data) {
                                prevObj = typeof entry.previous_data === 'string' ? 
                                    JSON.parse(entry.previous_data) : entry.previous_data;
                                previousData = JSON.stringify(prevObj, null, 2);
                                console.log('[MODAL] Found previous_data (snake_case):', prevObj);
                            } else if (entry.previousState) {
                                prevObj = typeof entry.previousState === 'string' ? 
                                    JSON.parse(entry.previousState) : entry.previousState;
                                previousData = JSON.stringify(prevObj, null, 2);
                                console.log('[MODAL] Found previousState:', prevObj);
                            }
                            
                            if (entry.newData) {
                                newObj = typeof entry.newData === 'string' ? 
                                    JSON.parse(entry.newData) : entry.newData;
                                newData = JSON.stringify(newObj, null, 2);
                                console.log('[MODAL] Found newData (camelCase):', newObj);
                            } else if (entry.new_data) {
                                newObj = typeof entry.new_data === 'string' ? 
                                    JSON.parse(entry.new_data) : entry.new_data;
                                newData = JSON.stringify(newObj, null, 2);
                                console.log('[MODAL] Found new_data (snake_case):', newObj);
                            }
                            
                            // Generate user-friendly diff if we have both objects
                            if (prevObj && newObj) {
                                changesHTML = generateReadableDiff(prevObj, newObj);
                            }
                        } catch (e) {
                            console.error('Error parsing history JSON:', e);
                            changesHTML = '<p class="text-danger">Error parsing change data</p>';
                        }
                        
                        // Format action type for display with null safety
                        // Handle both snake_case and camelCase field names
                        let actionDisplay = 'Unknown Action';
                        const actionType = entry.action_type || entry.actionType;
                        
                        if (actionType) {
                            actionDisplay = actionType
                                .replace(/_/g, ' ')
                                .split(' ')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
                        } else {
                            console.log('[HISTORY] Entry missing action_type/actionType:', entry);
                        }
                        
                        // Handle both snake_case and camelCase field names
                        const timestamp = entry.action_timestamp || entry.timestamp || new Date().toISOString();
                        const modifiedBy = entry.modified_by || entry.modifiedBy || 'Unknown';
                        const reason = entry.reason || 'N/A';
                        
                        // Generate a unique ID for this history entry
                        const entryId = 'history-entry-' + (entry.id || Math.random().toString(36).substr(2, 9));
                        
                        return `
                        <tr class="history-main-row" data-entry-id="${entryId}">
                            <td>${new Date(timestamp).toLocaleString()}</td>
                            <td>${actionDisplay}</td>
                            <td>${modifiedBy}</td>
                            <td>${reason}</td>
                            <td>
                                ${previousData || newData ? 
                                    `<button class="btn btn-sm btn-outline-info toggle-details-btn" data-entry-id="${entryId}">Show Details</button>` 
                                : 'No details available'}
                            </td>
                        </tr>
                        ${previousData || newData ? `
                        <tr class="history-details-row" id="${entryId}-details">
                            <td colspan="5" style="display: none !important;">
                                <div class="history-details p-3">
                                    ${changesHTML || `
                                        <div class="changes-summary">
                                            <h5>Order State Changes</h5>
                                            <table class="table table-bordered table-sm">
                                                <thead><tr><th>Previous State</th><th>Current State</th></tr></thead>
                                                <tbody>
                                                    <tr>
                                                        <td>${previousData ? `<pre>${previousData}</pre>` : '-'}</td>
                                                        <td>${newData ? `<pre>${newData}</pre>` : '-'}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    `}
                                </div>
                            </td>
                        </tr>
                        ` : ''}
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
    
    // Add event listeners to show/hide details
    const detailButtons = modalContent.querySelectorAll('.toggle-details-btn');
    detailButtons.forEach(button => {
        button.addEventListener('click', function() {
            const entryId = this.getAttribute('data-entry-id');
            const detailsRow = document.getElementById(`${entryId}-details`);
            
            // Check if it's currently active
            const isActive = detailsRow.classList.contains('active');
            
            // Toggle the details row visibility using the active class
            if (isActive) {
                // Hide it
                detailsRow.classList.remove('active');
                this.textContent = 'Show Details';
            } else {
                // Show it
                detailsRow.classList.add('active');
                this.textContent = 'Hide Details';
                
                // Add animation when showing
                detailsRow.classList.add('highlight-animation');
                setTimeout(() => detailsRow.classList.remove('highlight-animation'), 1000);
            }
        });
    });
    
    // Styles are now in the standalone audit-trail.css file
    // No need to inject inline styles anymore
    
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
