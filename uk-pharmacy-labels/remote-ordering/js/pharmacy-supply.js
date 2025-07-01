/**
 * Remote Ordering System
 * Pharmacy Supply Module
 * Handles the pharmacy supply interface functionality
 * Fetches orders from backend API and displays them in the UI
 */

// Global variables
let orders = [];
let loading = false;
let ordersByStatusCache = {}; // Cache for storing fetched orders
let selectedOrderId = null;
let wardFilter = null;
let currentOrder = null;
let currentOrderDetails = [];
let isOrderInEditMode = false;
let groupSelectionMode = false;
let orderGroups = [];
let selectedOrders = [];
let orderGroupsHistory = [];
let selectedDispensaryId = null;

// Flag to prevent modals from automatically opening on page load
window.isInitialPageLoad = true;

// Load order groups history from session storage at page load
function initializeOrderGroupsHistory() {
    try {
        const storedGroups = JSON.parse(sessionStorage.getItem('orderGroupsHistory') || '[]');
        if (storedGroups.length > 0) {
            console.log(`Loaded ${storedGroups.length} groups from session storage at initialization`);
            orderGroupsHistory = storedGroups;
        }
    } catch (e) {
        console.error('Error loading stored groups from session storage at initialization:', e);
    }
}

// Initialize order groups history when this script loads
initializeOrderGroupsHistory();

// Function to add a newly created group to history
function addToOrderGroupsHistory(group) {
    if (!group) {
        console.error('Cannot add null or undefined group to history');
        return;
    }
    
    // Don't add duplicates
    if (!orderGroupsHistory.some(g => g.id === group.id || g.groupNumber === group.groupNumber)) {
        // Make a copy to avoid reference issues
        const groupCopy = JSON.parse(JSON.stringify(group));
        orderGroupsHistory.push(groupCopy);
        console.log(`Added group ${group.groupNumber} to history cache. Total cached: ${orderGroupsHistory.length}`);
        
        // Also store in session storage for persistence across page reloads
        try {
            const storedGroups = JSON.parse(sessionStorage.getItem('orderGroupsHistory') || '[]');
            // Avoid duplicates in storage too
            if (!storedGroups.some(g => g.id === group.id || g.groupNumber === group.groupNumber)) {
                storedGroups.push(groupCopy);
                sessionStorage.setItem('orderGroupsHistory', JSON.stringify(storedGroups));
                console.log('Updated order groups history in session storage');
            }
        } catch (e) {
            console.error('Error saving order groups to session storage:', e);
        }
    }
}

/**
 * Convert a raw order status into user-friendly text.
 * Exposed globally so any module or inline HTML can reuse it.
 * @param {string} status
 * @returns {string}
 */
function formatStatusDisplay(status) {
    if (!status) return 'Not Set';
    const map = {
        'pending': 'Pending',
        'in-progress': 'In Progress',
        'processing': 'Processing',
        'unfulfilled': 'Unfulfilled',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return map[status] || status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
// make accessible across scripts
if (typeof window !== 'undefined') {
    window.formatStatusDisplay = formatStatusDisplay;
}

/**
 * Updates the selected orders count and enables/disables the Create Group button
 */
function updateSelectedOrdersCount() {
    const selectedCheckboxes = document.querySelectorAll('.order-select-checkbox:checked');
    const selectedCount = selectedCheckboxes.length;
    const countDisplay = document.getElementById('selected-count');
    const createGroupBtn = document.getElementById('create-order-group-btn');
    
    if (countDisplay) {
        countDisplay.textContent = `${selectedCount} ${selectedCount === 1 ? 'order' : 'orders'} selected`;
    }
    
    if (createGroupBtn) {
        createGroupBtn.disabled = selectedCount === 0;
    }
}

/**
 * Handles the select-all checkbox toggle
 * @param {Event} event - The change event
 */
function toggleSelectAllOrders(event) {
    const isChecked = event.target.checked;
    const checkboxes = document.querySelectorAll('.order-select-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    
    updateSelectedOrdersCount();
}

/**
 * Updates the status of a group of orders
 * @param {Array} orderIds - Array of order IDs to update
 * @param {string} status - The new status to set (e.g., 'in-progress')
 * @param {string} reason - Reason for the status change (for audit trail)
 * @returns {Promise} - Promise that resolves when all orders are updated
 */
function updateGroupOrderStatuses(orderIds, status, reason = null) {
    console.log(`Updating ${orderIds.length} orders to status: ${status} with reason: ${reason || 'No reason provided'}`);
    
    // Check if OrderManager is available for bulk update
    if (window.OrderManager && typeof window.OrderManager.updateOrdersStatus === 'function') {
        return window.OrderManager.updateOrdersStatus(orderIds, status, reason);
    }
    
    // Fallback to API client if available
    if (window.apiClient && typeof window.apiClient.updateOrdersStatus === 'function') {
        return window.apiClient.updateOrdersStatus(orderIds, status, reason);
    }
    
    // If apiClient with generic request method is available, use it per order (includes auth)
    if (window.apiClient && typeof window.apiClient.put === 'function') {
        const promises = orderIds.map(orderId => {
            return window.apiClient.put(`/orders/${orderId}/status`, { status, reason })
                .then(res => {
                    if (!res.success) {
                        throw new Error(`API client failed to update order ${orderId} status`);
                    }
                    return res;
                });
        });
        return Promise.all(promises);
    }
    
    // Last resort: raw fetch with token/cookies
    // Get authentication token if available
    const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    
    const updatePromises = orderIds.map(orderId => {
        // Prepare headers with authentication
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add authorization header if token exists
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        return fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({ status, reason }),
            credentials: 'include' // Include cookies for session-based auth
        })
        .then(response => {
            if (!response.ok) {
                console.error(`Failed to update order ${orderId} status: ${response.status} ${response.statusText}`);
                throw new Error(`Failed to update order ${orderId} status`);
            }
            return response.json();
        });
    });
    
    return Promise.all(updatePromises);
}

/**
 * Shows the create order group modal
 * Collects selected order IDs and displays a form to create a group
 */
function showCreateGroupModal(orderIdsToGroup = []) {
    let selectedOrderIds = [];

    if (orderIdsToGroup.length > 0) {
        selectedOrderIds = orderIdsToGroup;
    } else {
        // Get all selected order checkboxes if no specific orderIds are provided
        const selectedCheckboxes = document.querySelectorAll('.order-select-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            showNotification('Please select at least one order to group', 'warning');
            return;
        }
        selectedCheckboxes.forEach(checkbox => selectedOrderIds.push(checkbox.closest('tr').dataset.orderId));
    }

    if (selectedOrderIds.length === 0) {
        showNotification('Please select at least one order to group', 'warning');
        return;
    }
    
    console.log('[showCreateGroupModal] Starting to create modal');
    
    // Get all the selected orders data (not just IDs)
    const selectedOrders = [];
    const patients = new Set();
    const wards = new Set();
    
    // Check if OrderManager is available
    const hasOrderManager = window.OrderManager && typeof window.OrderManager.getOrderById === 'function';
    if (!hasOrderManager) {
        console.error('[showCreateGroupModal] OrderManager not available - full data may not be accessible');
    }
    
    selectedOrderIds.forEach(orderId => {
        // IMPORTANT: Always get orders from OrderManager which has the COMPLETE data
        let order;
        
        if (hasOrderManager) {
            // Get complete order data from OrderManager
            order = window.OrderManager.getOrderById(orderId);
            console.log(`[OrderManager] Complete order data for ${orderId}:`, order);
        } 
        
        // Only fallback to DOM extraction if OrderManager is completely unavailable
        if (!order) {
            console.warn(`[Warning] Falling back to DOM extraction for order ${orderId} - data may be incomplete`);
            // Attempt to get from DOM if OrderManager fails, though this is less reliable
            const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
            if (row) {
                order = getOrderFromRow(row);
            }
        }
        
        if (order) {
            console.log(`[Debug] Order ${orderId} for modal:`, JSON.stringify(order, null, 2));
            
            selectedOrders.push(order);
            
            // Collect patient names and wards for grouping info
            if (order.patient?.name) {
                patients.add(order.patient.name);
            }
            
            if (order.wardName) {
                wards.add(order.wardName);
            } else if (order.wardId) {
                wards.add(`Ward ${order.wardId}`);
            }
        }
    });
    
    // Generate 5-character alphanumeric group number (uppercase)
    const charSet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // exclude confusing chars
    const groupNumber = Array.from({ length: 5 }, () => charSet[Math.floor(Math.random() * charSet.length)]).join('');

    // Leave notes blank for user input
    const autoNotes = '';

    // Generate medication details list with patient + ward context
    let medicationsList = '';
    selectedOrders.forEach(order => {
        // Extract data from the order object - now using OrderManager data which has all fields
        console.log('[Modal] Processing complete order object:', order);
        
        // PATIENT DATA
        const patientName = order.patient?.name || 'Unknown';
        
        // HOSPITAL NUMBER
        // Based on user's logs, the hospitalId or nhs field contains the hospital number
        let hospitalNo = 'N/A';
        if (order.patient) {
            // Try all possible fields from most to least likely based on user's logs
            hospitalNo = order.patient.hospitalId || 
                        order.patient.nhs || 
                        order.patient.hospitalNumber || 
                        'N/A';
            console.log('[Modal] Hospital number extracted:', hospitalNo);
        }
        
        // WARD NAME
        const wardName = order.wardName || 
                        (order.wardId && !isNaN(order.wardId) ? `Ward ${order.wardId}` : order.wardId) || 
                        'N/A';

        // MEDICATIONS
        if (order.medications && order.medications.length > 0) {
            order.medications.forEach(med => {
                // Log full medication object to help with debugging
                console.log('[Modal] Processing medication:', med);
                
                const parts = [];
                
                // Create single-line comma separated display for medications
                const medParts = [];
                
                // Start with basic medication info - name, strength, form
                const basicInfo = [];
                if (med.name) basicInfo.push(med.name);
                if (med.strength) basicInfo.push(med.strength);
                if (med.form) basicInfo.push(med.form);
                medParts.push(basicInfo.join(' '));
                
                // Add dose if available - only if it has actual content
                if (med.dose && String(med.dose).trim()) {
                    medParts.push(`Dose: ${med.dose.trim()}`);
                }
                console.log('[Modal] Dose value:', med.dose);
                
                // Add quantity if available - only if it has actual content
                if (med.quantity && String(med.quantity).trim()) {
                    medParts.push(`Quantity: ${med.quantity.trim()}`);
                } else if (med.quantity === '') {
                    // For empty string quantity, often this means the data exists but wasn't properly extracted
                    console.log('[Modal] Empty quantity, checking if we can find it elsewhere');
                    // Try looking for quantity in other fields or related data
                    if (order.orderDetails && order.orderDetails.quantity) {
                        medParts.push(`Quantity: ${order.orderDetails.quantity}`);
                    }
                }
                console.log('[Modal] Quantity value:', med.quantity);
                
                // Check both patient data and medication data for hospital number
                let displayHospitalNo = hospitalNo;
                
                // If medication has hospital number, prefer that
                if (med.hospitalNumber && med.hospitalNumber.trim()) {
                    displayHospitalNo = med.hospitalNumber;
                }
                
                // Add hospital number if available - only if it's not N/A
                if (displayHospitalNo && displayHospitalNo !== 'N/A') {
                    medParts.push(`Hospital #: ${displayHospitalNo}`);
                } else if (order.patient && order.patient.hospitalNumber) {
                    medParts.push(`Hospital #: ${order.patient.hospitalNumber}`);
                }
                
                // Add patient name and ward
                medParts.push(`Patient: ${patientName}`);
                medParts.push(`Ward: ${wardName}`);
                
                // Join all parts with commas for single-line display
                const medInfo = medParts.join(', ');
                
                // Use the single-line format for each medication
                console.log('[Modal] Generated medication info:', medInfo);
                medicationsList += `<li class="med-item">${medInfo}</li>`;
            });
        }
    });
    
    // Create and show the modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Create Order Group</h2>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <p>You are creating a group with ${selectedOrderIds.length} order${selectedOrderIds.length > 1 ? 's' : ''}.</p>
                
                <div class="form-group">
                    <label for="group-number">Group Number:</label>
                    <input type="text" id="group-number" class="form-control" value="${groupNumber}" readonly>
                </div>
                
                <div class="form-group">
                    <label for="group-notes">Notes:</label>
                    <textarea id="group-notes" class="form-control" placeholder="Add any notes (optional)">${autoNotes}</textarea>
                </div>
                
                <div class="selected-medications">
                    <h3>Selected Medications</h3>
                    <style>
                        .selected-medications-list {
                            list-style-type: none;
                            padding: 0;
                        }
                        .med-item {
                            padding: 8px;
                            margin-bottom: 10px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                        }
                    </style>
                    <ul class="selected-medications-list medications-list-scrollable">
                        ${medicationsList || '<li>No medications found</li>'}
                    </ul>
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancel-group" class="btn btn-secondary">Cancel</button>
                <button id="create-group" class="btn btn-primary">Create Group</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up event handlers
    const closeBtn = modal.querySelector('.close-modal');
    const cancelBtn = modal.querySelector('#cancel-group');
    const createBtn = modal.querySelector('#create-group');
    
    // Close modal handlers
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Create group handler
    createBtn.addEventListener('click', () => {
        const groupNumber = document.getElementById('group-number').value;
        const groupNotes = document.getElementById('group-notes').value;
        
        createOrderGroup(selectedOrderIds, groupNumber, groupNotes);
        document.body.removeChild(modal);
    });
}

/**
 * Extract order data from a table row
 * @param {HTMLElement} row - The order row element
 * @returns {Object|null} - The order data or null if not found
 */
function getOrderFromRow(row) {
    if (!row || !row.dataset.orderId) return null;
    
    const orderId = row.dataset.orderId;
    
    // Try to find the order in our loaded orders
    const orderData = {
        id: orderId,
        type: '', // Will be set below if patient info exists
        patient: {},
        medications: [],
        wardName: '',
        wardId: ''
    };
    
    // Extract patient name if exists
    const patientCell = row.querySelector('.patient-info');
    if (patientCell) {
        if (patientCell.textContent.includes('Ward Stock')) {
            orderData.type = 'ward';
        } else {
            orderData.type = 'patient';
            // Try to extract patient name (excluding ID if present)
            const patientText = patientCell.textContent.trim();
            const nameMatch = patientText.match(/^([^(]+)/); // Match everything before a '('
            if (nameMatch) {
                orderData.patient.name = nameMatch[1].trim();
            }
            
            // Extract hospital number if present in patient cell
            const hospitalMatch = patientText.match(/\((\w+\d+)\)/);
            if (hospitalMatch) {
                orderData.patient.hospitalNumber = hospitalMatch[1];
            }
        }
    }
    
    // Extract ward info
    const wardCell = row.querySelector('.ward-info');
    if (wardCell) {
        orderData.wardName = wardCell.textContent.trim();
        orderData.wardId = wardCell.textContent.trim();
    }
    
    // Extract medications with improved parsing
    const medsCell = row.querySelector('.medications-info');
    if (medsCell) {
        const medLines = medsCell.innerHTML.split('<br>');
        medLines.forEach(medLine => {
            if (medLine.trim()) {
                console.log('[DOM Extraction] Processing med line:', medLine);
                
                // More sophisticated parsing
                const medText = medLine.trim();
                
                // Extract quantity (often shown as ×28 or similar)
                const quantityMatch = medText.match(/×([\d.]+)/);
                const quantity = quantityMatch ? quantityMatch[1] : '';
                
                // Extract dose (often shown in format like '1 tablet ON')
                const dosePattern = /(\d+[\s\w]+(?:ON|TWICE|THREE|FOUR|DAILY|WEEKLY|MONTHLY|AS))\b/i;
                const doseMatch = medText.match(dosePattern);
                const dose = doseMatch ? doseMatch[1] : '';
                
                // Extract basic parts (name, strength, form)
                // Handle case where some parts might be missing
                let remainingText = medText;
                if (quantityMatch) remainingText = remainingText.replace(quantityMatch[0], '');
                if (doseMatch) remainingText = remainingText.replace(doseMatch[0], '');
                
                // Split the remaining text for basic medication info
                const basicParts = remainingText.trim().split(/\s+/).filter(Boolean);
                
                // Hospital number extraction (often in parentheses after patient name)
                const hospitalMatch = medText.match(/\((\w+\d+)\)/);
                const hospitalNumber = hospitalMatch ? hospitalMatch[1] : '';
                
                // Create medication object with all extracted fields
                const med = {
                    name: basicParts[0] || '',
                    strength: basicParts[1] || '',
                    form: basicParts[2] || '',
                    dose: dose,
                    quantity: quantity,
                    hospitalNumber: hospitalNumber
                };
                
                console.log('[DOM Extraction] Extracted medication:', med);
                orderData.medications.push(med);
            }
        });
    }
    
    // Hospital number extraction is now handled above in the patient info block
    
    return orderData;
}

/**
 * Create an order group with selected orders
 * @param {Array<string>} orderIds - IDs of orders to group
 * @param {string} groupNumber - Group number/identifier
 * @param {string} notes - Additional notes for the group
 */
function createOrderGroup(orderIds, groupNumber, notes) {
    // Show loading indicator
    showNotification('Creating order group...', 'info');
    
    // Prepare request data
    const data = {
        orderIds,
        groupNumber,
        notes,
        status: 'in-progress' // Send status with group creation
    };
    
    console.log('Creating order group with data:', data);
    
    // Use OrderManager or fallback to direct fetch
    if (window.OrderManager && typeof window.OrderManager.createOrderGroup === 'function') {
        return window.OrderManager.createOrderGroup(data)
            .then(result => {
                handleGroupCreationSuccess(result, orderIds, groupNumber);
            })
            .catch(error => {
                handleGroupCreationError(error);
            });
    }
    
    // Use apiClient if available (preferred way with built-in auth)
    if (window.apiClient && typeof window.apiClient.post === 'function') {
        return window.apiClient.post('/order-groups', data)
            .then(result => {
                handleGroupCreationSuccess(result, orderIds, groupNumber);
            })
            .catch(error => {
                handleGroupCreationError(error);
            });
    }
    
    // Fallback to direct API call with auth headers
    const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    
    const headers = {
        'Content-Type': 'application/json'
    };
    
    // Add authorization header if token exists
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    fetch('/api/order-groups', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data),
        credentials: 'include' // Include cookies for session-based auth
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to create order group: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(result => {
        handleGroupCreationSuccess(result, orderIds, groupNumber);
    })
    .catch(error => {
        handleGroupCreationError(error);
    });
}

/**
 * Handle successful order group creation
 * @param {Object} result - API response
 * @param {Array<string>} orderIds - IDs of grouped orders
 * @param {string} groupNumber - The group number
 */
function handleGroupCreationSuccess(result, orderIds, groupNumber) {
    console.log('Group creation success:', result);
    showNotification(`Order group "${groupNumber}" created successfully`, 'success');
    
    // Add this successful group to our history cache
    addToOrderGroupsHistory(result);
    
    // Update all order statuses to 'in-progress'
    const groupReason = `Added to order group: ${groupNumber}`;
    updateGroupOrderStatuses(orderIds, 'in-progress', groupReason)
        .then(() => {
            console.log('All orders in group updated to in-progress status');
            
            // Refresh orders list to show the new grouping and status changes
            loadOrders();
            
            // Uncheck all checkboxes
            const checkboxes = document.querySelectorAll('.order-select-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // Exit group selection mode
            if (typeof groupSelectionMode !== 'undefined' && groupSelectionMode) {
                toggleGroupSelectionMode();
            }
            
            // Update selected count
            updateSelectedOrdersCount();
        })
        .catch(error => {
            console.error('Error updating order statuses:', error);
            showNotification('Group created, but some order statuses could not be updated', 'warning');
            
            // Continue with normal flow
            loadOrders();
            
            // Uncheck all checkboxes
            const checkboxes = document.querySelectorAll('.order-select-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // Exit group selection mode
            if (typeof groupSelectionMode !== 'undefined' && groupSelectionMode) {
                toggleGroupSelectionMode();
            }
            
            // Update selected count
            updateSelectedOrdersCount();
        });
}

/**
 * Handle error during order group creation
 * @param {Error} error - The error object
 */
function handleGroupCreationError(error) {
    console.error('Error creating order group:', error);
    showNotification('Error creating order group', 'error');
    
    // Check if it's an auth error
    if (error.message && error.message.includes('401')) {
        showNotification('Authentication failed. Please log in again.', 'error');
    }
}

/**
 * Toggles group selection mode on/off
 */
function toggleGroupSelectionMode() {
    groupSelectionMode = !groupSelectionMode;
    loadOrders();
    const createGroupBtn = document.getElementById('create-group-btn');
    const confirmGroupBtn = document.getElementById('confirm-group-btn');
    const selectAllContainer = document.getElementById('select-all-container');
    if (groupSelectionMode) {
        if (createGroupBtn) {
            createGroupBtn.textContent = 'Cancel Grouping';
            createGroupBtn.classList.add('active');
        }
        if (confirmGroupBtn) confirmGroupBtn.classList.remove('hidden');
        if (selectAllContainer) selectAllContainer.classList.remove('hidden');
    } else {
        if (createGroupBtn) {
            createGroupBtn.textContent = 'Create Order Group';
            createGroupBtn.classList.remove('active');
        }
        if (confirmGroupBtn) confirmGroupBtn.classList.add('hidden');
        if (selectAllContainer) selectAllContainer.classList.add('hidden');
    }
}

/**
 * Loads dispensary options and initializes the dispensary selector
 */
async function initializeDispensarySelector() {
  const dispensarySelector = document.getElementById('dispensary-selector');
  if (!dispensarySelector) {
    console.error('Dispensary selector not found');
    return;
  }

  // First, restore any previously selected dispensary from local storage
  selectedDispensaryId = localStorage.getItem('selectedDispensaryId');
  
  try {
    // Fetch all dispensaries from API
    console.log('Loading dispensaries...');
    const response = await window.apiClient.getAllDispensaries();
    
    if (response && response.dispensaries && Array.isArray(response.dispensaries)) {
      // Clear existing options except the first placeholder
      while (dispensarySelector.options.length > 1) {
        dispensarySelector.remove(1);
      }
      
      // Add dispensary options
      response.dispensaries.forEach(dispensary => {
        const option = document.createElement('option');
        option.value = dispensary.id;
        option.textContent = dispensary.name;
        dispensarySelector.appendChild(option);
        
        // If this is the first load and we have no selected dispensary,
        // use the first one as default
        if (!selectedDispensaryId && dispensary === response.dispensaries[0]) {
          selectedDispensaryId = dispensary.id;
          localStorage.setItem('selectedDispensaryId', selectedDispensaryId);
        }
      });
      
      // Set the selected dispensary if we have one
      if (selectedDispensaryId) {
        dispensarySelector.value = selectedDispensaryId;
      }
      
      // Add event listener for dispensary changes
      dispensarySelector.addEventListener('change', handleDispensaryChange);
      
      console.log(`Loaded ${response.dispensaries.length} dispensaries`); 
    } else {
      console.error('Invalid dispensaries response:', response);
    }
  } catch (error) {
    console.error('Error loading dispensaries:', error);
  }
}

/**
 * Handle change of selected dispensary
 */
function handleDispensaryChange(event) {
  const newDispensaryId = event.target.value;
  console.log(`Dispensary changed to: ${newDispensaryId}`);
  
  // Save the selected dispensary ID
  selectedDispensaryId = newDispensaryId;
  localStorage.setItem('selectedDispensaryId', selectedDispensaryId);
  
  // You can add additional logic here, such as refreshing the orders list
  // or updating other UI elements based on the selected dispensary
}

document.addEventListener('DOMContentLoaded', () => {
    // Add the animation class to the container on load
    const ordersList = document.getElementById('orders-list');
    if (ordersList) ordersList.classList.add('fade-transition');
    
    // Initialize filter controls
    initializeOrderFilters();
    
    // Initialize dispensary selector
    initializeDispensarySelector();
    
    // Force-hide all modals on page load and apply display:none style
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    });
    
    // Initialize order groups button
    const orderGroupsBtn = document.getElementById('view-order-groups-btn');
    if (orderGroupsBtn) {
        orderGroupsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Pass true to indicate this is a user-initiated action
            displayOrderGroupsModal(false, true);
        });
    }
    
    // Initialize modal close buttons for order groups modal
    const orderGroupsModal = document.getElementById('order-groups-modal');
    if (orderGroupsModal) {
        // Ensure it's hidden
        orderGroupsModal.classList.add('hidden');

        const closeButtons = orderGroupsModal.querySelectorAll('.modal-close, .modal-close-btn');
        closeButtons.forEach(button => {
            button.addEventListener('click', function() {
                orderGroupsModal.classList.add('hidden');
            });
        });

        // Allow clicking outside modal-content to close
        orderGroupsModal.addEventListener('click', function(event) {
            if (event.target === orderGroupsModal) {
                orderGroupsModal.classList.add('hidden');
            }
        });
    }
    
    // Initialize modal close buttons for change status modal
    const changeStatusModal = document.getElementById('change-status-modal');
    if (changeStatusModal) {
        // Force hide the modal on load
        changeStatusModal.classList.add('hidden');
        changeStatusModal.style.display = 'none';
        
        const closeButtons = changeStatusModal.querySelectorAll('.modal-close, .modal-close-btn');
        closeButtons.forEach(button => {
            button.addEventListener('click', function() {
                changeStatusModal.classList.add('hidden');
                changeStatusModal.style.display = 'none';
            });
        });
        
        // Add escape key handler for this modal
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && !changeStatusModal.classList.contains('hidden')) {
                changeStatusModal.classList.add('hidden');
                changeStatusModal.style.display = 'none';
            }
        });
    }
    
    // Initialize order management
    initializeOrderFilters();
    console.log('Order Manager initialized with 0 orders');

    // Reset the initial page load flag after a delay
    setTimeout(() => {
        window.isInitialPageLoad = false;
        console.log('Initial page load flag reset - modals can now be shown normally');
    }, 1500);
    
    // Add Supply Functions section
    const supplyFunctions = document.createElement('div');
    supplyFunctions.className = 'supply-functions-section';
    supplyFunctions.innerHTML = `
        <h2>Supply Functions</h2>
        <div class="button-group">
            <button id="create-group-btn" class="secondary-btn small-btn">Create Order Group</button>
            <button id="confirm-group-btn" class="primary-btn small-btn hidden">Confirm Order Group</button>
            <button id="view-order-groups-btn" class="secondary-btn small-btn">View Order Groups</button>
        </div>
    `;
    
    // Find the appropriate containers
    const recentOrdersSection = document.querySelector('.recent-orders');
    const pharmacyDashboard = document.querySelector('.pharmacy-dashboard');
    const mainContainer = document.querySelector('.main-content') || document.querySelector('.container') || document.body;
    
    // Insert the supply functions above the incoming orders section
    if (recentOrdersSection && recentOrdersSection.parentNode) {
        // Insert before recent orders section (which contains the incoming orders)
        recentOrdersSection.parentNode.insertBefore(supplyFunctions, recentOrdersSection);
    } else if (pharmacyDashboard) {
        // If we can't find recent-orders but can find the dashboard, prepend to dashboard
        pharmacyDashboard.prepend(supplyFunctions);
    } else {
        // Otherwise append to the main container
        mainContainer.appendChild(supplyFunctions);
    }
    
    // Set up event listeners for the group buttons
    const createGroupBtn = document.getElementById('create-group-btn');
    createGroupBtn.addEventListener('click', toggleGroupSelectionMode);
    
    // Set up event listener for the Confirm Group button
    const confirmGroupBtn = document.getElementById('confirm-group-btn');
    confirmGroupBtn.addEventListener('click', showCreateGroupModal);
    
    // Set up event listener for the View Order Groups button
    const viewOrderGroupsBtn = document.getElementById('view-order-groups-btn');
    if (viewOrderGroupsBtn) {
        viewOrderGroupsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Clear any previous state
            orderGroupsModalUserRequested = true;
            // Display the modal with explicit user action flag
            displayOrderGroupsModal(false, true);
            console.log('View Order Groups button clicked');
        });
    }
    
    async function initializePage() {
        const wardFilter = document.getElementById('filter-ward');
        const searchInput = document.getElementById('search-orders');
        const refreshBtn = document.getElementById('refresh-orders-btn');

        // Disable controls until data is loaded
        if (wardFilter) wardFilter.disabled = true;
        if (searchInput) searchInput.disabled = true;
        if (refreshBtn) refreshBtn.disabled = true;

        // Show a loading indicator
        const ordersList = document.getElementById('orders-list');
        if (ordersList) {
            ordersList.innerHTML = '<p class="loading-message">Loading all orders and groups...</p>';
        }

        await loadWardOptions();
        // Load all data in parallel and wait for it to complete
        await Promise.all([
            loadOrders(), 
            loadOrderGroups()
        ]);

        // Enable controls now that data is loaded
        if (wardFilter) wardFilter.disabled = false;
        if (searchInput) searchInput.disabled = false;
        if (refreshBtn) refreshBtn.disabled = false;

        // Initial render of orders
        applyFiltersAndRender();
    }

    initializePage();
    
    // Initialize panel functionality
    initializePanels();
});

