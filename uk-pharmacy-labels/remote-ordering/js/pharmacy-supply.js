/**
 * Remote Ordering System
 * Pharmacy Supply Module
 * Handles the pharmacy supply interface functionality
 * Fetches orders from backend API and displays them in the UI
 */

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
    const wardFilter = document.getElementById('filter-ward');
    if (wardFilter) {
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
 * Reject order
 * @param {string} orderId - Order ID
 */
function rejectOrder(orderId) {
    if (!orderId) return;
    
    if (confirm('Are you sure you want to reject this order?')) {
        const reason = prompt('Please enter a reason for rejection:');
        
        if (reason !== null) {
            // Show loading state
            const orderDetailsPanel = document.getElementById('order-details-panel');
            const content = document.getElementById('order-details-content');
            if (content) {
                content.innerHTML = '<div class="loading-indicator">Processing rejection...</div>';
            }
            
            // Send rejection to API using apiClient
            window.apiClient.post(`/orders/${orderId}/reject`, {
                reason: reason
            })
            .then(data => {
                if (data.success) {
                    alert('Order rejected successfully');
                    if (orderDetailsPanel) {
                        orderDetailsPanel.classList.add('hidden');
                    }
                    loadOrders(); // Refresh order list
                } else {
                    alert('Failed to reject order: ' + (data.message || 'Unknown error'));
                    if (content && orderDetailsPanel) {
                        // Reload the order details
                        openOrderDetailsPanel(orderId);
                    }
                }
            })
            .catch(error => {
                console.error('Error rejecting order:', error);
                alert('Error rejecting order: ' + error.message);
                if (content && orderDetailsPanel) {
                    // Reload the order details
                    openOrderDetailsPanel(orderId);
                }
            });
        }
    }
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
    content.innerHTML = createOrderDetailHTML(order);
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
 * @returns {string} - HTML string for modal content
 */
function createOrderDetailHTML(order) {
    console.log('[MODAL] createOrderDetailHTML called with order:', order);
    
    if (!order) {
        return '<p>No order data available</p>';
    }
    
    // Format timestamp
    const timestamp = new Date(order.timestamp).toLocaleString();
    
    // Format patient info section
    let patientInfo = '';
    if (order.patient) {
        // Handle different possible field names with more varied formats
        const patientName = order.patient.name || order.patient.patientName || 'Not provided';
        const nhsNumber = order.patient.nhsNumber || order.patient.nhs_number || order.patient.nhsId || 
                        order.patient.nhs || order.nhs_number || order.nhsNumber || order.nhsId || 'Not provided';
        const hospitalNumber = order.patient.hospitalNumber || order.patient.hospitalId || 
                            order.patient.hospital_number || order.patient.hospital_id || 
                            order.hospitalNumber || order.hospitalId || 'Not provided';
        const wardName = order.wardName || 'Not provided';
        
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
        const wardName = order.wardName || 'Not provided';
        
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
                <p><strong>Requester:</strong> ${order.requesterName || 'Unknown'}</p>
                ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
            </div>
        </div>
    `;
    
    return `
        <div class="order-detail-content">
            ${orderInfo}
            ${patientInfo}
            ${medicationsHTML}
        </div>
    `;
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
    
    // Setup history button if it exists
    if (historyBtn && order?.id) {
        console.log('[MODAL] Found history button, setting up event listener');
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
    const modal = document.getElementById('order-detail-modal');
    const closeBtn = document.querySelector('.modal-close');
    const closeModalBtn = document.querySelector('.modal-close-btn');
    
    // Close button in header
    if (closeBtn) {
        closeBtn.onclick = function() {
            modal.style.display = 'none';
        };
    }
    
    // Close button in footer
    if (closeModalBtn) {
        closeModalBtn.onclick = function() {
            modal.style.display = 'none';
        };
    }
    
    // Click outside modal
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
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
