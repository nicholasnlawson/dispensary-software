/**
 * Remote Ordering System
 * Pharmacy Supply Module
 * Handles the pharmacy supply interface functionality
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize order management
    initializeOrderFilters();
    loadOrders();
    updateStatistics();
    
    // Initialize panel functionality
    initializePanels();
});

/**
 * Initialize order filter controls
 */
function initializeOrderFilters() {
    const filterControls = [
        'filter-urgency',
        'filter-type',
        'filter-ward',
        'filter-status'
    ];
    
    filterControls.forEach(id => {
        const control = document.getElementById(id);
        if (control) {
            control.addEventListener('change', () => {
                loadOrders();
            });
        }
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
        ward: document.getElementById('filter-ward')?.value || 'all',
        status: document.getElementById('filter-status')?.value || 'all'
    };
}

/**
 * Load and display orders based on filters
 */
function loadOrders() {
    const ordersList = document.getElementById('orders-list');
    
    if (ordersList && OrderManager) {
        const filters = getFilters();
        const orders = OrderManager.getOrders(filters);
        
        if (orders.length > 0) {
            ordersList.innerHTML = '';
            
            orders.forEach(order => {
                const patientName = order.type === 'patient' ? order.patient.name : 'N/A';
                
                // Format timestamp
                const orderDate = new Date(order.timestamp);
                const formattedTime = orderDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                const formattedDate = orderDate.toLocaleDateString('en-GB');
                
                // Create order row
                const orderEl = document.createElement('div');
                orderEl.className = 'table-row';
                orderEl.dataset.orderId = order.id;
                orderEl.innerHTML = `
                    <div class="col col-id">${order.id}</div>
                    <div class="col col-time">${formattedTime}<br>${formattedDate}</div>
                    <div class="col col-ward">${order.ward}</div>
                    <div class="col col-type">${order.type === 'patient' ? 'Patient' : 'Ward Stock'}</div>
                    <div class="col col-urgency"><span class="status-${order.urgency}">${order.urgency}</span></div>
                    <div class="col col-patient">${patientName}</div>
                    <div class="col col-status"><span class="status-${order.status}">${order.status}</span></div>
                    <div class="col col-actions">
                        <button class="view-btn">View</button>
                    </div>
                `;
                
                // Add event listener for view button
                orderEl.querySelector('.view-btn').addEventListener('click', () => {
                    openOrderDetailsPanel(order.id);
                });
                
                ordersList.appendChild(orderEl);
            });
        } else {
            ordersList.innerHTML = '<p class="empty-state">No orders matching the selected filters</p>';
        }
    }
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

/**
 * Initialize panel functionality
 */
function initializePanels() {
    // Close buttons
    document.getElementById('close-panel-btn')?.addEventListener('click', () => {
        closePanel('order-details-panel');
    });
    
    document.getElementById('close-processing-btn')?.addEventListener('click', () => {
        closePanel('processing-panel');
    });
    
    // Process order button
    document.getElementById('process-order-btn')?.addEventListener('click', () => {
        const orderId = document.getElementById('order-details-panel').dataset.orderId;
        openProcessingPanel(orderId);
    });
    
    // Generate labels button
    document.getElementById('generate-labels-btn')?.addEventListener('click', () => {
        const orderId = document.getElementById('order-details-panel').dataset.orderId;
        generateLabelsForOrder(orderId);
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
    if (OrderManager) {
        const order = OrderManager.getOrderById(orderId);
        
        if (order) {
            const panel = document.getElementById('order-details-panel');
            const content = document.getElementById('order-details-content');
            
            // Set order ID for reference
            panel.dataset.orderId = orderId;
            
            // Format timestamp
            const orderDate = new Date(order.timestamp);
            const formattedDateTime = orderDate.toLocaleDateString('en-GB') + ' ' + 
                                    orderDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            
            // Build patient info if patient order
            let patientInfo = '';
            if (order.type === 'patient') {
                const patient = order.patient;
                patientInfo = `
                    <div class="details-section">
                        <h3>Patient Information</h3>
                        <p><strong>Name:</strong> ${patient.name}</p>
                        <p><strong>DOB:</strong> ${new Date(patient.dob).toLocaleDateString('en-GB')}</p>
                        <p><strong>NHS Number:</strong> ${patient.nhsNumber || 'Not provided'}</p>
                        <p><strong>Hospital ID:</strong> ${patient.hospitalId || 'Not provided'}</p>
                        <p><strong>Location:</strong> ${patient.location || 'Not specified'}</p>
                    </div>
                `;
            }
            
            // Build medications list
            let medicationsList = '';
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
            
            // Update content
            content.innerHTML = `
                <div class="order-header-details">
                    <h3>Order ${order.id} (${order.type === 'patient' ? 'Patient' : 'Ward Stock'})</h3>
                    <p><strong>Time:</strong> ${formattedDateTime}</p>
                    <p><strong>Ward:</strong> ${order.ward}</p>
                    <p><strong>Urgency:</strong> <span class="status-${order.urgency}">${order.urgency.toUpperCase()}</span></p>
                    <p><strong>Status:</strong> <span class="status-${order.status}">${order.status.toUpperCase()}</span></p>
                </div>
                
                ${patientInfo}
                
                <div class="details-section">
                    <h3>Medications (${order.medications.length})</h3>
                    <div class="medications-list">
                        ${medicationsList}
                    </div>
                </div>
                
                <div class="details-section">
                    <h3>Order Details</h3>
                    <p><strong>Requested By:</strong> ${order.requester.name} (${order.requester.role})</p>
                    ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
                </div>
                
                ${order.status === 'completed' ? `
                    <div class="details-section">
                        <h3>Processing Details</h3>
                        <p><strong>Completed:</strong> ${new Date(order.completedAt).toLocaleString('en-GB')}</p>
                        <p><strong>Supplied By:</strong> ${order.processedBy || 'Not recorded'}</p>
                        <p><strong>Checked By:</strong> ${order.checkedBy || 'Not recorded'}</p>
                        <p><strong>Processing Time:</strong> ${order.processingTime || 0} minutes</p>
                        ${order.processingNotes ? `<p><strong>Notes:</strong> ${order.processingNotes}</p>` : ''}
                    </div>
                ` : ''}
            `;
            
            // Update button states based on order status
            const processBtn = document.getElementById('process-order-btn');
            const labelsBtn = document.getElementById('generate-labels-btn');
            const rejectBtn = document.getElementById('reject-order-btn');
            
            if (processBtn && labelsBtn && rejectBtn) {
                if (order.status === 'completed') {
                    processBtn.disabled = true;
                    rejectBtn.disabled = true;
                } else {
                    processBtn.disabled = false;
                    rejectBtn.disabled = false;
                }
            }
            
            // Show panel
            panel.classList.remove('hidden');
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
 * Open processing panel for an order
 * @param {string} orderId - Order ID
 */
function openProcessingPanel(orderId) {
    if (OrderManager) {
        const order = OrderManager.getOrderById(orderId);
        
        if (order) {
            const panel = document.getElementById('processing-panel');
            const content = document.getElementById('medications-to-supply');
            
            // Set order ID for reference
            panel.dataset.orderId = orderId;
            
            // Build medications list with checkboxes
            let medicationsList = '';
            order.medications.forEach((med, index) => {
                medicationsList += `
                    <div class="medication-process-item">
                        <div class="med-check">
                            <input type="checkbox" id="med-check-${index}" class="med-checkbox" checked />
                        </div>
                        <div class="med-details">
                            <h4>${med.name}</h4>
                            <p>${med.strength || ''} ${med.form || ''}</p>
                            <p><strong>Quantity:</strong> ${med.quantity || 'Not specified'}</p>
                            ${med.notes ? `<p><strong>Notes:</strong> ${med.notes}</p>` : ''}
                        </div>
                        <div class="med-supply">
                            <label for="med-supplied-${index}">Supplied:</label>
                            <input type="text" id="med-supplied-${index}" class="med-supplied" value="${med.quantity || ''}" placeholder="Qty" />
                        </div>
                    </div>
                `;
            });
            
            // Update content
            content.innerHTML = medicationsList;
            
            // Clear previous input values
            document.getElementById('supplied-by').value = '';
            document.getElementById('checked-by').value = '';
            document.getElementById('supply-notes').value = '';
            
            // Show panel
            panel.classList.remove('hidden');
            
            // Hide details panel
            closePanel('order-details-panel');
        }
    }
}

/**
 * Complete order processing
 */
function completeOrderProcessing() {
    const panel = document.getElementById('processing-panel');
    const orderId = panel.dataset.orderId;
    
    if (orderId && OrderManager) {
        const suppliedBy = document.getElementById('supplied-by').value;
        const checkedBy = document.getElementById('checked-by').value;
        const notes = document.getElementById('supply-notes').value;
        
        if (!suppliedBy) {
            alert('Please enter who supplied this order.');
            return;
        }
        
        // Process the order
        const processingData = {
            suppliedBy,
            checkedBy,
            notes
        };
        
        const updatedOrder = OrderManager.processOrder(orderId, processingData);
        
        if (updatedOrder) {
            alert(`Order ${orderId} has been completed successfully.`);
            closePanel('processing-panel');
            loadOrders();
            updateStatistics();
        } else {
            alert('Error processing order. Please try again.');
        }
    }
}

/**
 * Save processing progress (not fully implemented)
 */
function saveProcessingProgress() {
    alert('Progress saving feature will be implemented in a future update.');
}

/**
 * Reject order (not fully implemented)
 * @param {string} orderId - Order ID
 */
function rejectOrder(orderId) {
    if (confirm('Are you sure you want to reject this order?')) {
        if (OrderManager && orderId) {
            const reason = prompt('Please provide a reason for rejection:');
            
            if (reason) {
                OrderManager.updateOrder(orderId, {
                    status: 'cancelled',
                    rejectionReason: reason,
                    rejectedAt: new Date().toISOString()
                });
                
                alert(`Order ${orderId} has been rejected.`);
                closePanel('order-details-panel');
                loadOrders();
                updateStatistics();
            }
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