/**
 * Applies current filters to the cached order data and re-renders the list.
 */
/**
 * Applies current filters to the cached order data and re-renders the list.
 * Also handles direct search for order group IDs.
 */
async function applyFiltersAndRender() {
    const searchInput = document.getElementById('search-orders');
    const searchText = searchInput ? searchInput.value.trim().toUpperCase() : '';

    console.log(`[Search Debug] Applying filter with search text: "${searchText}"`);

    // Check if the search text matches an order group ID
    if (searchText.length > 0) {
        console.log(`[Search Debug] Checking against ${orderGroupsHistory.length} cached order groups.`);
        const matchedGroup = orderGroupsHistory.find(group => group.group_number === searchText);
        
        if (matchedGroup) {
            console.log('[Search Debug] Found matching group:', matchedGroup);
            // Display the modal
            await displayOrderGroupsModal(false, true, matchedGroup);
            
            // Clear the search input to prevent re-opening the modal
            if (searchInput) {
                searchInput.value = '';
            }

            // Re-apply filters to reset the underlying list while the modal is open
            applyFiltersAndRender();

            return; // Stop further execution for this call
        } else {
            console.log('[Search Debug] No matching group found for the search term.');
        }
    }

    const ordersList = document.getElementById('orders-list');
    if (!ordersList) {
        console.error('Orders list element not found');
        return;
    }

    // Fade out the list before updating
    ordersList.classList.add('fade-out');

    // Use a short timeout to allow the fade-out transition to start
    setTimeout(() => {
        // The actual filtering happens inside displayOrdersWithSections, which is called by this.
        displayOrdersWithSections(ordersByStatusCache, ordersList);

        // Fade the list back in
        ordersList.classList.remove('fade-out');
    }, 300); // This should match the transition duration in the CSS
}

/**
 * Initialize order filter controls
 */
function initializeOrderFilters() {
    // Add event listener to ward filter select
    const wardFilterSelect = document.getElementById('filter-ward');
    if (wardFilterSelect) {
        wardFilter = wardFilterSelect;
        wardFilter.addEventListener('change', () => {
            console.log('Ward filter changed:', wardFilter.value);
            applyFiltersAndRender();
        });
    }
    
    // Initialize search functionality
    const searchInput = document.getElementById('search-orders');
    if (searchInput) {
        let debounceTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                applyFiltersAndRender();
            }, 300); // Debounce to prevent too many requests
        });
        
        // Clear search button
        const clearSearchBtn = document.getElementById('clear-search-btn');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                applyFiltersAndRender();
            });
        }
    }
    
    // Initialize refresh button if present
    const refreshBtn = document.getElementById('refresh-orders-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            // Refresh button re-fetches data from the server
            loadOrders();
        });
    }
}

/**
 * Load ward options from backend
 */
function loadWardOptions() {
    const wardSelect = document.getElementById('filter-ward');
    if (!wardSelect) return;
    
    // Keep the 'All' option
    const allOption = wardSelect.options[0];
    wardSelect.innerHTML = '';
    wardSelect.appendChild(allOption);
    
    // Fetch wards from API using apiClient
    window.apiClient.get('/wards')
        .then(data => {
            if (data.success && data.wards) {
                data.wards.forEach(ward => {
                    const option = document.createElement('option');
                    option.value = ward.id;
                    option.textContent = ward.name;
                    wardSelect.appendChild(option);
                });
            }
        })
        .catch(error => {
            console.error('Error loading wards:', error);
        });
}

/**
 * Get current filter values
 * @returns {Object} - Filter values
 */
/**
 * Show a notification message to the user
 * @param {string} message - Message to display
 * @param {string} type - Type of message (success, error, warning, info)
 */
function showNotification(message, type) {
    console.log(`[Notification - ${type}]: ${message}`);
    
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
        
        // Add CSS for notifications if not already added
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    width: 300px;
                }
                .notification {
                    margin-bottom: 10px;
                    padding: 15px;
                    border-radius: 4px;
                    color: white;
                    opacity: 0.9;
                    transition: opacity 0.3s ease;
                }
                .notification-success {
                    background-color: #28a745;
                }
                .notification-error {
                    background-color: #dc3545;
                }
                .notification-warning {
                    background-color: #ffc107;
                    color: #212529;
                }
                .notification-info {
                    background-color: #17a2b8;
                }
                .notification-hiding {
                    opacity: 0;
                }
                .medications-list-scrollable {
                    max-height: 300px;
                    overflow-y: auto;
                    border: 1px solid #eee;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add notification to container
    notificationContainer.appendChild(notification);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
        notification.classList.add('notification-hiding');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300); // Allow time for fade-out animation
    }, 5000);
}

function getFilters() {
    const filters = {};
    
    // Get filter values from form inputs
    const urgencyFilter = document.getElementById('filter-urgency')?.value || 'all';
    const typeFilter = document.getElementById('filter-type')?.value || 'all';
    const wardIdFilter = document.getElementById('filter-ward')?.value || 'all';
    const searchText = document.getElementById('search-orders')?.value || '';
    
    // Only add filters if they are not 'all' or empty
    if (urgencyFilter !== 'all') filters.urgency = urgencyFilter;
    if (typeFilter !== 'all') filters.type = typeFilter;
    if (wardIdFilter !== 'all' && wardIdFilter !== '') {
        // Convert to number if it's a numeric ID
        const wardIdNumber = parseInt(wardIdFilter, 10);
        filters.wardId = !isNaN(wardIdNumber) ? wardIdNumber : wardIdFilter;
    }
    if (searchText.trim() !== '') {
        filters.searchText = searchText.trim();
    }
    
    return filters;
}

/**
 * Load orders with current filter parameters
 */
function loadOrders() {
    // Get orders list element
    const ordersList = document.getElementById('orders-list');
    if (!ordersList) {
        console.error('Orders list element not found');
        return;
    }
    
    // Show loading indicator
    loading = true;
    ordersList.innerHTML = '<div class="loading-indicator">Loading orders...</div>';
    
    // Get filter parameters
    const filters = getFilters();
    console.log('Loading orders with filters:', filters);
    
    // We'll fetch both in-progress and pending orders
    loadBothOrderTypes(ordersList, filters);
}

/**
 * Filter orders by search text
 * @param {Array} orders - List of orders to filter
 * @param {string} searchText - Text to search for
 * @returns {Array} - Filtered orders
 */
function applySearchFilter(orders, searchText) {
    if (!searchText || searchText.trim() === '') {
        return orders; // Return all orders if no search text
    }
    
    // Split search into terms and filter out empty strings
    const searchTerms = searchText.toLowerCase().split(' ').filter(term => term.length > 0);
    
    if (searchTerms.length === 0) {
        return orders;
    }
    
    return orders.filter(order => {
        // Create a single string of all searchable content for the order
        let searchableContent = '';
        if (order.type === 'patient' && order.patient) {
            searchableContent += `${order.patient.name || ''} ${order.patient.hospitalId || ''} ${order.patient.nhs || ''}`;
        }
        searchableContent += ` ${order.wardName || ''}`;
        searchableContent += ` ${order.requesterName || ''}`;
        if (order.medications && order.medications.length > 0) {
            order.medications.forEach(med => {
                searchableContent += ` ${med.name || ''} ${med.form || ''} ${med.strength || ''} ${med.dose || ''} ${med.notes || ''}`;
            });
        }
        searchableContent += ` ${order.id || ''}`;
        searchableContent += ` ${order.notes || ''}`;

        searchableContent = searchableContent.toLowerCase();

        // Check if ALL search terms are present in the searchable content
        return searchTerms.every(term => searchableContent.includes(term));
    });
}

/**
 * Load both in-progress and pending orders
 * @param {HTMLElement} container - Container to display orders in
 * @param {Object} filters - Filter parameters
 */
function loadBothOrderTypes(container, filters) {
    // First, check if we can use OrderManager which handles both order types efficiently
    if (window.OrderManager && typeof window.OrderManager.getOrdersByStatus === 'function') {
        console.log('Using OrderManager to get orders by status');
        
        // Apply ward filter if needed
        if (wardFilter && wardFilter !== 'all') {
            try {
                const wardId = parseInt(wardFilter, 10);
                if (!isNaN(wardId)) filters.wardId = wardId;
                console.log('Applied ward filter:', wardId);
            } catch (e) {
                console.error('Error parsing ward ID:', e);
            }
        }
        
        try {
            // Get both in-progress and pending orders
            const inProgressOrders = window.OrderManager.getOrdersByStatus('in-progress', filters);
            const pendingOrders = window.OrderManager.getOrdersByStatus('pending', filters);
            
            console.log('In-progress orders count:', inProgressOrders.length);
            console.log('Pending orders count:', pendingOrders.length);
            
            displayOrdersWithSections({
                inProgress: inProgressOrders, 
                pending: pendingOrders
            }, container);
            return; // Exit early if we got orders from OrderManager
        } catch (error) {
            console.error('Error fetching from OrderManager:', error);
        }
    }
    
    // If OrderManager didn't work, fall back to API
    // We'll need to make two separate requests
    const statuses = ['in-progress', 'pending', 'unfulfilled', 'completed', 'cancelled'];
    const fetchPromises = statuses.map(st => fetchOrdersByStatus(st, filters));
    Promise.all(fetchPromises)
        .then(([inProgressOrders, pendingOrders, unfulfilledOrders, completedOrders, cancelledOrders]) => {
            // Store the fetched orders in the cache
            ordersByStatusCache = {
                inProgress: inProgressOrders,
                pending: pendingOrders,
                unfulfilled: unfulfilledOrders,
                completed: completedOrders,
                cancelled: cancelledOrders
            };

            // Render the initial view from the cache
            applyFiltersAndRender();
        })
    .catch(error => {
        console.error('Error fetching orders:', error);
        container.innerHTML = '<p class="empty-state">Error loading orders</p>';
    });
}

