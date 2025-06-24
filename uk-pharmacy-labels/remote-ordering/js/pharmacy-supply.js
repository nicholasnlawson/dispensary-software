/**
 * Remote Ordering System
 * Pharmacy Supply Module
 * Handles the pharmacy supply interface functionality
 * Fetches orders from backend API and displays them in the UI
 */

// Global variables
let orders = [];
let loading = false;
let selectedOrderId = null;
let wardFilter = null;
let currentOrder = null;
let isOrderInEditMode = false;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize order management
    initializeOrderFilters();
    loadWardOptions();
    loadOrders();
    
    // Initialize panel functionality
    initializePanels();
});

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
            loadOrders();
        });
    }
    
    // Initialize refresh button if present
    const refreshBtn = document.getElementById('refresh-orders-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
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
function getFilters() {
    return {
        urgency: document.getElementById('filter-urgency')?.value || 'all',
        type: document.getElementById('filter-type')?.value || 'all',
        wardId: document.getElementById('filter-ward')?.value || 'all',
        status: document.getElementById('filter-status')?.value || 'all'
    };
}

/**
 * Load orders with current filter parameters
 */
function loadOrders() {
    const ordersList = document.getElementById('orders-list');
    
    if (ordersList) {
        // Collect ward filter parameter
        const wardFilter = document.getElementById('filter-ward')?.value || '';
        
        // Build query parameters
        const queryParams = new URLSearchParams();
        if (wardFilter && wardFilter !== 'all') queryParams.append('wardId', wardFilter);
        
        // Include pending orders by default
        queryParams.append('status', 'pending');
        
        // Log API call for debugging
        const apiUrl = `/orders?${queryParams.toString()}`;
        console.log('Fetching orders with URL:', apiUrl, 'Ward filter:', wardFilter);
        
        // Show loading indicator
        ordersList.innerHTML = '<div class="loading-indicator">Loading orders...</div>';
        
        // Fetch orders from API using apiClient
        window.apiClient.get(apiUrl)
            .then(data => {
                console.log('API response:', data);
                if (data.success && data.orders) {
                    console.log('Orders count:', data.orders.length);
                    console.log('First order:', data.orders[0]);
                    
                    // Filter the orders client-side as well to ensure filtering works
                    let filteredOrders = data.orders;
                    if (wardFilter && wardFilter !== 'all') {
                        // Convert wardFilter to number for comparison with numeric wardId
                        const wardFilterNumber = parseInt(wardFilter, 10);
                        console.log('Converting ward filter to number:', wardFilter, '->', wardFilterNumber);
                        
                        filteredOrders = data.orders.filter(order => {
                            console.log('Comparing order wardId:', order.wardId, 'with filter number:', wardFilterNumber);
                            return order.wardId === wardFilterNumber;
                        });
                        console.log('Filtered orders count:', filteredOrders.length);
                    }
                    
                    displayOrders(filteredOrders, ordersList);
                } else {
                    ordersList.innerHTML = '<p class="empty-state">No orders found</p>';
                }
            })
            .catch(error => {
                console.error('Error fetching orders:', error);
                ordersList.innerHTML = '<p class="empty-state">Error loading orders</p>';
            });
    }
}

/**
 * Display orders in the table
 * @param {Array} orders - Array of order objects
 * @param {HTMLElement} container - Container element
 */
function displayOrders(orders, container) {
    // Clear container
    if (!orders || orders.length === 0) {
        container.innerHTML = '<p class="empty-state">No orders found</p>';
        return;
    }
    
    // Create orders table structure
    container.innerHTML = `
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
    
    // Create rows for each order
    orders.forEach(order => {
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
        let statusContent = `<span class="order-status status-${order.status}">${order.status.toUpperCase()}</span>`;
        
        // Create the table row
        const row = document.createElement('tr');
        row.className = 'order-row';
        row.dataset.orderId = order.id;
        
        if (order.status === 'cancelled') {
            row.classList.add('cancelled-order');
        }
        
        row.innerHTML = `
            <td class="order-id">
                <div>${order.id}</div>
                <div class="order-time">${formattedDate}</div>
            </td>
            <td class="patient-info">${patientInfo}</td>
            <td class="ward-info">${order.wardName || order.wardId}</td>
            <td class="medications-info">${medicationsList}</td>
            <td class="status-cell">
                ${statusContent}
            </td>
            <td class="requester-info">${requesterInfo}</td>
        `;
        
        // Make the entire row clickable
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            // Use the modal instead of the side panel
            showOrderDetails(order);
        });
        
        tableBody.appendChild(row);
    });
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
    
    // Fetch order details from API
    fetch(`/api/orders/${orderId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch order details');
            }
            return response.json();
        })
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
            } else {
                alert('Cancelling order...');
            }
            
            // Call API to cancel order with reason
            const response = await window.apiClient.cancelOrder(orderIdToCancel, reason);
            console.log('[CANCEL] API response:', response);
            
            if (response && response.success) {
                console.log('[CANCEL] Order cancelled successfully');
                if (typeof showToastNotification === 'function') {
                    showToastNotification('Order cancelled successfully', 'success');
                } else {
                    alert('Order cancelled successfully');
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
                } else {
                    alert(`Error cancelling order: ${response?.message || 'Unknown error'}`);
                }
            }
        }
        // Fallback if API client is not available
        else {
            console.log('[CANCEL] API client not available, performing local-only cancellation');
            if (typeof showToastNotification === 'function') {
                showToastNotification('Order marked as cancelled locally. Sync required.', 'warning');
                showToastNotification('Order cancelled successfully', 'success');
            } else {
                alert('Order cancelled successfully');
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
        } else {
            alert(`Error cancelling order: ${error.message || 'Unknown error'}`);
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
 * Format a field name for display
 * @param {string} fieldName - Raw field name
 * @returns {string} - Formatted field name
 */
function formatFieldName(fieldName) {
    return fieldName
        .replace(/([A-Z])/g, ' $1') // Insert spaces before capital letters
        .replace(/_/g, ' ') // Replace underscores with spaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
        .join(' ');
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
            console.log('[MODAL] Process button clicked');
            document.getElementById('order-detail-modal').style.display = 'none';
            openProcessingPanel(order.id);
        };
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