/**
 * Fetch orders by status using API
 * @param {string} status - Order status to fetch ('pending' or 'in-progress')
 * @param {Object} filters - Filter parameters
 * @returns {Promise<Array>} - Promise resolving to array of orders
 */
function fetchOrdersByStatus(status, filters) {
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    // Get the ward filter value properly
    const wardFilterValue = document.getElementById('filter-ward')?.value || 'all';
    if (wardFilterValue && wardFilterValue !== 'all') {
        queryParams.append('wardId', wardFilterValue);
    }
    
    queryParams.append('status', status);
    
    // Log API call for debugging
    const apiUrl = `/orders?${queryParams.toString()}`;
    console.log(`Fetching ${status} orders with URL:`, apiUrl);
    
    // Check if apiClient is available
    if (window.apiClient && typeof window.apiClient.get === 'function') {
        // Fetch orders from API using apiClient
        return window.apiClient.get(apiUrl)
            .then(data => {
                console.log(`API response for ${status} orders:`, data);
                if (data.success && data.orders) {
                    console.log(`${status} orders count:`, data.orders.length);
                    if (data.orders.length > 0) {
                        console.log(`First ${status} order:`, data.orders[0]);
                    }
                    
                    // Filter the orders client-side as well to ensure filtering works
                    let filteredOrders = data.orders;
                    if (wardFilterValue && wardFilterValue !== 'all') {
                        // Convert wardFilter to number for comparison with numeric wardId
                        const wardFilterNumber = parseInt(wardFilterValue, 10);
                        
                        filteredOrders = data.orders.filter(order => {
                            return order.wardId === wardFilterNumber;
                        });
                    }
                    
                    return filteredOrders;
                }
                return [];
            })
            .catch(error => {
                console.error(`Error fetching ${status} orders:`, error);
                return [];
            });
    } else {
        console.error('API client not available');
        return Promise.resolve([]);
    }
}

/**
 * Display orders separated by status sections
 * @param {Object} ordersByStatus - Object containing in-progress and pending orders
 * @param {HTMLElement} container - Container element
 */
function displayOrdersWithSections(ordersByStatus, container) {
    // Clear container
    container.innerHTML = '';
    
    // Get filters including search text if any
    const filters = getFilters();
    const searchText = filters.searchText || '';
    
    // Get orders by status and apply search filter if needed
    let { inProgress=[], pending=[], unfulfilled=[], completed=[], cancelled=[] } = ordersByStatus;
    
    // Only apply search filter if there's search text
    if (searchText) {
        inProgress = applySearchFilter(inProgress, searchText);
        pending = applySearchFilter(pending, searchText);
        unfulfilled = applySearchFilter(unfulfilled, searchText);
        completed = applySearchFilter(completed, searchText);
        cancelled = applySearchFilter(cancelled, searchText);
    }
    
    const hasInProgress = inProgress.length > 0;
    const hasPending = pending.length > 0;
    const hasUnfulfilled = unfulfilled.length > 0;
    const hasCompleted = completed.length > 0;
    const hasCancelled = cancelled.length > 0;
    
    // If there are no orders of any type, show empty state
    if (!hasInProgress && !hasPending && !hasUnfulfilled && !hasCompleted && !hasCancelled) {
        container.innerHTML = '<p class="empty-state">No orders found</p>';
        return;
    }
    
    // First create the Incoming Orders (pending) section
    if (hasPending) {
        const pendingSection = document.createElement('div');
        pendingSection.className = 'orders-section pending-section';
        pendingSection.innerHTML = `<h2>Incoming Orders</h2>`;
        container.appendChild(pendingSection);
        
        // Create container for pending orders
        const pendingContainer = document.createElement('div');
        pendingContainer.className = 'orders-container';
        pendingSection.appendChild(pendingContainer);
        
        // Display pending orders with selection enabled
        displayOrders(pending, pendingContainer, true); // true = allow selection of pending orders
    }
    
    // Then create the Orders in Progress section if there are any
    if (hasInProgress) {
        const inProgressSection = document.createElement('div');
        inProgressSection.className = 'orders-section in-progress-section';
        inProgressSection.innerHTML = `<h2>Orders In Progress</h2>`;
        container.appendChild(inProgressSection);
        
        // Create container for in-progress orders
        const inProgressContainer = document.createElement('div');
        inProgressContainer.className = 'orders-container';
        inProgressSection.appendChild(inProgressContainer);
        
        // Display in-progress orders
        displayOrders(inProgress, inProgressContainer, false); // false = don't allow selection of in-progress orders
    }

    // Additional sections: Unfulfilled, Completed, Cancelled
    const extraSections = [
        { data: unfulfilled, title: 'Unfulfilled Orders', selectable: false },
        { data: completed, title: 'Completed Orders', selectable: false },
        { data: cancelled, title: 'Cancelled Orders', selectable: false }
    ];

    extraSections.forEach(sec => {
        if (sec.data && sec.data.length > 0) {
            const section = document.createElement('div');
            section.className = 'orders-section';
            section.innerHTML = `<h2>${sec.title}</h2>`;
            container.appendChild(section);
            const inner = document.createElement('div');
            inner.className = 'orders-container';
            section.appendChild(inner);
            displayOrders(sec.data, inner, sec.selectable);
        }
    });
}

/**
 * Display orders in the table
 * @param {Array} orders - Array of order objects
 * @param {HTMLElement} container - Container element
 * @param {boolean} allowSelection - Whether to show selection checkboxes
 */
function displayOrders(orders, container, allowSelection = true) {
    // Sort and group orders
    // Group orders by their groupId if present
    const orderGroups = {};
    const ungroupedOrders = [];
    
    if (orders && orders.length > 0) {
        orders.forEach(order => {
            if (order.groupId) {
                if (!orderGroups[order.groupId]) {
                    orderGroups[order.groupId] = {
                        id: order.groupId,
                        name: order.groupName || `Group ${order.groupId}`,
                        notes: order.groupNotes || '',
                        orders: []
                    };
                }
                orderGroups[order.groupId].orders.push(order);
            } else {
                ungroupedOrders.push(order);
            }
        });
    }
    
    // If container was just passed from displayOrdersWithSections, it should already be empty
    // but just to be safe, clear it
    container.innerHTML = '';
    
    if ((!orders || orders.length === 0) && Object.keys(orderGroups).length === 0) {
        container.innerHTML = '<p class="empty-state">No orders found</p>';
        return;
    }
    // Already cleared container and checked for empty state above
    
    // Only add selection container if selection is allowed (e.g., for pending orders)
    if (allowSelection) {
        const selectionContainer = document.createElement('div');
        selectionContainer.className = 'selection-status';
        selectionContainer.innerHTML = `
            <div id="select-all-container" class="hidden"><span id="selected-count">0 orders selected</span></div>
        `;
        container.appendChild(selectionContainer);
    }
    
    // Note: The Create Group and Confirm Group buttons are now in the Supply Functions section
    // and not in the orders table area. The event handlers are set up elsewhere.
    
    // Create a table for orders
    const createOrdersTable = (withSelection = false) => {
        const tableContainer = document.createElement('div');
        tableContainer.innerHTML = `
            <table class="orders-table">
                <thead>
                    <tr>
                        ${withSelection ? '<th class="order-select-cell"><input type="checkbox" class="select-all-orders-checkbox" aria-label="Select all orders in group"></th>' : ''}
                        
                        <th>Patient</th>
                        <th>Ward</th>
                        <th>Medication Details</th>
                        <th>Status</th>
                        <th>Requester</th>
                    </tr>
                </thead>
                <tbody class="orders-table-body"></tbody>
            </table>
        `;
        return tableContainer;
    };

    // If we have grouped orders, display each group with its own header
    if (Object.keys(orderGroups).length > 0) {
        Object.values(orderGroups).forEach(group => {
            // Create group header
            const groupHeader = document.createElement('div');
            groupHeader.className = 'order-group-header';
            groupHeader.innerHTML = `
                <div class="order-group-info">
                    <h3>${group.name}</h3>
                    ${group.notes ? `<p>${group.notes}</p>` : ''}
                    <span>${group.orders.length} ${group.orders.length === 1 ? 'order' : 'orders'}</span>
                </div>
            `;
            container.appendChild(groupHeader);
            
            // Create orders table for this group - enable selection only if allowSelection is true
            const groupTableContainer = createOrdersTable(allowSelection && groupSelectionMode);
            container.appendChild(groupTableContainer);
            
            // Get the table body for this group
            const tableBody = groupTableContainer.querySelector('.orders-table-body');
            
            // Setup the select-all checkbox handler for this group - only if selection is allowed
            if (allowSelection) {
                const groupSelectAllCheckbox = groupTableContainer.querySelector('.select-all-orders-checkbox');
                if (groupSelectAllCheckbox) {
                    groupSelectAllCheckbox.addEventListener('change', (event) => {
                        const isChecked = event.target.checked;
                        const checkboxes = groupTableContainer.querySelectorAll('.order-select-checkbox');
                        checkboxes.forEach(checkbox => {
                            checkbox.checked = isChecked;
                        });
                        updateSelectedOrdersCount();
                    });
                }
            }
            
            // Create rows for each order in this group
            group.orders.forEach(order => {
                createOrderTableRow(order, tableBody, allowSelection);
            });

            // Select-all checkbox listener in selection mode - only if selection is allowed
            if (allowSelection && groupSelectionMode) {
                const headerSelectAll = groupTableContainer.querySelector('.select-all-orders-checkbox');
                if (headerSelectAll) {
                    headerSelectAll.addEventListener('change', event => {
                        const isChecked = event.target.checked;
                        const checkboxes = groupTableContainer.querySelectorAll('.order-select-checkbox:not([disabled])');
                        checkboxes.forEach(checkbox => {
                            checkbox.checked = isChecked;
                        });
                        updateSelectedOrdersCount();
                    });
                }
            }
            
            // Add select-all event handler for this group's table
            const selectAllCheckbox = groupTableContainer.querySelector('input[type="checkbox"]');
            if (selectAllCheckbox) {
                selectAllCheckbox.addEventListener('change', toggleSelectAllOrders);
            }
        });
    }
    
    // If we have ungrouped orders, show them in a separate section
    if (ungroupedOrders.length > 0) {
        // Add header for ungrouped orders (only if we also have grouped orders)
        if (Object.keys(orderGroups).length > 0) {
            const ungroupedHeader = document.createElement('div');
            ungroupedHeader.className = 'order-group-header';
            ungroupedHeader.innerHTML = `
                <div class="order-group-info">
                    <h3>Ungrouped Orders</h3>
                    <span>${ungroupedOrders.length} ${ungroupedOrders.length === 1 ? 'order' : 'orders'}</span>
                </div>
            `;
            container.appendChild(ungroupedHeader);
        }
        
        // Create table for ungrouped orders - only enable selection if allowSelection is true
        const ungroupedTableContainer = createOrdersTable(allowSelection && groupSelectionMode);
        container.appendChild(ungroupedTableContainer);
        
        // Get table body
        const tableBody = ungroupedTableContainer.querySelector('.orders-table-body');
        
        // Select-all checkbox for ungrouped orders - only if selection is allowed
        if (allowSelection) {
            const ungroupedSelectAllCheckbox = ungroupedTableContainer.querySelector('.select-all-orders-checkbox');
            if (ungroupedSelectAllCheckbox) {
                ungroupedSelectAllCheckbox.addEventListener('change', (event) => {
                    const isChecked = event.target.checked;
                    const checkboxes = ungroupedTableContainer.querySelectorAll('.order-select-checkbox');
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = isChecked;
                    });
                    updateSelectedOrdersCount();
                });
            }
        }
        
        // Create rows for ungrouped orders - pass allowSelection parameter
        ungroupedOrders.forEach(order => {
            createOrderTableRow(order, tableBody, allowSelection);
        });
    }
}

/**
 * Create a table row for an order
 * @param {Object} order - Order object
 * @param {HTMLElement} tableBody - Table body element to append row to
 * @param {boolean} allowSelection - Whether to allow selection of this order
 */
function createOrderTableRow(order, tableBody, allowSelection = true) {
    const row = document.createElement('tr');
    row.className = 'order-row';
    row.dataset.orderId = order.id;
    
    // Add selection checkbox if in group selection mode and selection is allowed
    if (groupSelectionMode && allowSelection) {
        const selectCell = document.createElement('td');
        selectCell.className = 'order-select-cell';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'order-select-checkbox';
        checkbox.addEventListener('change', updateSelectedOrdersCount);
        
        selectCell.appendChild(checkbox);
        row.appendChild(selectCell);
    } else if (groupSelectionMode && !allowSelection) {
        // Add empty cell to maintain table structure when selection is not allowed
        const placeholderCell = document.createElement('td');
        placeholderCell.className = 'order-select-cell';
        row.appendChild(placeholderCell);
    }
    
    // Format date and time
    const orderDate = new Date(order.timestamp);
    const formattedDate = orderDate.toLocaleDateString() + ' ' + orderDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Format patient info
    let patientInfo = '';
    if (order.type === 'patient' && order.patient) {
        const patientDetails = [];
        if (order.patient.name && order.patient.name !== 'undefined') {
            patientDetails.push(order.patient.name);
        }
        
        // Add identifiers if available
        const identifier = order.patient.hospitalId || order.patient.nhs || '';
        if (identifier) patientDetails.push(`(${identifier})`);
        
        patientInfo = patientDetails.join(' ');
    } else {
        patientInfo = '<span class="ward-stock-label">Ward Stock</span>';
    }
    
    // Format medications list
    const medicationsList = order.medications ? order.medications.map(med => {
        const details = [];
        if (med.name) details.push(med.name);
        if (med.strength) details.push(med.strength);
        if (med.form) details.push(med.form);
        if (med.dose) details.push(med.dose);
        if (med.quantity) details.push(`× ${med.quantity}`);
        return details.join(' ');
    }).join('<br>') : 'No medications';
    
    // Format requester info
    const requesterInfo = order.requesterName || 'Unknown';
    
    // Add status with formatting
    let statusContent = `<span class="order-status status-${order.status}">${formatStatusDisplay(order.status)}</span>`;

    // Patient info cell
    const patientCell = document.createElement('td');
    patientCell.className = 'patient-info';
    patientCell.innerHTML = patientInfo;
    row.appendChild(patientCell);
    
    // Ward info cell
    const wardCell = document.createElement('td');
    wardCell.className = 'ward-info';
    wardCell.textContent = order.wardName || order.wardId;
    row.appendChild(wardCell);
    
    // Medications info cell
    const medsCell = document.createElement('td');
    medsCell.className = 'medications-info';
    medsCell.innerHTML = medicationsList;

    if (order.isDuplicate && order.status === 'pending') {
        const duplicateTag = document.createElement('span');
        duplicateTag.className = 'duplicate-order-tag';
        duplicateTag.textContent = 'RECENT DUPLICATE - PLEASE CHECK IF STILL REQUIRED';
        medsCell.appendChild(document.createElement('br'));
        medsCell.appendChild(duplicateTag);
    }
    row.appendChild(medsCell);
    
    // Status cell with timestamp
    const statusCell = document.createElement('td');
    statusCell.className = 'status-cell';
    statusCell.innerHTML = `
        <div><span class="order-status status-${order.status}">${formatStatusDisplay(order.status)}</span></div>
        <div class="timestamp">${getStatusChangeTimestamp(order)}</div>
    `;
    row.appendChild(statusCell);
    
    // Requester info cell
    const requesterCell = document.createElement('td');
    requesterCell.className = 'requester-info';
    requesterCell.innerHTML = `
        <div>${requesterInfo}</div>
        <div class="timestamp">${formattedDate}</div>
    `;
    row.appendChild(requesterCell);
    
    // Make the entire row clickable except for the checkbox
    row.style.cursor = 'pointer';
    row.addEventListener('click', (event) => {
        // Only show order details if the click wasn't on the checkbox
        if (!event.target.closest('.order-select-cell')) {
            // Use the modal instead of the side panel
            showOrderDetails(order);
        }
    });
    
    tableBody.appendChild(row);
}

/**
 * Update dashboard statistics
 */
function updateStatistics() {
    if (OrderManager) {
        const stats = OrderManager.getOrderStatistics();
        
        // Update statistics display
        document.getElementById('pending-count').textContent = stats.pendingCount;
        document.getElementById('urgent-count').textContent = stats.urgentCount;
        document.getElementById('completed-count').textContent = stats.completedToday;
        
        // Format processing time in minutes
        const avgTime = stats.averageProcessingTime;
        document.getElementById('processing-time').textContent = avgTime ? `${avgTime}m` : '0m';
    }
}
function initializePanels() {
    // Close buttons
    document.getElementById('close-panel-btn')?.addEventListener('click', () => {
        closePanel('order-details-panel');
    });
    
    document.getElementById('close-processing-btn')?.addEventListener('click', () => {
        closePanel('processing-panel');
    });
    
    // Order details panel
    const orderDetailsPanel = document.getElementById('order-details-panel');
    const closeDetailsBtn = document.getElementById('close-details-btn');
    
    if (orderDetailsPanel && closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', () => {
            orderDetailsPanel.classList.add('hidden');
        });
    }
    
    // Order processing panel
    const orderProcessingPanel = document.getElementById('order-processing-panel');
    const closeProcessingBtn = document.getElementById('close-processing-btn');
    
    if (orderProcessingPanel && closeProcessingBtn) {
        closeProcessingBtn.addEventListener('click', () => {
            orderProcessingPanel.classList.add('hidden');
        });
    }
    
    // Process order button
    document.getElementById('process-order-btn')?.addEventListener('click', () => {
        const orderId = document.getElementById('order-details-panel').dataset.orderId;
        openProcessingPanel(orderId);
    });
    
    // Generate labels button
    document.getElementById('generate-labels-btn')?.addEventListener('click', () => {
        const orderId = document.getElementById('order-details-panel').dataset.orderId;
        if (orderId) {
            // Link to label generator with the order id as a parameter
            window.location.href = `/?order=${orderId}`;
        }
    });
    
    // Complete order button
    document.getElementById('complete-order-btn')?.addEventListener('click', () => {
        completeOrderProcessing();
    });
    
    // Save progress button
    document.getElementById('save-progress-btn')?.addEventListener('click', () => {
        saveProcessingProgress();
    });
    
    // Cancel process button
    document.getElementById('cancel-process-btn')?.addEventListener('click', () => {
        closePanel('processing-panel');
    });
    
    // Reject order button
    document.getElementById('reject-order-btn')?.addEventListener('click', () => {
        const orderId = document.getElementById('order-details-panel').dataset.orderId;
        rejectOrder(orderId);
    });
}

/**
 * Open order details panel
 * @param {string} orderId - Order ID
 */
function openOrderDetailsPanel(orderId) {
    if (!orderId) return;
    
    const panel = document.getElementById('order-details-panel');
    const content = document.getElementById('order-details-content');
    
    if (!panel || !content) return;
    
    // Set order ID for reference and show loading state
    panel.dataset.orderId = orderId;
    content.innerHTML = '<div class="loading-indicator">Loading order details...</div>';
    panel.classList.remove('hidden');
    
    // Fetch order details from API using apiClient
    window.apiClient.get(`/orders/${orderId}`)
        .then(data => {
            if (data.success && data.order) {
                displayOrderDetails(data.order, content);
                updateOrderActionButtons(data.order);
            } else {
                content.innerHTML = '<p class="empty-state">Error loading order details</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching order details:', error);
            content.innerHTML = '<p class="empty-state">Error loading order details</p>';
        });
}

/**
 * Display order details in the panel
 * @param {Object} order - Order data object
 * @param {HTMLElement} container - Container element
 */
function displayOrderDetails(order, container) {
    if (!container) return;
    
    // Format timestamp
    const orderDate = new Date(order.timestamp);
    const formattedDateTime = orderDate.toLocaleDateString('en-GB') + ' ' + 
                            orderDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    // Build patient info if patient order
    let patientInfo = '';
    if (order.type === 'patient' && order.patient) {
        const patient = order.patient;
        patientInfo = `
            <div class="details-section">
                <h3>Patient Information</h3>
                <p><strong>Name:</strong> ${patient.name || 'Not provided'}</p>
                ${patient.dob ? `<p><strong>DOB:</strong> ${new Date(patient.dob).toLocaleDateString('en-GB')}</p>` : ''}
                <p><strong>NHS Number:</strong> ${patient.nhsNumber || patient.nhs_number || 'Not provided'}</p>
                <p><strong>Hospital ID:</strong> ${patient.hospitalId || patient.hospital_id || 'Not provided'}</p>
                <p><strong>Location:</strong> ${patient.location || 'Not specified'}</p>
            </div>
        `;
    }
    
    // Build medications list
    let medicationsList = '';
    if (order.medications && Array.isArray(order.medications)) {
        order.medications.forEach((med, index) => {
            medicationsList += `
                <div class="medication-item">
                    <h4>${med.name}</h4>
                    <p>${med.strength || ''} ${med.form || ''}</p>
                    <p><strong>Quantity:</strong> ${med.quantity || 'Not specified'}</p>
                    ${med.notes ? `<p><strong>Notes:</strong> ${med.notes}</p>` : ''}
                </div>
            `;
        });
    }
    
    // Default values for required fields if they're missing
    const wardId = order.wardId || order.ward_id || 'Unknown';
    const urgency = order.urgency || 'routine';
    const status = order.status || 'pending';
    const medications = order.medications || [];
    
    // Update content
    container.innerHTML = `
        <div class="order-header-details">
            <h3>Order ${order.id} (${order.type === 'patient' ? 'Patient' : 'Ward Stock'})</h3>
            <p><strong>Time:</strong> ${formattedDateTime}</p>
            <p><strong>Ward:</strong> ${wardId}</p>
            <p><strong>Urgency:</strong> <span class="status-${urgency}">${urgency.toUpperCase()}</span></p>
            <p><strong>Status:</strong> <span class="status-${status}">${status.toUpperCase()}</span></p>
        </div>
        
        ${patientInfo}
        
        <div class="details-section">
            <h3>Medications (${medications.length})</h3>
            <div class="medications-list">
                ${medicationsList || '<p>No medications in order</p>'}
            </div>
        </div>
        
        <div class="details-section">
            <h3>Order Details</h3>
            <p><strong>Requested By:</strong> ${order.requesterName || 'Unknown'} 
               ${order.requesterRole ? `(${order.requesterRole})` : ''}</p>
            ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
        </div>
        
        ${order.status === 'completed' ? `
            <div class="details-section">
                <h3>Processing Details</h3>
                <p><strong>Completed:</strong> ${order.completedAt ? new Date(order.completedAt).toLocaleString('en-GB') : 'Date not recorded'}</p>
                <p><strong>Supplied By:</strong> ${order.processedBy || 'Not recorded'}</p>
                <p><strong>Checked By:</strong> ${order.checkedBy || 'Not recorded'}</p>
                ${order.processingTime ? `<p><strong>Processing Time:</strong> ${order.processingTime} minutes</p>` : ''}
                ${order.processingNotes ? `<p><strong>Notes:</strong> ${order.processingNotes}</p>` : ''}
            </div>
        ` : ''}
    `;
}

/**
 * Update order action button states based on order status
 * @param {Object} order - Order data
 */
function updateOrderActionButtons(order) {
    const processBtn = document.getElementById('process-order-btn');
    const labelsBtn = document.getElementById('generate-labels-btn');
    const rejectBtn = document.getElementById('reject-order-btn');
    
    if (processBtn && labelsBtn && rejectBtn) {
        if (order.status === 'completed' || order.status === 'cancelled') {
            processBtn.disabled = true;
            rejectBtn.disabled = true;
        } else {
            processBtn.disabled = false;
            rejectBtn.disabled = false;
        }
    }
}

/**
 * Close a panel
 * @param {string} panelId - Panel element ID
 */
function closePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.add('hidden');
        delete panel.dataset.orderId;
    }
}

/**
 * Open order processing panel
 * @param {string} orderId - Order ID
 */
function openProcessingPanel(orderId) {
    if (!orderId) return;
    
    const panel = document.getElementById('processing-panel');
    const header = document.getElementById('processing-header');
    const orderDetails = document.getElementById('processing-order-details');
    
    if (!panel || !header || !orderDetails) return;
    
    // Set order ID for reference and show loading state
    panel.dataset.orderId = orderId;
    orderDetails.innerHTML = '<div class="loading-indicator">Loading order details...</div>';
    panel.classList.remove('hidden');
    
    // Fetch order details from API using apiClient
    window.apiClient.get(`/orders/${orderId}`)
        .then(data => {
            if (data.success && data.order) {
                // Update header
                header.textContent = `Process Order: ${orderId}`;
                
                const order = data.order;
                
                // Update order details
                orderDetails.innerHTML = `
                    <div class="order-info-row">
                        <span class="label">Order Type:</span>
                        <span class="value">${order.type === 'patient' ? 'Patient' : 'Ward Stock'}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="label">Ward:</span>
                        <span class="value">${order.wardId || order.ward_id || 'Unknown'}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="label">Urgency:</span>
                        <span class="value status-${order.urgency || 'routine'}">${(order.urgency || 'routine').toUpperCase()}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="label">Medications:</span>
                        <span class="value">${order.medications ? order.medications.length : 0} items</span>
                    </div>
                `;
                
                // Reset form
                const form = document.getElementById('processing-form');
                if (form) form.reset();
            } else {
                orderDetails.innerHTML = '<p class="empty-state">Error loading order details</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching order details:', error);
            orderDetails.innerHTML = '<p class="empty-state">Error loading order details</p>';
        });
            
    // Hide details panel
    const orderDetailsPanel = document.getElementById('order-details-panel');
    if (orderDetailsPanel) {
        orderDetailsPanel.classList.add('hidden');
    }
}

/**
 * Complete order processing
 */
function completeOrderProcessing() {
    const processingPanel = document.getElementById('processing-panel');
    const orderId = processingPanel?.dataset.orderId;
    
    if (!orderId) return;
    
    // Get form values
    const suppliedBy = document.getElementById('supplied-by')?.value;
    const checkedBy = document.getElementById('checked-by')?.value;
    const notes = document.getElementById('supply-notes')?.value;
    
    // Validation
    if (!suppliedBy) {
        alert('Please enter who supplied this order');
        return;
    }
    
    // Show loading indicator
    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading-overlay';
    loadingEl.innerHTML = '<div class="loading-indicator">Processing order...</div>';
    
    if (processingPanel) {
        processingPanel.appendChild(loadingEl);
    }
    
    // Process order with API using apiClient
    window.apiClient.post(`/orders/${orderId}/complete`, {
        processedBy: suppliedBy,
        checkedBy: checkedBy,
        notes: notes
    })
    .then(data => {
        if (processingPanel && loadingEl) {
            processingPanel.removeChild(loadingEl);
        }
        
        if (data.success) {
            alert('Order processed successfully');
            if (processingPanel) {
                processingPanel.classList.add('hidden');
            }
            loadOrders(); // Refresh order list
        } else {
            alert('Failed to process order: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error processing order:', error);
        alert('Error processing order: ' + error.message);
        
        if (processingPanel && loadingEl) {
            processingPanel.removeChild(loadingEl);
        }
    });
}

/**
 * Save processing progress (not implemented)
 */
function saveProcessingProgress() {
    alert('This feature is not yet implemented');
}

/**
 * Reject an order
 * @param {string} orderId - Order ID
 */
async function rejectOrder(orderId) {
    console.log('Rejecting order:', orderId);
    
    try {
        // Ask for rejection reason
        const reason = prompt('Enter reason for rejecting order:', '');
        if (!reason) return; // Cancel if no reason provided
        
        // Show loading state
        document.getElementById('reject-order-btn').textContent = 'Rejecting...';
        document.getElementById('reject-order-btn').disabled = true;
        
        // Call API to reject order
        const response = await window.apiClient.post(`/orders/${orderId}/reject`, { reason });
        
        if (response && response.success) {
            console.log('Order rejected successfully');
            closeOrderDetailsPanel();
            loadOrders();
            alert('Order rejected successfully');
        } else {
            console.error('Failed to reject order:', response.error);
            alert(`Failed to reject order: ${response.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error rejecting order:', error);
        alert(`Error rejecting order: ${error.message}`);
    } finally {
        // Reset button
        document.getElementById('reject-order-btn').textContent = 'Reject';
        document.getElementById('reject-order-btn').disabled = false;
    }
}

/**
 * Cancel an order
 * @param {string} orderId - Order ID to cancel
 */
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
            if (typeof showToastNotification === 'function') {
                showToastNotification('Cancelling order...', 'info');
            }
            
            // Call API to cancel order with reason
            const response = await window.apiClient.cancelOrder(orderIdToCancel, reason);
            console.log('[CANCEL] API response:', response);
            
            if (response && response.success) {
                console.log('[CANCEL] Order cancelled successfully');
                if (typeof showToastNotification === 'function') {
                    showToastNotification('Order cancelled successfully', 'success');
                }
                
                // Close modal and refresh orders list
                console.log('[CANCEL] Closing modal and refreshing list');
                const orderModal = document.getElementById('order-detail-modal');
                if (orderModal) orderModal.style.display = 'none';
                
                // Force a refresh of the orders list after cancellation
                setTimeout(() => {
                    console.log('[CANCEL] Refreshing orders list');
                    loadOrders();
                }, 500);
            } else {
                console.error('[CANCEL] API returned error:', response);
                if (typeof showToastNotification === 'function') {
                    showToastNotification(`Error cancelling order: ${response?.message || 'Unknown error'}`, 'error');
                }
            }
        }
        // Fallback if API client is not available
        else {
            console.log('[CANCEL] API client not available, performing local-only cancellation');
            if (typeof showToastNotification === 'function') {
                showToastNotification('Order marked as cancelled locally. Sync required.', 'warning');
                showToastNotification('Order cancelled successfully', 'success');
            }
            
            const orderModal = document.getElementById('order-detail-modal');
            if (orderModal) orderModal.style.display = 'none';
            
            // Force a refresh of the orders list after cancellation
            setTimeout(() => {
                console.log('[CANCEL] Refreshing orders list');
                loadOrders();
            }, 500);
        }
    } catch (error) {
        console.error('[CANCEL] Error cancelling order:', error);
        if (typeof showToastNotification === 'function') {
            showToastNotification(`Error cancelling order: ${error.message || 'Unknown error'}`, 'error');
        }
    }
}

/**
 * Shows a cancellation confirmation modal
 * @param {string} orderId - Order ID to cancel
 * @returns {Promise} Promise that resolves with {cancelled: boolean, reason: string}
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

/**
 * View order history/audit trail
 * @param {string} orderId - Order ID
 */
async function viewOrderHistory(orderId) {
    console.log('[HISTORY] Viewing history for order:', orderId);
    
    if (!orderId) {
        console.error('[HISTORY] No order ID provided');
        return;
    }
    
    try {
        // Check if API client has the required method
        if (window.apiClient && typeof window.apiClient.getOrderHistory === 'function') {
            console.log('[HISTORY] Fetching order history from API');
            
            // Show loading state
            const historyBtn = document.getElementById('view-history-btn');
            if (historyBtn) {
                historyBtn.textContent = 'Loading...';
                historyBtn.disabled = true;
            }
            
            // Fetch order history
            const response = await window.apiClient.getOrderHistory(orderId);
            console.log('[HISTORY] History data:', response);
            
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
            
            // Reset button
            if (historyBtn) {
                historyBtn.textContent = 'View Audit Trail';
                historyBtn.disabled = false;
            }
        } else {
            console.error('[HISTORY] API client or getOrderHistory method not available');
            alert('Order history functionality not available');
        }
    } catch (error) {
        console.error('[HISTORY] Error viewing history:', error);
        showToastNotification('Error loading audit trail: ' + (error.message || 'Unknown error'), 'error');
        
        // Reset button
        const historyBtn = document.getElementById('view-history-btn');
        if (historyBtn) {
            historyBtn.textContent = 'View Audit Trail';
            historyBtn.disabled = false;
        }
    }
}

/**
 * Generates a readable diff between two objects
 * @param {Object} prevObj - Previous state object
 * @param {Object} newObj - New state object
 * @returns {string} - HTML string showing the differences
 */
function generateReadableDiff(prevObj, newObj) {
    // Initialize the HTML output
    let diffHTML = '<div class="changes-table">';
    
    // Track if we found any differences
    let hasDifferences = false;
    
    // Check for status changes specifically
    if (prevObj && newObj && prevObj.status && newObj.status && prevObj.status !== newObj.status) {
        hasDifferences = true;
        diffHTML += '<h5>Status Change</h5>';
        diffHTML += '<table class="table table-bordered table-sm">';
        diffHTML += '<thead><tr><th>Field</th><th>Previous Value</th><th>New Value</th></tr></thead><tbody>';
        diffHTML += `<tr>
            <td><strong>Status</strong></td>
            <td class="prev-value">${formatStatusDisplay(prevObj.status)}</td>
            <td class="new-value">${formatStatusDisplay(newObj.status)}</td>
        </tr>`;
        diffHTML += '</tbody></table>';
    }
    
    // Handle medication changes if present
    if (prevObj && newObj && 
        (prevObj.medications || newObj.medications) && 
        !(prevObj.status && newObj.status && prevObj.status !== newObj.status)) {
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
 * Format a status value for display
 * @param {string} status - Raw status value
 * @returns {string} - Formatted status for display
 */
function formatStatusDisplay(status) {
    if (!status) return 'Not Set';
    
    // Map of status values to user-friendly display text
    const statusDisplayMap = {
        'pending': 'Pending',
        'in-progress': 'In Progress',
        'processing': 'Processing',
        'unfulfilled': 'Unfulfilled',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    
    return statusDisplayMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

}

/**
 * Format a field name for display
 * @param {string} fieldName - Raw field name
 * @returns {string} - Formatted field name
 */
function formatFieldName(fieldName) {
    return fieldName
        .replace(/([A-Z])/g, ' $1') // Insert spaces before capital letters
        .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
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

/**
 * Create and show history modal
 * @param {string} orderId - Order ID
 * @param {Array} historyData - Array of history entries
 */
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
            .history-details-row td { display: none; }
            .history-details-row.active td { display: table-cell; }
            .highlight-animation { animation: highlight 1s ease-in-out; }
            @keyframes highlight { 
                0% { background-color: #fff9c4; } 
                100% { background-color: transparent; }
            }
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
                                if (prevObj && Object.keys(prevObj).length === 1 && prevObj.status) {
                                    previousData = formatStatusDisplay(prevObj.status);
                                } else {
                                    previousData = JSON.stringify(prevObj, null, 2);
                                }
                                console.log('[MODAL] Found previousData (camelCase):', prevObj);
                            } else if (entry.previous_data) {
                                prevObj = typeof entry.previous_data === 'string' ? 
                                    JSON.parse(entry.previous_data) : entry.previous_data;
                                if (prevObj && Object.keys(prevObj).length === 1 && prevObj.status) {
                                    previousData = formatStatusDisplay(prevObj.status);
                                } else {
                                    previousData = JSON.stringify(prevObj, null, 2);
                                }
                                console.log('[MODAL] Found previous_data (snake_case):', prevObj);
                            } else if (entry.previousState) {
                                prevObj = typeof entry.previousState === 'string' ? 
                                    JSON.parse(entry.previousState) : entry.previousState;
                                if (prevObj && Object.keys(prevObj).length === 1 && prevObj.status) {
                                    previousData = formatStatusDisplay(prevObj.status);
                                } else {
                                    previousData = JSON.stringify(prevObj, null, 2);
                                }
                                console.log('[MODAL] Found previousState:', prevObj);
                            }
                            
                            if (entry.newData) {
                                newObj = typeof entry.newData === 'string' ? 
                                    JSON.parse(entry.newData) : entry.newData;
                                if (newObj && Object.keys(newObj).length === 1 && newObj.status) {
                                    newData = formatStatusDisplay(newObj.status);
                                } else {
                                    newData = JSON.stringify(newObj, null, 2);
                                }
                                console.log('[MODAL] Found newData (camelCase):', newObj);
                            } else if (entry.new_data) {
                                newObj = typeof entry.new_data === 'string' ? 
                                    JSON.parse(entry.new_data) : entry.new_data;
                                if (newObj && Object.keys(newObj).length === 1 && newObj.status) {
                                    newData = formatStatusDisplay(newObj.status);
                                } else {
                                    newData = JSON.stringify(newObj, null, 2);
                                }
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
                                    `<button class="secondary-btn small-btn toggle-details-btn" data-entry-id="${entryId}">Show Details</button>` 
                                : 'No details available'}
                            </td>
                        </tr>
                        ${previousData || newData ? `
                        <tr class="history-details-row" id="${entryId}-details">
                            <td colspan="5">
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
    
    // Add modal content to overlay and overlay to document
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
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
                this.classList.remove('btn-outline-secondary');
                this.classList.add('btn-outline-info');
            } else {
                // Show it
                detailsRow.classList.add('active');
                this.textContent = 'Hide Details';
                this.classList.remove('btn-outline-info');
                this.classList.add('btn-outline-secondary');
                
                // Add animation when showing
                detailsRow.classList.add('highlight-animation');
                setTimeout(() => detailsRow.classList.remove('highlight-animation'), 1000);
            }
        });
    });
    
    // Make row headers also clickable to toggle details
    const mainRows = modalContent.querySelectorAll('.history-main-row');
    mainRows.forEach(row => {
        row.addEventListener('click', function(event) {
            // Don't trigger if they clicked directly on the button
            if (event.target.classList.contains('toggle-details-btn')) {
                return;
            }
            
            const entryId = this.getAttribute('data-entry-id');
            const toggleBtn = this.querySelector(`.toggle-details-btn[data-entry-id="${entryId}"]`);
            
            // Only toggle if there is a button (some rows may not have details)
            if (toggleBtn) {
                toggleBtn.click();
            }
        });
    });
    
    // Close when clicking outside
    modalOverlay.addEventListener('click', function(event) {
        if (event.target === modalOverlay) {
            document.body.removeChild(modalOverlay);
        }
    });
}

/**
 * Show order details in modal
 * @param {Object} order - Order object
 */
async function showOrderDetails(order) {
    console.log('[MODAL] showOrderDetails called with order:', order);
    
    if (!order) {
        console.error('[MODAL] No order provided to showOrderDetails');
        return;
    }
    
    // Store current order for actions
    window.currentOrder = order;
    console.log('[MODAL] Set currentOrder:', window.currentOrder);
    
    // Get modal elements
    const modal = document.getElementById('order-detail-modal');
    const content = document.getElementById('modal-order-content');
    
    if (!modal || !content) {
        console.error('[MODAL] Modal or content element not found');
        return;
    }
    
    // Populate modal content
    // Clear existing content
    while (content.firstChild) {
        content.removeChild(content.firstChild);
    }
    
    // Add new content as DOM element
    const detailsElement = createOrderDetailHTML(order);
    content.appendChild(detailsElement);
    console.log('[MODAL] Modal content populated');
    
    // Setup buttons based on order status
    setupModalButtons(order);
    
    // Show modal
    modal.style.display = 'block';
    modal.classList.remove('hidden');
    console.log('[MODAL] Modal shown');
    
    // Setup close handlers
    setupModalCloseHandlers();
}

/**
 * Create HTML content for order details modal
 * @param {Object} order - Order object to display
 * @returns {HTMLElement} - DOM element for modal content
 */
function createOrderDetailHTML(order) {
    console.log('[MODAL] createOrderDetailHTML called with order:', order);
    
    if (!order) {
        const errorElement = document.createElement('p');
        errorElement.textContent = 'No order data available';
        return errorElement;
    }
    
    // Debug the entire order structure
    console.log('[MODAL] Full order structure:', JSON.stringify(order, null, 2));
    
    // Format timestamp
    const timestamp = new Date(order.timestamp).toLocaleString();
    
    // Format patient info section
    // Will hold patient information element
    let patientInfoEl = null;
    
    // Create patient information section if order is for a patient
    if (order.patient && order.type === 'patient') {
        console.log('[MODAL] Processing patient order with patient object');
        console.log('[MODAL] Patient data structure:', JSON.stringify(order.patient));
        
        // Extract patient details with more comprehensive fallbacks
        const patientName = order.patient.name || 
                          (order.patient.firstName && order.patient.lastName ? 
                           `${order.patient.firstName} ${order.patient.lastName}` : 'Not provided');
                           
        // Access NHS number directly from the order object if not in patient object
        // This handles cases where the API returns flat structure
        const nhsNumber = order.patient.nhs_number || 
                          order.patient.nhsNumber || 
                          order.patient.nhs || 
                          order.patient.nhsId || 
                          order.patient.nhsID || 
                          order.patient.NHS || 
                          order.nhs_number || 
                          order.nhsNumber || 
                          order.nhs || 
                          'Not provided';
                          
        // Access hospital number directly from the order object if not in patient object
        // This handles cases where the API returns flat structure
        const hospitalNumber = order.patient.hospital_number || 
                             order.patient.hospitalNumber || 
                             order.patient.hospital_id || 
                             order.patient.hospitalId || 
                             order.patient.hospitalID || 
                             order.patient.hospital || 
                             order.hospitalNumber || 
                             order.hospital_number || 
                             order.hospital_id || 
                             order.hospitalId || 
                             order.hospital || 
                             'Not provided';
                             
        // Get ward name with fallbacks
        const wardName = order.wardName || 
                       order.ward_name || 
                       (order.ward ? (typeof order.ward === 'object' ? order.ward.name : order.ward) : 'Not provided');
        
        // Create patient info elements using DOM
        patientInfoEl = document.createElement('div');
        patientInfoEl.className = 'order-section';
        
        const heading = document.createElement('h4');
        heading.textContent = 'Patient Information';
        patientInfoEl.appendChild(heading);
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'patient-details';
        
        const namePara = document.createElement('p');
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = 'Name:';
        namePara.appendChild(nameStrong);
        namePara.appendChild(document.createTextNode(' ' + patientName));
        detailsDiv.appendChild(namePara);
        
        const nhsPara = document.createElement('p');
        const nhsStrong = document.createElement('strong');
        nhsStrong.textContent = 'NHS Number:';
        nhsPara.appendChild(nhsStrong);
        nhsPara.appendChild(document.createTextNode(' ' + nhsNumber));
        detailsDiv.appendChild(nhsPara);
        
        const hospPara = document.createElement('p');
        const hospStrong = document.createElement('strong');
        hospStrong.textContent = 'Hospital Number:';
        hospPara.appendChild(hospStrong);
        hospPara.appendChild(document.createTextNode(' ' + hospitalNumber));
        detailsDiv.appendChild(hospPara);
        
        const wardPara = document.createElement('p');
        const wardStrong = document.createElement('strong');
        wardStrong.textContent = 'Ward:';
        wardPara.appendChild(wardStrong);
        wardPara.appendChild(document.createTextNode(' ' + wardName));
        detailsDiv.appendChild(wardPara);
        
        patientInfoEl.appendChild(detailsDiv);
    } else if (order.type === 'patient') {
        // If patient order type but no patient object, try alternative data paths
        console.log('[MODAL] No patient object, looking for alternative data paths');
        
        // For backward compatibility with older order formats
        const patientName = order.patientName || 'Not provided';
        const nhsNumber = order.nhsNumber || order.nhsId || order.nhs || order.nhs_number || 'Not provided';
        const hospitalNumber = order.hospitalNumber || order.hospitalId || order.hospital_number || order.hospital_id || 'Not provided';
        const wardName = order.wardName || 'Not provided';
        
        // Create patient info elements using DOM
        patientInfoEl = document.createElement('div');
        patientInfoEl.className = 'order-section';
        
        const heading = document.createElement('h4');
        heading.textContent = 'Patient Information';
        patientInfoEl.appendChild(heading);
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'patient-details';
        
        const namePara = document.createElement('p');
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = 'Name:';
        namePara.appendChild(nameStrong);
        namePara.appendChild(document.createTextNode(' ' + patientName));
        detailsDiv.appendChild(namePara);
        
        const nhsPara = document.createElement('p');
        const nhsStrong = document.createElement('strong');
        nhsStrong.textContent = 'NHS Number:';
        nhsPara.appendChild(nhsStrong);
        nhsPara.appendChild(document.createTextNode(' ' + nhsNumber));
        detailsDiv.appendChild(nhsPara);
        
        const hospPara = document.createElement('p');
        const hospStrong = document.createElement('strong');
        hospStrong.textContent = 'Hospital Number:';
        hospPara.appendChild(hospStrong);
        hospPara.appendChild(document.createTextNode(' ' + hospitalNumber));
        detailsDiv.appendChild(hospPara);
        
        const wardPara = document.createElement('p');
        const wardStrong = document.createElement('strong');
        wardStrong.textContent = 'Ward:';
        wardPara.appendChild(wardStrong);
        wardPara.appendChild(document.createTextNode(' ' + wardName));
        detailsDiv.appendChild(wardPara);
        
        patientInfoEl.appendChild(detailsDiv);
    }
    
    // Create medications section
    let medicationsEl = null;
    if (order.medications && order.medications.length > 0) {
        console.log('[MODAL] Medications data structure:', JSON.stringify(order.medications));
        // Create medications container
        medicationsEl = document.createElement('div');
        medicationsEl.className = 'order-section';
        
        const heading = document.createElement('h4');
        heading.textContent = 'Medications';
        medicationsEl.appendChild(heading);
        
        const medList = document.createElement('div');
        medList.className = 'medications-list';
        
        // Add each medication
        order.medications.forEach(med => {
            const medItem = document.createElement('div');
            medItem.className = 'medication-item';
            
            // Medication name
            const namePara = document.createElement('p');
            const nameStrong = document.createElement('strong');
            nameStrong.textContent = 'Name:';
            namePara.appendChild(nameStrong);
            namePara.appendChild(document.createTextNode(' ' + (
                med.name || 
                med.medication || 
                med.drug || 
                med.drugName || 
                med.med_name || 
                'Not specified'
            )));
            medItem.appendChild(namePara);
            
            // Strength
            const strengthPara = document.createElement('p');
            const strengthStrong = document.createElement('strong');
            strengthStrong.textContent = 'Strength:';
            strengthPara.appendChild(strengthStrong);
            strengthPara.appendChild(document.createTextNode(' ' + (
                med.strength || 
                med.doseStrength || 
                med.drugStrength || 
                'Not specified'
            )));
            medItem.appendChild(strengthPara);
            
            // Form
            const formPara = document.createElement('p');
            const formStrong = document.createElement('strong');
            formStrong.textContent = 'Form:';
            formPara.appendChild(formStrong);
            formPara.appendChild(document.createTextNode(' ' + (
                med.form || 
                med.formulation || 
                med.drugForm || 
                med.medicationForm || 
                'Not specified'
            )));
            medItem.appendChild(formPara);
            
            // Quantity
            const qtyPara = document.createElement('p');
            const qtyStrong = document.createElement('strong');
            qtyStrong.textContent = 'Quantity:';
            qtyPara.appendChild(qtyStrong);
            qtyPara.appendChild(document.createTextNode(' ' + (
                med.quantity || 
                med.qty || 
                med.amount || 
                'Not specified'
            )));
            medItem.appendChild(qtyPara);
            
            // Dose
            const dosePara = document.createElement('p');
            const doseStrong = document.createElement('strong');
            doseStrong.textContent = 'Dose:';
            dosePara.appendChild(doseStrong);
            dosePara.appendChild(document.createTextNode(' ' + (
                med.dose || 
                med.dosage || 
                med.doseAmount || 
                med.doseInstructions || 
                'N/A'
            )));
            medItem.appendChild(dosePara);
            
            if (med.frequency) {
                const freqPara = document.createElement('p');
                const freqStrong = document.createElement('strong');
                freqStrong.textContent = 'Frequency:';
                freqPara.appendChild(freqStrong);
                freqPara.appendChild(document.createTextNode(' ' + med.frequency));
                medItem.appendChild(freqPara);
            }
            
            // Quantity is already displayed above, no need to display it again
            
            if (med.notes) {
                const notesPara = document.createElement('p');
                const notesStrong = document.createElement('strong');
                notesStrong.textContent = 'Notes:';
                notesPara.appendChild(notesStrong);
                notesPara.appendChild(document.createTextNode(' ' + med.notes));
                medItem.appendChild(notesPara);
            }
            
            medList.appendChild(medItem);
        });
        
        medicationsEl.appendChild(medList);
    }
    
    // Create order info section
    const orderInfoEl = document.createElement('div');
    orderInfoEl.className = 'order-section';
    
    const infoHeading = document.createElement('h4');
    infoHeading.textContent = 'Order Information';
    orderInfoEl.appendChild(infoHeading);
    
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'order-details';
    
    // Order ID
    const idPara = document.createElement('p');
    const idStrong = document.createElement('strong');
    idStrong.textContent = 'Order ID:';
    idPara.appendChild(idStrong);
    idPara.appendChild(document.createTextNode(' ' + order.id));
    detailsDiv.appendChild(idPara);
    
    // Type
    const typePara = document.createElement('p');
    const typeStrong = document.createElement('strong');
    typeStrong.textContent = 'Type:';
    typePara.appendChild(typeStrong);
    typePara.appendChild(document.createTextNode(' ' + (order.type || 'N/A')));
    detailsDiv.appendChild(typePara);
    
    // Status
    const statusPara = document.createElement('p');
    const statusStrong = document.createElement('strong');
    statusStrong.textContent = 'Status:';
    statusPara.appendChild(statusStrong);
    statusPara.appendChild(document.createTextNode(' '));
    
    const statusBadge = document.createElement('span');
    statusBadge.className = 'status-badge status-' + (order.status || 'pending');
    statusBadge.textContent = order.status || 'pending';
    statusPara.appendChild(statusBadge);
    
    detailsDiv.appendChild(statusPara);
    
    // Created
    const createdPara = document.createElement('p');
    const createdStrong = document.createElement('strong');
    createdStrong.textContent = 'Created:';
    createdPara.appendChild(createdStrong);
    createdPara.appendChild(document.createTextNode(' ' + timestamp));
    detailsDiv.appendChild(createdPara);
    
    // Requester
    const requesterPara = document.createElement('p');
    const requesterStrong = document.createElement('strong');
    requesterStrong.textContent = 'Requester:';
    requesterPara.appendChild(requesterStrong);
    requesterPara.appendChild(document.createTextNode(' ' + (order.requesterName || 'Unknown')));
    detailsDiv.appendChild(requesterPara);
    
    // Notes (if available)
    if (order.notes) {
        const notesPara = document.createElement('p');
        const notesStrong = document.createElement('strong');
        notesStrong.textContent = 'Notes:';
        notesPara.appendChild(notesStrong);
        notesPara.appendChild(document.createTextNode(' ' + order.notes));
        detailsDiv.appendChild(notesPara);
    }
    
    orderInfoEl.appendChild(detailsDiv);
    
    // Create the container for all sections
    const container = document.createElement('div');
    container.className = 'order-detail-content';
    
    // Append sections in order
    container.appendChild(orderInfoEl);
    
    // Add patient info if available
    if (patientInfoEl) {
        container.appendChild(patientInfoEl);
    }
    
    // Add medications if available
    if (medicationsEl) {
        container.appendChild(medicationsEl);
    }
    
    return container;
}

/**
 * Setup the modal buttons based on order status
 * @param {Object} order - The order object
 */
function setupModalButtons(order) {
    console.log('[MODAL] Setting up modal buttons for order status:', order?.status);
    
    // Get button elements
    const processBtn = document.getElementById('process-order-modal-btn');
    const rejectBtn = document.getElementById('reject-order-modal-btn');
    const historyBtn = document.getElementById('view-history-btn');
    const closeBtn = document.querySelector('.modal-close-btn');
    const editBtn = document.getElementById('edit-order-btn');
    const saveBtn = document.getElementById('save-order-btn');
    const cancelBtn = document.getElementById('cancel-order-btn');
    const viewOrderGroupBtn = document.getElementById('view-order-group-btn');
    const changeStatusBtn = document.getElementById('change-status-btn');
    
    // Set current order globally for reference in other functions
    currentOrder = order;
    
    // Setup history button if it exists
    if (historyBtn && order?.id) {
        console.log('[MODAL] Found history button, setting up event listener');
        historyBtn.setAttribute('data-order-id', order.id);
        historyBtn.onclick = function() {
            console.log('[MODAL] View history button clicked');
            if (window.apiClient && typeof window.apiClient.getOrderHistory === 'function') {
                // If history API is available, call it
                viewOrderHistory(order.id);
            } else {
                console.log('[MODAL] History API not available');
                alert('Order history functionality not available');
            }
        };
        
        // Show/hide based on API availability
        const hasHistoryAccess = window.apiClient && typeof window.apiClient.getOrderHistory === 'function';
        historyBtn.style.display = hasHistoryAccess ? 'inline-block' : 'none';
    }
    
    // Change Status button for completed / cancelled / unfulfilled orders
    if (changeStatusBtn) {
        // Remove previous listeners to avoid duplicates
        const newChangeBtn = changeStatusBtn.cloneNode(true);
        changeStatusBtn.parentNode.replaceChild(newChangeBtn, changeStatusBtn);

        // Hide by default
        newChangeBtn.classList.add('hidden');

        const allowedStatuses = ['completed', 'cancelled', 'unfulfilled'];
        if (order && allowedStatuses.includes((order.status || '').toLowerCase())) {
            console.log('[MODAL] Showing change status button for order:', order.id);
            newChangeBtn.classList.remove('hidden');
            newChangeBtn.onclick = () => {
                console.log('[MODAL] Change status button clicked for order:', order.id);
                openChangeStatusModal(order.id);
            };
        }
    }

    // Cancel Order button
    if (cancelBtn) {
        if (order && order.status === 'pending') {
            console.log('[MODAL] Showing cancel button for pending order');
            cancelBtn.classList.remove('hidden');
            cancelBtn.onclick = () => {
                console.log('[MODAL] Cancel button clicked for order:', order.id);
                cancelOrder(order.id);
            };
        } else {
            console.log('[MODAL] Hiding cancel button for non-pending order');
            cancelBtn.classList.add('hidden');
        }
    }
    
    // Edit Order button
    if (editBtn) {
        if (order && order.status === 'pending') {
            console.log('[MODAL] Showing edit button for pending order');
            editBtn.classList.remove('hidden');
            editBtn.onclick = () => {
                console.log('[MODAL] Edit button clicked for order:', order.id);
                toggleOrderEditMode(true);
            };
        } else {
            console.log('[MODAL] Hiding edit button for non-pending order, status:', order?.status);
            editBtn.classList.add('hidden');
        }
    }
    
    // Save Changes button
    if (saveBtn) {
        saveBtn.classList.add('hidden');
        saveBtn.onclick = () => {
            console.log('[MODAL] Save button clicked for order:', order?.id);
            saveOrderChanges();
        };
    }
    
    // Process button
    if (processBtn && order) {
        // Only enable process button for pending orders
        const canProcess = order.status === 'pending';
        processBtn.disabled = !canProcess;
        processBtn.style.display = canProcess ? 'inline-block' : 'none';
        
        // Setup click handler
        processBtn.onclick = function() {
            console.log('[MODAL] Process button clicked for order:', order.id);
            
            // Temporarily store the single order to be grouped
            // This mimics the selection of a single checkbox for grouping
            // We need to ensure showCreateGroupModal can access this 'selection'
            // The showCreateGroupModal function expects selected checkboxes.
            // We'll simulate this by temporarily adding a 'checked' class or similar
            // to the row of the current order, or by passing the order directly if possible.
            
            // For now, let's assume showCreateGroupModal can be adapted to take an order object.
            // If not, we'll need to simulate the checkbox selection in the DOM.
            
            // Hide the current order detail modal
            document.getElementById('order-detail-modal').classList.add('hidden');

            // Call the existing showCreateGroupModal to preview and confirm
            showCreateGroupModal([order.id]);
        };
    }
    
    // View Order Group button - show for orders with a groupId OR with in-progress status (since in-progress orders must be in a group)
    if (viewOrderGroupBtn && order) {
        const hasGroupId = order.groupId && order.groupId.trim().length > 0;
        const isInProgress = order.status === 'in-progress';
        const hasGroup = hasGroupId || isInProgress;
        console.log(`[MODAL] Order ${order.id} has group:`, hasGroup, 
                    `(groupId: ${order.groupId || 'not set'}, status: ${order.status})`);
        
        // Show button for orders with a group ID or in-progress status
        if (hasGroup) {
            viewOrderGroupBtn.classList.remove('hidden');
            viewOrderGroupBtn.onclick = function() {
                console.log('[MODAL] View Order Group button clicked for order:', order.id);
                console.log('[MODAL] Full order object:', order);
                // Hide the order detail modal
                document.getElementById('order-detail-modal').classList.add('hidden');
                
                // If we have a groupId, filter by it directly
                if (order.groupId && order.groupId.trim().length > 0) {
                    console.log('[MODAL] Using explicit groupId to filter:', order.groupId);
                    displayOrderGroupsModal(order.groupId);
                }
                // Otherwise, we need to find the group containing this order
                else if (order.id) {
                    console.log('[MODAL] Finding group containing order ID:', order.id);
                    // Call a function to find and display the group by order ID
                    // Pass the full order object for more detailed matching
                    findAndDisplayGroupByOrderId(order.id, order);
                }
            };
        } else {
            viewOrderGroupBtn.classList.add('hidden');
        }
    }
    
    // Reject button
    if (rejectBtn && order) {
        // Only enable reject button for pending orders
        const canReject = order.status === 'pending';
        rejectBtn.disabled = !canReject;
        rejectBtn.style.display = canReject ? 'inline-block' : 'none';
        
        // Setup click handler
        rejectBtn.onclick = function() {
            console.log('[MODAL] Reject button clicked');
            document.getElementById('order-detail-modal').style.display = 'none';
            rejectOrder(order.id);
        };
    }
}

/**
 * Setup modal close handlers
 */
function setupModalCloseHandlers() {
    // Close button
    const closeButton = document.querySelector('.modal-close');
    if (closeButton) {
        closeButton.onclick = function() {
            document.getElementById('order-detail-modal').style.display = 'none';
        };
    }
    
    // Close button in footer
    const closeFooterButton = document.querySelector('.modal-close-btn');
    if (closeFooterButton) {
        closeFooterButton.onclick = function() {
            document.getElementById('order-detail-modal').style.display = 'none';
        };
    }
    
    // Close when clicking outside the modal content
    const modal = document.getElementById('order-detail-modal');
    if (modal) {
        window.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
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
function renderOrderDetails(editMode = false) {
    const contentContainer = document.getElementById('modal-order-content');
    if (!contentContainer || !currentOrder) return;
    
    // If in edit mode, show editable fields
    if (editMode) {
        const formattedDate = new Date(currentOrder.timestamp).toLocaleString();
        
        // Create container for the editable content
        const editContainer = document.createElement('div');
        editContainer.className = 'order-detail-content';
        
        // Order Information section
        const orderInfoSection = document.createElement('div');
        orderInfoSection.className = 'order-section';
        
        const orderInfoHeading = document.createElement('h4');
        orderInfoHeading.textContent = 'Order Information';
        orderInfoSection.appendChild(orderInfoHeading);
        
        const orderDetails = document.createElement('div');
        orderDetails.className = 'order-details';
        
        // Order ID
        const idPara = document.createElement('p');
        const idStrong = document.createElement('strong');
        idStrong.textContent = 'Order ID:';
        idPara.appendChild(idStrong);
        idPara.appendChild(document.createTextNode(' ' + currentOrder.id));
        orderDetails.appendChild(idPara);
        
        // Type
        const typePara = document.createElement('p');
        const typeStrong = document.createElement('strong');
        typeStrong.textContent = 'Type:';
        typePara.appendChild(typeStrong);
        typePara.appendChild(document.createTextNode(' ' + (currentOrder.type || 'N/A')));
        orderDetails.appendChild(typePara);
        
        // Status
        const statusPara = document.createElement('p');
        const statusStrong = document.createElement('strong');
        statusStrong.textContent = 'Status:';
        statusPara.appendChild(statusStrong);
        
        const statusSpan = document.createElement('span');
        statusSpan.className = `status-badge status-${currentOrder.status}`;
        statusSpan.textContent = currentOrder.status || 'pending';
        statusPara.appendChild(document.createTextNode(' '));
        statusPara.appendChild(statusSpan);
        orderDetails.appendChild(statusPara);
        
        // Created
        const createdPara = document.createElement('p');
        const createdStrong = document.createElement('strong');
        createdStrong.textContent = 'Created:';
        createdPara.appendChild(createdStrong);
        createdPara.appendChild(document.createTextNode(' ' + formattedDate));
        orderDetails.appendChild(createdPara);
        
        // Requester
        const requesterPara = document.createElement('p');
        const requesterStrong = document.createElement('strong');
        requesterStrong.textContent = 'Requester:';
        requesterPara.appendChild(requesterStrong);
        requesterPara.appendChild(document.createTextNode(' ' + (currentOrder.requesterName || 'Unknown')));
        orderDetails.appendChild(requesterPara);
        
        // Notes
        const notesGroup = document.createElement('div');
        notesGroup.className = 'form-group';
        
        const notesLabel = document.createElement('label');
        notesLabel.setAttribute('for', 'edit-notes');
        notesLabel.textContent = 'Notes:';
        notesGroup.appendChild(notesLabel);
        
        const notesTextarea = document.createElement('textarea');
        notesTextarea.id = 'edit-notes';
        notesTextarea.className = 'form-control';
        notesTextarea.value = currentOrder.notes || '';
        notesGroup.appendChild(notesTextarea);
        
        orderDetails.appendChild(notesGroup);
        orderInfoSection.appendChild(orderDetails);
        editContainer.appendChild(orderInfoSection);
        
        // Medications section (if present)
        if (currentOrder.medications && currentOrder.medications.length > 0) {
            const medsSection = document.createElement('div');
            medsSection.className = 'order-section';
            
            const medsHeading = document.createElement('h4');
            medsHeading.textContent = 'Medications';
            medsSection.appendChild(medsHeading);
            
            const medsList = document.createElement('div');
            medsList.className = 'medications-list';
            medsList.id = 'edit-medications-list';
            
            // Add each medication as an editable item
            currentOrder.medications.forEach((med, index) => {
                const medItem = document.createElement('div');
                medItem.className = 'medication-item medication-edit-item';
                medItem.dataset.index = index;
                
                // Name field
                const nameGroup = document.createElement('div');
                nameGroup.className = 'form-group';
                
                const nameLabel = document.createElement('label');
                nameLabel.textContent = 'Name:';
                nameGroup.appendChild(nameLabel);
                
                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.className = 'form-control med-name';
                nameInput.value = med.name || med.medication || med.drug || '';
                nameGroup.appendChild(nameInput);
                medItem.appendChild(nameGroup);
                
                // Strength field
                const strengthGroup = document.createElement('div');
                strengthGroup.className = 'form-group';
                
                const strengthLabel = document.createElement('label');
                strengthLabel.textContent = 'Strength:';
                strengthGroup.appendChild(strengthLabel);
                
                const strengthInput = document.createElement('input');
                strengthInput.type = 'text';
                strengthInput.className = 'form-control med-strength';
                strengthInput.value = med.strength || med.doseStrength || '';
                strengthGroup.appendChild(strengthInput);
                medItem.appendChild(strengthGroup);
                
                // Form field
                const formGroup = document.createElement('div');
                formGroup.className = 'form-group';
                
                const formLabel = document.createElement('label');
                formLabel.textContent = 'Form:';
                formGroup.appendChild(formLabel);
                
                const formInput = document.createElement('input');
                formInput.type = 'text';
                formInput.className = 'form-control med-form';
                formInput.value = med.form || med.formulation || '';
                formGroup.appendChild(formInput);
                medItem.appendChild(formGroup);
                
                // Quantity field
                const qtyGroup = document.createElement('div');
                qtyGroup.className = 'form-group';
                
                const qtyLabel = document.createElement('label');
                qtyLabel.textContent = 'Quantity:';
                qtyGroup.appendChild(qtyLabel);
                
                const qtyInput = document.createElement('input');
                qtyInput.type = 'text';
                qtyInput.className = 'form-control med-quantity';
                qtyInput.value = med.quantity || med.qty || med.amount || '';
                qtyGroup.appendChild(qtyInput);
                medItem.appendChild(qtyGroup);
                
                // Dose field
                const doseGroup = document.createElement('div');
                doseGroup.className = 'form-group';
                
                const doseLabel = document.createElement('label');
                doseLabel.textContent = 'Dose:';
                doseGroup.appendChild(doseLabel);
                
                const doseInput = document.createElement('input');
                doseInput.type = 'text';
                doseInput.className = 'form-control med-dose';
                doseInput.value = med.dose || med.dosage || med.doseInstructions || '';
                doseInput.placeholder = 'N/A';
                doseGroup.appendChild(doseInput);
                medItem.appendChild(doseGroup);
                
                // Notes field
                const notesGroup = document.createElement('div');
                notesGroup.className = 'form-group';
                
                const notesLabel = document.createElement('label');
                notesLabel.textContent = 'Notes:';
                notesGroup.appendChild(notesLabel);
                
                const notesInput = document.createElement('input');
                notesInput.type = 'text';
                notesInput.className = 'form-control med-notes';
                notesInput.value = med.notes || '';
                notesInput.placeholder = 'Optional';
                notesGroup.appendChild(notesInput);
                medItem.appendChild(notesGroup);
                
                // Add a remove button
                const actionGroup = document.createElement('div');
                actionGroup.className = 'form-group medication-actions';
                
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'btn btn-danger btn-sm';
                removeBtn.textContent = 'Remove';
                removeBtn.onclick = function() {
                    removeMedication(index);
                };
                actionGroup.appendChild(removeBtn);
                medItem.appendChild(actionGroup);
                
                medsList.appendChild(medItem);
            });
            
            medsSection.appendChild(medsList);
            editContainer.appendChild(medsSection);
        }
        
        // Clear and append the edit container
        contentContainer.innerHTML = '';
        contentContainer.appendChild(editContainer);
    } else {
        // View mode (not in edit mode)
        // Clear the container first
        while (contentContainer.firstChild) {
            contentContainer.removeChild(contentContainer.firstChild);
        }
        // Append the element properly instead of using innerHTML
        contentContainer.appendChild(createOrderDetailHTML(currentOrder));
    }
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
 * Show a modal prompting for an edit reason
 * @returns {Promise<string>} - The reason provided by the user, or empty string if cancelled
 */
async function showEditReasonModal() {
    return new Promise((resolve) => {
        console.log('[MODAL] Creating edit reason modal');
        
        // Create modal container if it doesn't exist
        let modalOverlay = document.getElementById('edit-reason-modal-overlay');
        if (!modalOverlay) {
            modalOverlay = document.createElement('div');
            modalOverlay.id = 'edit-reason-modal-overlay';
            modalOverlay.className = 'modal-overlay';
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
        modalContent.className = 'modal-content';
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
 * Save changes made to an order in edit mode
 */
async function saveOrderChanges() {
    console.log('[EDIT] Saving order changes');
    if (!currentOrder || !currentOrder.id) {
        console.error('[EDIT] No current order to save');
        return;
    }
    
    try {
        // Get updated values from form
        const notesField = document.getElementById('edit-notes');
        const updatedNotes = notesField ? notesField.value : currentOrder.notes;
        
        // Get updated medication data if present
        const updatedMedications = [];
        const medicationItems = document.querySelectorAll('.medication-edit-item');
        
        if (medicationItems && medicationItems.length > 0) {
            console.log('[EDIT] Found medication items to update:', medicationItems.length);
            
            medicationItems.forEach((item, index) => {
                // Get the original medication object
                const originalMed = currentOrder.medications[parseInt(item.dataset.index, 10)] || {};
                
                // Get updated values from form fields
                const nameInput = item.querySelector('.med-name');
                const strengthInput = item.querySelector('.med-strength');
                const formInput = item.querySelector('.med-form');
                const quantityInput = item.querySelector('.med-quantity');
                const doseInput = item.querySelector('.med-dose');
                
                // Create updated medication object with all original properties
                const updatedMed = { ...originalMed };
                
                // Update with new values if inputs exist
                if (nameInput) updatedMed.name = nameInput.value.trim();
                if (strengthInput) updatedMed.strength = strengthInput.value.trim();
                if (formInput) updatedMed.form = formInput.value.trim();
                if (quantityInput) updatedMed.quantity = quantityInput.value.trim();
                if (doseInput) updatedMed.dose = doseInput.value.trim();
                
                // Log the medication update
                console.log(`[EDIT] Updated medication ${index}:`, updatedMed);
                
                updatedMedications.push(updatedMed);
            });
        }
        
        // Get the reason for the edit from the user
        const reason = await showEditReasonModal();
        
        // If user cancelled, abort the save operation
        if (!reason) {
            console.log('[EDIT] Edit cancelled by user');
            return;
        }
        
        // Prepare updated order data
        const orderUpdates = {
            notes: updatedNotes,
            auditReason: reason // Include the reason for the edit
        };
        
        // Only include medications if they were updated
        if (updatedMedications.length > 0) {
            orderUpdates.medications = updatedMedications;
        }
        
        console.log('[EDIT] Updating order with data:', orderUpdates);
        
        // Check for API client
        if (window.apiClient && typeof window.apiClient.updateOrder === 'function') {
            // Show loading state
            const saveButton = document.getElementById('save-order-btn');
            if (saveButton) saveButton.textContent = 'Saving...';
            
            // Call API to update order
            const response = await window.apiClient.updateOrder(currentOrder.id, orderUpdates);
            console.log('[EDIT] Update response:', response);
            
            if (response && response.success) {
                console.log('[EDIT] Order updated successfully');
                
                // Update the current order with the new data
                if (orderUpdates.medications) {
                    currentOrder.medications = orderUpdates.medications;
                }
                if (orderUpdates.notes) {
                    currentOrder.notes = orderUpdates.notes;
                }
                
                // Switch back to view mode
                toggleOrderEditMode(false);
                
                // Show success notification
                if (typeof showToastNotification === 'function') {
                    showToastNotification('Order updated successfully', 'success');
                }
                
                // Refresh orders list
                loadOrders();
            } else {
                console.error('[EDIT] Failed to update order:', response?.error || 'Unknown error');
                if (typeof showToastNotification === 'function') {
                    showToastNotification('Failed to update order: ' + (response?.error || 'Unknown error'), 'error');
                } else {
                    alert('Failed to update order: ' + (response?.error || 'Unknown error'));
                }
            }
            
            // Reset save button
            if (saveButton) saveButton.textContent = 'Save Changes';
        } else {
            console.error('[EDIT] API client or updateOrder method not available');
            alert('Cannot update order: API not available');
        }
    } catch (error) {
        console.error('[EDIT] Error updating order:', error);
        if (typeof showToastNotification === 'function') {
            showToastNotification('Error updating order: ' + error.message, 'error');
        } else {
            alert('Error updating order: ' + error.message);
        }
    }
}

/**
 * Load order groups from the API
 * @param {boolean} forceRefresh - If true, will bypass cache and fetch fresh data
 * @returns {Promise<Array>} - Promise resolving to an array of order groups
 */
async function loadOrderGroups(forceRefresh = false) {
    console.log('Loading order groups...');
    
    // Return cached groups if available and not forcing refresh
    if (!forceRefresh && orderGroups && orderGroups.length > 0) {
        return orderGroups;
    }
    
    // Load any groups from session storage that might have been saved previously
    try {
        const storedGroups = JSON.parse(sessionStorage.getItem('orderGroupsHistory') || '[]');
        if (storedGroups.length > 0) {
            console.log(`Loaded ${storedGroups.length} groups from session storage`);
            orderGroupsHistory = storedGroups;
        }
    } catch (e) {
        console.error('Error loading stored groups from session storage:', e);
    }
    
    try {   // Check for API client availability
        if (window.apiClient) {
            let response;
            
            console.log('Attempting to load order groups via API');
            
            // Try the dedicated method first
            if (typeof window.apiClient.getOrderGroups === 'function') {
                console.log('Using dedicated getOrderGroups method');
                response = await window.apiClient.getOrderGroups();
            } 
            // Fall back to general GET (try different endpoint formats)
            else if (typeof window.apiClient.get === 'function') {
                // Try multiple potential endpoints - correct one depends on API implementation
                try {
                    // Try the same endpoint pattern used for creation first (without /api prefix)
                    console.log('Trying /order-groups endpoint (matches creation endpoint)');
                    response = await window.apiClient.get('/order-groups');
                    
                    if (!response || (response.success === false) || 
                        (Array.isArray(response) && response.length === 0) || 
                        (response.data && Array.isArray(response.data) && response.data.length === 0) ||
                        (response.groups && Array.isArray(response.groups) && response.groups.length === 0)) {
                        
                        console.log('No results from /api/order-groups, trying /api/order_groups');
                        response = await window.apiClient.get('/api/order_groups');
                    }
                    
                    // If still no results, try order groups endpoint
                    if (!response || (response.success === false) || 
                        (Array.isArray(response) && response.length === 0) || 
                        (response.data && Array.isArray(response.data) && response.data.length === 0) ||
                        (response.groups && Array.isArray(response.groups) && response.groups.length === 0)) {
                        // Try multiple possible API endpoints
                        const endpointsToTry = [
                            '/api/order-groups',
                            '/api/orders/groups',
                            '/api/ordergroups',
                            '/order-groups',
                            '/order_groups',
                            '/orders/groups'
                        ];
                        
                        let lastError = null;
                        for (const endpoint of endpointsToTry) {
                            try {
                                console.log(`Trying endpoint: ${endpoint}`);
                                response = await window.apiClient.get(endpoint);
                                console.log(`Success with endpoint: ${endpoint}`);
                                break; // Exit loop if successful
                            } catch (error) {
                                console.error(`API Error (${endpoint}):`, error);
                                lastError = error;
                            }
                        }
                        
                        // If we've tried all endpoints and still have no response
                        if (!response && lastError) {
                            console.error('Error fetching from all endpoints, last error:', lastError);
                            throw new Error('Failed to fetch order groups from any endpoint');
                        }
                    }
                } catch (error) {
                    console.error('Error fetching from primary endpoint:', error);
                    console.log('Trying fallback endpoint');
                    try {
                        response = await window.apiClient.get('/api/orders/groups');
                    } catch (fallbackError) {
                        console.error('Error fetching from fallback endpoint:', fallbackError);
                    }
                }
            } 
            // Last resort: direct fetch
            else {
                const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
                
                const response = await fetch('/api/order-groups', {
                    headers: {
                        'Authorization': authToken ? `Bearer ${authToken}` : '',
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch order groups: ${response.statusText}`);
                }
                
                return await response.json();
            }
            
            // Enhanced logging to see what's in the response
            console.log('Order groups API response:', response);
            
            if (response && (response.success !== false)) {
                // Normalize response structure depending on how API returns data
                let groups = [];
                
                if (Array.isArray(response)) {
                    console.log('Response is an array - directly using as groups');
                    groups = response;
                } else if (response.data && Array.isArray(response.data)) {
                    console.log('Using data array from response');
                    groups = response.data;
                } else if (response.groups && Array.isArray(response.groups)) {
                    console.log('Using groups array from response');
                    groups = response.groups;
                } else if (response.orderGroups && Array.isArray(response.orderGroups)) {
                    console.log('Using orderGroups array from response');
                    groups = response.orderGroups;
                } else {
                    // Try to find any property that might contain groups
                    const possibleGroupArrays = Object.keys(response).filter(key => 
                        Array.isArray(response[key]) && 
                        response[key].some(item => item.orderIds || item.orders || item.groupNumber));
                    
                    if (possibleGroupArrays.length > 0) {
                        console.log('Found potential group arrays in properties:', possibleGroupArrays);
                        groups = response[possibleGroupArrays[0]];
                    } else {
                        console.log('Could not identify groups in response structure');
                    }
                }
                
                console.log('Extracted', groups.length, 'order groups');
                
                if (groups.length === 0 && response.id && (response.orderIds || response.groupNumber)) {
                    // The response itself might be a single group
                    console.log('Response appears to be a single group, using it directly');
                    groups = [response];
                }
                
                // For each group, fetch the associated orders
                const groupsWithDetails = await Promise.all(groups.map(async group => {
                    console.log('Processing group:', group);
                    // If group doesn't have orders already loaded
                    if (!group.orders) {
                        console.log('Fetching orders for group', group.id || group.groupNumber || group.group_number);
                        // Map group_number to groupNumber if it hasn't been done yet
                        if (group.group_number && !group.groupNumber) {
                            group.groupNumber = group.group_number;
                        }
                        // Fetch orders belonging to this group
                        const ordersResponse = await fetchOrdersByGroup(group.id);
                        group.orders = ordersResponse || [];
                        console.log('Fetched', group.orders.length, 'orders for group');
                    }
                    return group;
                }));
                
                console.log('Final processed groups:', groupsWithDetails);
                
                // Update the global caches with the newly fetched groups
                if (groupsWithDetails && groupsWithDetails.length > 0) {
                    console.log(`Populating caches with ${groupsWithDetails.length} detailed groups.`);
                    orderGroups = [...groupsWithDetails];
                    orderGroupsHistory = [...groupsWithDetails]; // CRITICAL: Update history for search
                    
                    // Persist to session storage
                    try {
                        sessionStorage.setItem('orderGroupsHistory', JSON.stringify(orderGroupsHistory));
                        console.log('Updated order groups history in session storage.');
                    } catch (e) {
                        console.error('Error saving order groups to session storage:', e);
                    }
                } else if (orderGroupsHistory.length > 0) {
                    // Fallback to history if API returns nothing
                    console.log(`API returned no groups. Using ${orderGroupsHistory.length} groups from history cache.`);
                    orderGroups = [...orderGroupsHistory];
                } else {
                    orderGroups = [];
                    orderGroupsHistory = [];
                }
                
                return orderGroups;
            }
            
            throw new Error('Invalid API response structure');
        }
        
        throw new Error('API client not available');
    } catch (error) {
        console.error('Error loading order groups:', error);
        showNotification('Failed to load order groups: ' + error.message, 'error');
        
        // If API call failed but we have groups in history cache, use those as fallback
        if (orderGroupsHistory.length > 0) {
            console.log(`API error occurred. Using ${orderGroupsHistory.length} groups from history cache as fallback`);
            return [...orderGroupsHistory];
        }
        
        return [];
    } finally {
        loading = false;
    }
}

/**
 * Fetch orders belonging to a specific group
 * @param {number} groupId - Group ID
 * @returns {Promise<Array>} - Promise resolving to array of orders
 */
async function fetchOrdersByGroup(groupId) {
    // Load full order objects (including medications) for a given group ID
    // Strategy:
    // 1. Fetch the order group via /api/order-groups/:id to retrieve the orderIds array
    // 2. For each orderId, fetch the full order details via /api/orders/:orderId
    // 3. Return an array of fully-hydrated order objects

    try {
        // Check for API client availability
        if (window.apiClient) {
            let response;

            // First attempt dedicated client method (kept for backward compatibility)
            if (typeof window.apiClient.getOrdersByGroup === 'function') {
                try {
                    response = await window.apiClient.getOrdersByGroup(groupId);
                    if (response && response.length) return response;
                } catch (err) {
                    console.warn('getOrdersByGroup failed, falling back to manual fetch:', err);
                }
            }

            // Manual fallback:
            // Step 1: Fetch group to get orderIds
            if (typeof window.apiClient.get === 'function') {
                let groupResp;
                try {
                    groupResp = await window.apiClient.get(`/order-groups/${groupId}`);
                } catch (err) {
                    console.error(`Error fetching order group ${groupId}:`, err);
                }

                const orderIds = Array.isArray(groupResp?.orderIds) ? groupResp.orderIds : [];
                if (orderIds.length === 0) {
                    console.warn(`No orderIds found for group ${groupId}`);
                    return [];
                }

                // Step 2: Fetch each order in parallel
                const orderPromises = orderIds.map(async (oid) => {
                    try {
                        const orderResp = await window.apiClient.get(`/orders/${oid}`);
                        // Different APIs may wrap the order differently
                        if (orderResp?.order) return orderResp.order;
                        if (orderResp?.data) return orderResp.data;
                        return orderResp;
                    } catch (err) {
                        console.error(`Error fetching order ${oid}:`, err);
                        return null;
                    }
                });

                const orders = (await Promise.all(orderPromises)).filter(o => o != null);
                return orders;
            }

            // If we reach here, no API client get method
            return [];
        }

        return [];
    } catch (error) {
        console.error(`Error fetching orders for group ${groupId}:`, error);
        return [];
    }
}

// Flag to track if displayOrderGroupsModal was explicitly called by user action
let orderGroupsModalUserRequested = false;

/**
 * Find an order group containing the specified order and display it in the modal
 * @param {string} orderId Order ID to find in groups
 * @param {Object} orderObject Full order object with details to match
 */
async function findAndDisplayGroupByOrderId(orderId, orderObject = null) {
    if (!orderId) {
        console.error('[MODAL] Cannot find group: No order ID provided');
        return;
    }
    
    console.log(`[MODAL] Finding order group containing order: ${orderId}`);
    
    // First, try to load order groups from the API
    let groups;
    try {
        groups = await loadOrderGroups(true); // forceRefresh = true to ensure we get latest data
    } catch (e) {
        console.error('Error loading order groups from API:', e);
        // Fall back to using the cached groups
        groups = [...orderGroupsHistory];
    }
    
    if (!groups || groups.length === 0) {
        console.log('No order groups available to search');
        showNotification('No order groups available to search', 'error');
        return;
    }
    
    // Look through all groups to find the one containing this order
    console.log(`Searching through ${groups.length} order groups for order ID: ${orderId}`);
    
    let foundGroup = null;
    let groupIdentifier = null;
    
    // Define helper function for deep comparison of orders
    function ordersMatchDetails(order1, order2) {
        if (!order1 || !order2) return false;
        
        // Match by ID if both have IDs and they match
        if (order1.id && order2.id && order1.id === order2.id) {
            console.log(`Matched by ID: ${order1.id}`);
            return true;
        }
        
        // Match by multiple fields for deeper comparison
        // Patient match
        const patientMatch = order1.patient && order2.patient && 
            ((order1.patient.name === order2.patient.name && order1.patient.dob === order2.patient.dob) ||
             (order1.patient.hospitalId && order2.patient.hospitalId && 
              order1.patient.hospitalId === order2.patient.hospitalId));
        
        if (patientMatch) {
            console.log(`Patient details match between orders: ${order1.id || 'unknown'} and ${order2.id || 'unknown'}`);
            
            // If medications match as well, we have a high confidence match
            const hasMedications = order1.medications && Array.isArray(order1.medications) && 
                                  order2.medications && Array.isArray(order2.medications);
            
            if (hasMedications) {
                // Compare medication names as a basic match
                const med1Names = order1.medications.map(m => m.name).sort().join(',');
                const med2Names = order2.medications.map(m => m.name).sort().join(',');
                
                if (med1Names === med2Names) {
                    console.log(`Medication names match: ${med1Names}`);
                    return true;
                }
            } else {
                // If we don't have medications to compare but patient details match,
                // use other fields like timestamp, ward, etc. for additional confidence
                if (order1.wardId === order2.wardId || 
                    order1.wardName === order2.wardName || 
                    order1.requesterName === order2.requesterName) {
                    console.log(`Additional details match between orders`);
                    return true;
                }
            }
        }
        
        return false;
    }
    
    groups.forEach((group, index) => {
        console.log(`Examining group ${index+1}/${groups.length}:`, group);
        
        // Check if this group contains the order ID in its orderIds array
        if (group.orderIds && Array.isArray(group.orderIds) && 
            group.orderIds.some(id => id.toString() === orderId.toString())) {
            console.log(`Found order ID ${orderId} in orderIds array of group ${group.id || index}`);
            foundGroup = group;
            groupIdentifier = group.id || group.groupId || group.groupNumber;
            return;
        }
        
        // Check if the order exists in the orders array by ID or details
        if (group.orders && Array.isArray(group.orders)) {
            console.log(`Group ${index+1} checking ${group.orders.length} orders in orders array`);
            console.log('Order IDs in group ' + (index+1) + ':', group.orders.map(o => o.id));
            
            // Try to match by order details if we have the full order object
            if (orderObject) {
                for (let i = 0; i < group.orders.length; i++) {
                    if (ordersMatchDetails(group.orders[i], orderObject)) {
                        console.log(`FOUND MATCH by details in group ${index+1}!`);
                        foundGroup = group;
                        groupIdentifier = group.id || group.groupId || group.groupNumber;
                        return;
                    }
                }
            }
            
            // Fall back to simple ID matching if details matching didn't work
            if (!foundGroup && group.orders.some(order => order.id && order.id.toString() === orderId.toString())) {
                console.log(`FOUND MATCH by ID in orders array of group ${index+1}!`);
                foundGroup = group;
                groupIdentifier = group.id || group.groupId || group.groupNumber;
            }
        }
    });
    
    if (foundGroup) {
        console.log(`[MODAL] Found group for order ${orderId}:`, foundGroup);
        
        // Close the order detail modal
        const orderDetailModal = document.getElementById('order-detail-modal');
        if (orderDetailModal) {
            orderDetailModal.classList.add('hidden');
            orderDetailModal.style.display = 'none';
        }
        
        // Always use the group ID for filtering the display
        if (groupIdentifier) {
            // Save the found group to a global variable for direct access
            window.currentFilteredGroup = foundGroup;
            
            // Display the order groups modal filtered to this specific group
            console.log(`[MODAL] Filtering order groups modal to show only group: ${groupIdentifier}`);
            displayOrderGroupsModal(groupIdentifier, true, foundGroup);
        } else {
            console.log(`[MODAL] Found group but no identifier available for filtering`);
            // If no identifier is available, still show the modal but with a message
            displayOrderGroupsModal();
            showNotification(`Group found but cannot filter display`, 'warning');
        }
    } else {
        console.log(`[MODAL] No group found containing order: ${orderId}`);
        // Still show the modal but with a message
        displayOrderGroupsModal();
        showNotification(`No group found containing order: ${orderId}`, 'warning');
    }
}

/**
 * Display order groups in the modal
 * @param {string|boolean} filterGroupId - If provided, only show this specific group. If true, will refresh data
 * @param {boolean} isUserAction - Whether this was triggered by a direct user action
 * @param {Object} specificGroup - If provided, this exact group object will be displayed
 */
async function displayOrderGroupsModal(filterGroupId = false, isUserAction = true, specificGroup = null) {
    // Convert the parameter - if it's not a string, treat it as forceRefresh (for backward compatibility)
    const forceRefresh = typeof filterGroupId !== 'string' ? !!filterGroupId : true;
    // Get the modal element
    const modal = document.getElementById('order-groups-modal');
    const container = document.getElementById('order-groups-container');
    
    if (!modal || !container) {
        console.error('Order groups modal elements not found');
        return;
    }
    
    // Set the user request flag if this is explicitly requested by user
    if (isUserAction) {
        orderGroupsModalUserRequested = true;
    }
    
    // Skip display if this is an automatic call during page load
    if (!forceRefresh && !orderGroupsModalUserRequested && window.isInitialPageLoad) {
        console.log('Preventing automatic order groups modal display during page load');
        return;
    }
    
    // Show loading message
    container.innerHTML = '<p class="loading-message">Loading order groups...</p>';
    
    // Only display modal if explicitly requested
    if (orderGroupsModalUserRequested) {
        modal.classList.remove('hidden');
        modal.style.display = '';
        
        // Make sure we attach the close button event listeners
        const closeButtons = modal.querySelectorAll('.modal-close, .modal-close-btn');
        closeButtons.forEach(button => {
            // Clone button to remove any existing event listeners
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // Add event listener to the new button
            newButton.addEventListener('click', function() {
                console.log('Order groups modal close button clicked');
                modal.classList.add('hidden');
                modal.style.display = 'none';
                // Reset the user request flag when closed
                orderGroupsModalUserRequested = false;

                // Refresh the main order lists so the user immediately sees the updated data
                if (typeof loadOrders === 'function') {
                    loadOrders();
                } else if (typeof fetchAllOrders === 'function') {
                    // Fallback for ward orders or other contexts
                    fetchAllOrders();
                }
            });


        });

        // Close when clicking on the overlay (outside modal content)
        if (!modal.dataset.outsideListenerAdded) {
            modal.addEventListener('click', function(event) {
                if (event.target === modal) {
                    console.log('Overlay click detected; closing Order Groups modal');
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    orderGroupsModalUserRequested = false;

                    if (typeof loadOrders === 'function') {
                        loadOrders();
                    } else if (typeof fetchAllOrders === 'function') {
                        fetchAllOrders();
                    }
                }
            });
            modal.dataset.outsideListenerAdded = 'true';
        }

        // Add keyboard event listener for Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                console.log('Escape key pressed, closing Order Groups modal');
                modal.classList.add('hidden');
                modal.style.display = 'none';
                orderGroupsModalUserRequested = false;

                // Refresh the main order lists on modal close via Escape key
                if (typeof loadOrders === 'function') {
                    loadOrders();
                } else if (typeof fetchAllOrders === 'function') {
                    fetchAllOrders();
                }
            }
        });
        
    } else {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    
    try {
        // Use the specific group directly if provided
        let groups;
        
        if (specificGroup) {
            console.log('Using provided specific group:', specificGroup);
            groups = [specificGroup]; // Only show this one group
        } else {
            // Otherwise fetch order groups as normal
            console.log('Attempting to fetch and display order groups...');
            
            // Try API first, then fall back directly to orderGroupsHistory if needed
            // Always force refresh from backend when opening the modal, unless explicitly overridden
            try {
                groups = await loadOrderGroups(true); // forceRefresh = true
            } catch (e) {
                console.error('Error loading order groups from backend, will use cache if available:', e);
                groups = [];
            }
            
            console.log('Display function received groups:', groups);
            
            // If API returned no groups, but we have groups in history, use those directly
            if ((!groups || groups.length === 0) && orderGroupsHistory.length > 0) {
                console.log(`DIRECT FALLBACK: Using ${orderGroupsHistory.length} groups from history cache`);
                groups = [...orderGroupsHistory];
            }
        }
        
        if (!groups || groups.length === 0) {
            console.log('No groups available to display in modal');
            container.innerHTML = '<p class="empty-state">No order groups found</p>';
            return;
        }
        
        // Log what we found to help with debugging
        console.log('Found', groups.length, 'order groups to display');
        groups.forEach((group, index) => {
            console.log(`Group ${index+1}:`, { 
                id: group.id,
                groupNumber: group.groupNumber,
                orderIds: group.orderIds,
                orderCount: group.orders ? group.orders.length : 0
            });
        });
        
        // Create HTML content
        let html = '<div class="order-groups-list">';
        
        // If filterGroupId is provided, only show that specific group
        if (typeof filterGroupId === 'string' && filterGroupId.trim().length > 0) {
            console.log(`Filtering order groups to show only group: ${filterGroupId}`);
            
            // First try to find an exact match on any common identifier field
            let filteredGroups = groups.filter(group => {
                const match = 
                    (group.id && group.id.toString() === filterGroupId.toString()) || 
                    (group.groupId && group.groupId.toString() === filterGroupId.toString()) || 
                    (group.groupNumber && group.groupNumber.toString() === filterGroupId.toString());
                
                if (match) {
                    console.log(`Found exact match for group with identifier: ${filterGroupId}`, {
                        id: group.id,
                        groupId: group.groupId,
                        groupNumber: group.groupNumber
                    });
                }
                return match;
            });
            
            // If no groups match by ID, look for a group containing the order ID (filterGroupId might be an order ID)
            if (filteredGroups.length === 0) {
                console.log(`No direct group ID match, checking if ${filterGroupId} is an order ID...`);
                
                filteredGroups = groups.filter(group => {
                    // Check orderIds array
                    if (group.orderIds && Array.isArray(group.orderIds)) {
                        for (let i = 0; i < group.orderIds.length; i++) {
                            if (group.orderIds[i].toString() === filterGroupId.toString()) {
                                console.log(`Group ${group.id} contains order ID ${filterGroupId} in orderIds array`);
                                return true;
                            }
                        }
                    }
                    
                    // Check orders array
                    if (group.orders && Array.isArray(group.orders)) {
                        for (let i = 0; i < group.orders.length; i++) {
                            if (group.orders[i].id && group.orders[i].id.toString() === filterGroupId.toString()) {
                                console.log(`Group ${group.id} contains order ID ${filterGroupId} in orders array`);
                                return true;
                            }
                        }
                    }
                    
                    return false;
                });
            }
            
            // Update groups with filtered results
            if (filteredGroups.length > 0) {
                console.log(`Found ${filteredGroups.length} matching groups for identifier: ${filterGroupId}`);
                groups = filteredGroups;
                console.log('Filtered groups:', groups.map(g => g.id));
            } else {
                console.log(`No matching group found for ID: ${filterGroupId}`);
                container.innerHTML = `<p class="empty-state">No order group found for: ${filterGroupId}</p>`;
                return;
            }
        }
        
        // Filter out groups where all orders are completed/cancelled/unfulfilled
        const activeGroups = groups.filter(group => {
            if (!group.orders || group.orders.length === 0) return false;
            // Only include groups with at least one order that is not completed/cancelled/unfulfilled
            return group.orders.some(order => {
                const status = order.status && order.status.toLowerCase();
                return status !== 'completed' && status !== 'cancelled' && status !== 'unfulfilled';
            });
        });

        // For each group
        activeGroups.forEach(group => {
            // Ensure groupNumber is set by using group_number as fallback
            const groupNumber = group.groupNumber || group.group_number || group.id;
            html += `
                <div class="order-group-card" data-group-id="${group.id}">
                    <div class="order-group-header">
                        <h4>Group: ${groupNumber}</h4>
                        <span class="group-timestamp">${formatTimestamp(group.timestamp)}</span>
                        <button class="btn btn-sm btn-danger cancel-group-btn" data-group-id="${group.id}">Cancel Group</button>
                    </div>
                    ${group.notes ? `<p class="group-notes">${group.notes}</p>` : ''}
                    <div class="order-group-orders">
                        <h5>Orders in this group:</h5>
                        <table class="orders-table">
                            <thead>
                                <tr>
                                    
                                    <th>Patient</th>
                                    <th>Hospital #</th>
                                    <th>Medication Details</th>
                                    <th>Status</th>
                                    <th>Requester</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            // For each order in the group
            const orders = group.orders || [];
            if (orders.length === 0) {
                html += `<tr><td colspan="6" class="empty-state">No orders in this group</td></tr>`;
            } else {
                orders.forEach(order => {
                    // Format patient name
                    const patientName = (() => {
                        if (!order.patient) return 'N/A';
                        // Prefer explicit name field if present
                        if (order.patient.name) return order.patient.name;
                        // Otherwise build from first/last
                        const first = order.patient.firstName || order.patient.first_name || '';
                        const last = order.patient.lastName || order.patient.last_name || '';
                        const built = `${first} ${last}`.trim();
                        return built || 'N/A';
                    })();
                    
                    // Build hospital number
                    const hospitalNumber = order.patient ? 
                        (order.patient.hospitalNumber || order.patient.hospital_number || order.patient.hospitalId || order.patient.hospital_id || 'N/A') : 
                        'N/A';
                    
                    // Build medication details string for each medication
                    const medicationsSummary = order.medications && order.medications.length > 0 ?
                        order.medications.map(med => {
                            const parts = [];
                            if (med.name) parts.push(med.name);
                            if (med.strength) parts.push(med.strength);
                            if (med.form) parts.push(med.form);
                            // combine dose and quantity nicely if present
                            const doseQty = [];
                            if (med.dose) doseQty.push(med.dose);
                            if (med.quantity) doseQty.push(`qty ${med.quantity}`);
                            if (doseQty.length) parts.push(`(${doseQty.join(', ')})`);
                            return parts.join(' ');
                        }).join('; ') :
                        'No medications';
                    
                    // Format status
                    const statusDisplay = formatStatusDisplay(order.status);
                    
                    html += `
                        <tr data-order-id="${order.id}">
                            <td>${patientName}</td>
                            <td>${hospitalNumber}</td>
                            <td>${medicationsSummary}</td>
                            <td class="status-cell"><div>${statusDisplay}</div><div class="timestamp">${getStatusChangeTimestamp(order)}</div></td>
                            <td class="requester-info">
                                <div>${order.requesterName || ''}</div>
                                <div class="timestamp">${new Date(order.timestamp).toLocaleString()}</div>
                            </td>
                            <td class="action-buttons">
                                <button class="btn btn-sm btn-info view-notes-btn" data-order-id="${order.id}">View Notes</button>
                                <button class="btn btn-sm btn-success mark-complete-btn" data-order-id="${order.id}"
                                    ${order.status === 'completed' ? 'disabled' : ''}>Mark Complete</button>
                                <button class="btn btn-sm btn-primary change-status-btn" data-order-id="${order.id}">Change Status</button>
                            </td>
                        </tr>
                    `;
                });
            }
            
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;

    // Attach Cancel Group button listeners
// Import at top of file for browser compatibility
if (!window.showCancelGroupModal) {
    import('./cancel-group-modal.js').then(mod => {
        window.showCancelGroupModal = mod.showCancelGroupModal;
    });
}
const cancelBtns = container.querySelectorAll('.cancel-group-btn');
cancelBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const groupId = btn.getAttribute('data-group-id');
        // Find group in groups array
        const group = groups.find(g => String(g.id) === String(groupId));
        if (!group) return alert('Group not found');
        showCancelGroupModal(group, async () => {
    try {
        if (group.orders && group.orders.length > 0) {
            for (const order of group.orders) {
                await window.apiClient.put(`/orders/${order.id}`, { status: 'pending', group_id: null });
            }
        }
        // Always use group.id for API endpoint
        await window.apiClient.delete(`/order-groups/${group.id}`);

        // Remove from in-memory orderGroupsHistory
        const idx = orderGroupsHistory.findIndex(g => String(g.id) === String(group.id));
        if (idx !== -1) {
            orderGroupsHistory.splice(idx, 1);
        }
        // Remove from sessionStorage
        try {
            const storedGroups = JSON.parse(sessionStorage.getItem('orderGroupsHistory') || '[]');
            const newGroups = storedGroups.filter(g => String(g.id) !== String(group.id));
            sessionStorage.setItem('orderGroupsHistory', JSON.stringify(newGroups));
        } catch (e) {
            console.error('Error updating sessionStorage after group deletion:', e);
        }

        // Show notification instead of alert
        if (typeof showNotification === 'function') {
            showNotification('Order group cancelled and removed.', 'success');
        }
        // Refresh modal UI
        displayOrderGroupsModal(true, true);
        // Also refresh main order lists to reflect reverted statuses immediately
        if (typeof loadOrders === 'function') {
            loadOrders();
        }
    } catch (err) {
        if (typeof showNotification === 'function') {
            showNotification('Failed to cancel group: ' + (err?.message || err), 'error');
        } else {
            alert('Failed to cancel group: ' + (err?.message || err));
        }
    }
}, () => {/* do nothing on cancel */});
    });
});

        // Add event listeners to buttons
        attachOrderGroupActionListeners(container);
        
    } catch (error) {
        console.error('Error displaying order groups:', error);
        container.innerHTML = `<p class="error-message">Error loading order groups: ${error.message}</p>`;
    }
}

/**
 * Format timestamp for display
 * @param {string} timestamp - Timestamp string
 * @returns {string} - Formatted date string
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    try {
        const date = new Date(timestamp);
        // Format as DD/MM/YYYY HH:MM using UK locale, 24-hour clock, no seconds
        const formattedDate = date.toLocaleDateString('en-GB');
        const formattedTime = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return `${formattedDate} ${formattedTime}`;
    } catch (e) {
        return timestamp;
    }
}

/**
 * Get display timestamp for the last status change.
 * Falls back to order.timestamp if specific fields missing.
 * @param {Object} order - Order object
 * @returns {string} - Formatted date string or empty string
 */
function getStatusChangeTimestamp(order) {
    if (!order) return '';

    // Do not show timestamp for orders that have not yet changed status meaningfully
    // Only completed and cancelled orders should show a timestamp
    const status = (order.status || '').toLowerCase();
    if (status === 'pending' || status === 'in-progress' || status === 'processing' || status === 'unfulfilled') {
        return '';
    }

    // Prioritise the relevant status-change timestamps
    const ts =
        order.statusUpdatedAt ||
        order.completedAt ||
        order.cancelledAt ||
        order.processedAt ||
        order.updatedAt ||
        order.lastUpdated ||
        order.timestamp;

    return ts ? formatTimestamp(ts) : '';
}

/**
 * Attach event listeners to order group action buttons
 * @param {HTMLElement} container - Container element with order group elements
 */
function attachOrderGroupActionListeners(container) {
    // View notes buttons
    const viewNotesButtons = container.querySelectorAll('.view-notes-btn');
    viewNotesButtons.forEach(button => {
        button.addEventListener('click', () => {
            const orderId = button.getAttribute('data-order-id');
            if (orderId) {
                // Show order notes
                showOrderNotesModal(orderId);
            }
        });
    });
    
    // Mark complete buttons
    const completeButtons = container.querySelectorAll('.mark-complete-btn');
    completeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const orderId = button.getAttribute('data-order-id');
            if (orderId) {
                markOrderComplete(orderId, button);
            }
        });
    });
    
    // Change status buttons
    const statusButtons = container.querySelectorAll('.change-status-btn');
    console.log('Found change status buttons:', statusButtons.length);
    
    statusButtons.forEach((button, index) => {
        console.log(`Setting up listener for change status button ${index + 1}:`, button);
        // Remove any existing listeners to prevent duplicates
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', () => {
            console.log('Change status button clicked!');
            const orderId = newButton.getAttribute('data-order-id');
            console.log('Order ID from button:', orderId);
            if (orderId) {
                openChangeStatusModal(orderId);
            }
        });
    });
}

/**
 * Displays a modal with the notes for a specific order.
 * @param {string} orderId - The ID of the order whose notes are to be displayed.
 */
async function showOrderNotesModal(orderId) {
    const modal = document.getElementById('view-notes-modal');
    const orderIdSpan = document.getElementById('notes-order-id');
    const notesContentDiv = document.getElementById('order-notes-content');

    if (!modal || !orderIdSpan || !notesContentDiv) {
        console.error('Notes modal elements not found.');
        return;
    }

    // Find the order in the current order details cache or fetch it if necessary
    let order = currentOrderDetails.find(o => o.id === orderId);
    if (!order) {
        // Fallback: try to load from backend if not in cache
        try {
            const response = await window.apiClient.getOrder(orderId);
            order = response.order;
        } catch (error) {
            console.error('Failed to fetch order details for notes modal:', error);
            showNotification('Failed to load order notes.', 'error');
            return;
        }
    }

    if (!order) {
        notesContentDiv.innerHTML = '<p>Order not found.</p>';
        orderIdSpan.textContent = orderId;
        modal.classList.remove('hidden');
        modal.style.display = '';
        return;
    }

    orderIdSpan.textContent = orderId;
    let notesHtml = '';

    // Check for overall order notes
    if (order.notes && order.notes.trim().length > 0) {
        notesHtml += `<h4>Order Notes:</h4><p>${order.notes}</p>`;
    } else {
        notesHtml += `<p>No overall order notes.</p>`;
    }

    // Check for medication-specific notes
    if (order.medications && order.medications.length > 0) {
        order.medications.forEach(med => {
            if (med.notes && med.notes.trim().length > 0) {
                notesHtml += `<h4>${med.name || 'Medication'} Notes:</h4><p>${med.notes}</p>`;
            }
        });
    }

    if (notesHtml === '<p>No overall order notes.</p>') { // If only the default message is present
        notesHtml = '<p>No notes found for this order or its medications.</p>';
    }

    notesContentDiv.innerHTML = notesHtml;
    modal.classList.remove('hidden');
    modal.style.display = '';

    // Add event listener for closing the modal
    const closeButtons = modal.querySelectorAll('.modal-close, .modal-close-btn');
    closeButtons.forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        });
    });

    // Close other modals if open
    document.getElementById('order-detail-modal').classList.add('hidden');
    document.getElementById('order-detail-modal').style.display = 'none';
}

/**
 * Mark an order as complete
 * @param {string} orderId - Order ID
 * @param {HTMLElement} button - Button element that triggered the action
 */
async function markOrderComplete(orderId, button) {
    try {
        // Disable button to prevent multiple clicks
        button.disabled = true;
        button.textContent = 'Processing...';
        
        // Update order status to completed
        await updateGroupOrderStatuses([orderId], 'completed', 'Marked complete from order groups view');
        
        // Show success notification
        showNotification('Order marked as complete successfully', 'success');
        
        // Update button state
        button.textContent = 'Completed';
        
        // Update order in the UI
        const row = button.closest('tr');
        if (row) {
            const statusCell = row.querySelector('.status-cell');
            if (statusCell) {
                statusCell.innerHTML = `<div><span class="order-status status-completed">${formatStatusDisplay('completed')}</span></div><div class="timestamp">${formatTimestamp(new Date().toISOString())}</div>`;
            }
        }
    } catch (error) {
        console.error('Error marking order as complete:', error);
        showNotification('Failed to mark order as complete: ' + error.message, 'error');
        
        // Reset button
        button.disabled = false;
        button.textContent = 'Mark Complete';
    }
}

/**
 * Open change status modal for an order
 * @param {string} orderId - Order ID
 */
function openChangeStatusModal(orderId) {
    console.log('openChangeStatusModal called with ID:', orderId);
    
    // Don't open modal if no orderId is provided (prevents accidental opening)
    if (!orderId) {
        console.error('Cannot open status modal: No order ID provided');
        return;
    }
    
    // Get the modal element
    const modal = document.getElementById('change-status-modal');
    console.log('Modal element found:', modal);
    
    const orderIdInput = document.getElementById('status-order-id');
    const statusSelect = document.getElementById('order-status');
    const notesTextarea = document.getElementById('status-notes');
    
    console.log('Modal elements found:', {
        modal: !!modal,
        orderIdInput: !!orderIdInput,
        statusSelect: !!statusSelect,
        notesTextarea: !!notesTextarea
    });
    
    if (!modal || !orderIdInput || !statusSelect || !notesTextarea) {
        console.error('Change status modal elements not found');
        return;
    }
    
    // Set values on the form
    orderIdInput.value = orderId;
    console.log('Set order ID input value:', orderIdInput.value);
    
    // Clear the notes field
    notesTextarea.value = '';
    
    // Reset the status dropdown to show current status if we can find it
    try {
        const order = OrderManager.getOrderById(orderId);
        console.log('Current order found for status setting:', order);
        if (order && order.status) {
            statusSelect.value = order.status;
            console.log('Set status select to:', statusSelect.value);
        } else {
            statusSelect.value = 'pending';
            console.log('Set status select to default: pending');
        }
    } catch (err) {
        console.error('Error getting order status:', err);
        statusSelect.value = 'pending';
    }
    
    // Show the modal
    console.log('About to show modal - current classes:', modal.className);
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    console.log('Modal classes after showing:', modal.className);
    console.log('Modal display style:', modal.style.display);
    
    // Force repaint to ensure modal appears (fix for some browser issues)
    void modal.offsetWidth;
    
    // Add event listeners for confirming and cancelling
    // Remove old listeners first to prevent duplicates
    const confirmBtn = document.getElementById('confirm-status-change-btn');
    const closeButtons = modal.querySelectorAll('.modal-close, .modal-close-btn');
    
    console.log('Found confirm button:', confirmBtn);
    console.log('Found close buttons:', closeButtons.length);
    
    if (confirmBtn) {
        // Clone and replace to remove old listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        // Add new listener
        const refreshedBtn = document.getElementById('confirm-status-change-btn');
        console.log('Set up new confirm button:', refreshedBtn);
        refreshedBtn.addEventListener('click', () => {
            console.log('Confirm status change button clicked');
            confirmStatusChange();
        });
        
        // Make the button more visible and add a highlight effect
        refreshedBtn.style.boxShadow = '0 0 10px rgba(0, 123, 255, 0.5)';
        setTimeout(() => {
            refreshedBtn.style.boxShadow = 'none';
        }, 1000);
    }
    
    // Also add click listeners to close buttons
    closeButtons.forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', () => {
            console.log('Close button clicked');
            modal.classList.add('hidden');
            modal.style.display = 'none';
        });
    });
    
    // Ensure modal is shown by checking z-index and bringing it to the top
    modal.style.zIndex = '1050';
    
    console.log('Modal setup complete');
    
    // Check if modal is visible after a slight delay
    setTimeout(() => {
        const isVisible = modal.style.display === 'flex' && !modal.classList.contains('hidden');
        console.log('Is modal visible after timeout:', isVisible);
        console.log('Modal current styles:', {
            display: modal.style.display,
            classes: modal.className,
            zIndex: modal.style.zIndex,
            opacity: getComputedStyle(modal).opacity
        });
    }, 100);
}

/**
 * Confirm status change for an order
 */
async function confirmStatusChange() {
    console.log('confirmStatusChange function called');
    const modal = document.getElementById('change-status-modal');
    const orderIdInput = document.getElementById('status-order-id');
    const statusSelect = document.getElementById('order-status');
    const notesTextarea = document.getElementById('status-notes');
    const confirmBtn = document.getElementById('confirm-status-change-btn');
    
    console.log('Form elements found:', {
        orderIdInput: !!orderIdInput,
        statusSelect: !!statusSelect,
        notesTextarea: !!notesTextarea,
        confirmBtn: !!confirmBtn
    });
    
    if (!orderIdInput || !statusSelect || !notesTextarea || !confirmBtn) {
        console.error('Change status form elements not found');
        return;
    }
    
    const orderId = orderIdInput.value;
    const newStatus = statusSelect.value;
    const notes = notesTextarea.value;
    
    console.log('Status change details:', { orderId, newStatus, notes });
    
    if (!orderId || !newStatus) {
        showNotification('Order ID and status are required', 'error');
        return;
    }

    // Require notes for cancellation
    if (newStatus === 'cancelled' && !notes.trim()) {
        showNotification('Notes are required when cancelling an order.', 'error');
        return;
    }
    
    try {
        // Disable button to prevent multiple clicks
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Updating...';
        
        // Update order status
        console.log('Calling updateGroupOrderStatuses with:', [orderId], newStatus, notes);
        await updateGroupOrderStatuses([orderId], newStatus, notes);
        
        // Show success notification
        showNotification(`Order status updated to ${formatStatusDisplay(newStatus)}`, 'success');
        
        // Close modal
        modal.classList.add('hidden');
        modal.style.display = 'none';
        
        // Only refresh order groups if order groups modal is currently visible
        const orderGroupsModal = document.getElementById('order-groups-modal');
        if (orderGroupsModal && !orderGroupsModal.classList.contains('hidden') && orderGroupsModalUserRequested) {
            console.log('Refreshing order groups modal');
            // This is a refresh of already-visible order groups, so use forceRefresh=true
            displayOrderGroupsModal(true, false);
        }

        // Refresh the main order lists to reflect the status change
        console.log('Refreshing all orders');
        if (typeof loadOrders === 'function') {
            loadOrders();
        } else if (typeof fetchAllOrders === 'function') {
            // Fallback for contexts (e.g., ward-orders.js) where fetchAllOrders exists
            fetchAllOrders();
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification('Failed to update order status: ' + error.message, 'error');
    } finally {
        // Reset button
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Update Status';
    }
}

/**
 * Generate labels for an order
 * @param {string} orderId - Order ID
 */
function generateLabelsForOrder(orderId) {
    if (OrderManager) {
        const order = OrderManager.getOrderById(orderId);
        
        if (order) {
            if (order.type === 'patient') {
                // Redirect to label generator with pre-filled data
                const params = new URLSearchParams();
                
                // Patient data
                params.append('patient-name', order.patient.name);
                params.append('patient-dob', order.patient.dob);
                if (order.patient.nhsNumber) {
                    params.append('patient-nhs', order.patient.nhsNumber);
                }
                
                // Add first medication (could enhance to support multiple)
                if (order.medications.length > 0) {
                    const med = order.medications[0];
                    params.append('med-name', med.name);
                    if (med.form) params.append('med-form', med.form);
                    if (med.strength) params.append('med-strength', med.strength);
                    if (med.quantity) params.append('med-quantity', med.quantity);
                }
                
                // Open label generator in new tab
                window.open(`../../index.html?${params.toString()}`, '_blank');
            } else {
                alert('Label generation is only available for patient orders.');
            }
        }
    }
}
