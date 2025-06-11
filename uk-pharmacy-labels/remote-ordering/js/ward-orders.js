/**
 * Remote Ordering System
 * Ward Orders Module
 * Handles the ward ordering interface functionality
 */

document.addEventListener('DOMContentLoaded', () => {
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
 * Initialize tab switching functionality
 */
function initializeTabs() {
    const patientTab = document.getElementById('patient-tab');
    const wardStockTab = document.getElementById('ward-stock-tab');
    const patientForm = document.getElementById('patient-order-form');
    const wardStockForm = document.getElementById('ward-stock-form');
    
    if (patientTab && wardStockTab && patientForm && wardStockForm) {
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
    // Setup autocomplete for initial medication fields
    setupMedicationAutocomplete(document.getElementById('med-name-1'));
    setupFormulationAutocomplete(document.getElementById('med-form-1'));
    
    // Ward stock form
    setupMedicationAutocomplete(document.getElementById('ws-med-name-1'));
    setupFormulationAutocomplete(document.getElementById('ws-med-form-1'));
}

/**
 * Setup medication name autocomplete
 * @param {HTMLInputElement} inputElement - Input element
 */
function setupMedicationAutocomplete(inputElement) {
    if (inputElement && MedicationManager) {
        MedicationManager.setupAutocomplete(inputElement, MedicationManager.getMedicationSuggestions.bind(MedicationManager));
    }
}

/**
 * Setup formulation autocomplete
 * @param {HTMLInputElement} inputElement - Input element
 */
function setupFormulationAutocomplete(inputElement) {
    if (inputElement && MedicationManager) {
        MedicationManager.setupAutocomplete(inputElement, MedicationManager.getFormulationSuggestions.bind(MedicationManager));
    }
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
function submitPatientOrder() {
    // Collect form data
    const wardName = document.getElementById('ward-name').value;
    const urgency = document.getElementById('order-urgency').value;
    const patientName = document.getElementById('patient-name').value;
    const patientDob = document.getElementById('patient-dob').value;
    const patientNhs = document.getElementById('patient-nhs').value;
    const hospitalId = document.getElementById('hospital-id').value;
    const patientLocation = document.getElementById('patient-location').value;
    const requesterName = document.getElementById('requester-name').value;
    const requesterRole = document.getElementById('requester-role').value;
    const orderNotes = document.getElementById('order-notes').value;
    
    // Collect medications
    const medications = [];
    const medicationItems = document.querySelectorAll('#medications-container .medication-item');
    medicationItems.forEach((item, index) => {
        const nameInput = item.querySelector('.med-name');
        const formInput = item.querySelector('.med-form');
        const strengthInput = item.querySelector('.med-strength');
        const quantityInput = item.querySelector('.med-quantity');
        const notesInput = item.querySelector('.med-notes');
        
        if (nameInput && nameInput.value) {
            medications.push({
                name: nameInput.value,
                form: formInput ? formInput.value : '',
                strength: strengthInput ? strengthInput.value : '',
                quantity: quantityInput ? quantityInput.value : '',
                notes: notesInput ? notesInput.value : ''
            });
        }
    });
    
    // Create order object
    const orderData = {
        type: 'patient',
        ward: wardName,
        urgency: urgency,
        patient: {
            name: patientName,
            dob: patientDob,
            nhsNumber: patientNhs,
            hospitalId: hospitalId,
            location: patientLocation
        },
        medications: medications,
        requester: {
            name: requesterName,
            role: requesterRole
        },
        notes: orderNotes
    };
    
    // Submit order using OrderManager
    if (OrderManager) {
        const order = OrderManager.createOrder(orderData);
        
        // Display confirmation and reset form
        alert(`Order ${order.id} submitted successfully!`);
        document.getElementById('patient-med-form').reset();
        
        // Reload recent orders
        loadRecentOrders();
    } else {
        console.error('OrderManager not found');
        alert('Error submitting order. Please try again.');
    }
}

/**
 * Submit ward stock order
 */
function submitWardStockOrder() {
    // Collect form data
    const wardName = document.getElementById('ws-ward-name').value;
    const urgency = document.getElementById('ws-order-urgency').value;
    const requesterName = document.getElementById('ws-requester-name').value;
    const requesterRole = document.getElementById('ws-requester-role').value;
    const orderNotes = document.getElementById('ws-order-notes').value;
    
    // Collect medications
    const medications = [];
    const medicationItems = document.querySelectorAll('#ws-medications-container .medication-item');
    medicationItems.forEach((item, index) => {
        const nameInput = item.querySelector('.med-name');
        const formInput = item.querySelector('.med-form');
        const strengthInput = item.querySelector('.med-strength');
        const quantityInput = item.querySelector('.med-quantity');
        
        if (nameInput && nameInput.value) {
            medications.push({
                name: nameInput.value,
                form: formInput ? formInput.value : '',
                strength: strengthInput ? strengthInput.value : '',
                quantity: quantityInput ? quantityInput.value : ''
            });
        }
    });
    
    // Create order object
    const orderData = {
        type: 'ward-stock',
        ward: wardName,
        urgency: urgency,
        medications: medications,
        requester: {
            name: requesterName,
            role: requesterRole
        },
        notes: orderNotes
    };
    
    // Submit order using OrderManager
    if (OrderManager) {
        const order = OrderManager.createOrder(orderData);
        
        // Display confirmation and reset form
        alert(`Order ${order.id} submitted successfully!`);
        document.getElementById('ward-stock-med-form').reset();
        
        // Reload recent orders
        loadRecentOrders();
    } else {
        console.error('OrderManager not found');
        alert('Error submitting order. Please try again.');
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
 * Load and display recent orders
 */
function loadRecentOrders() {
    const recentOrdersList = document.getElementById('recent-orders-list');
    
    if (recentOrdersList && OrderManager) {
        // Get recent orders (last 5)
        const orders = OrderManager.getOrders().slice(0, 5);
        
        if (orders.length > 0) {
            recentOrdersList.innerHTML = '';
            
            orders.forEach(order => {
                const orderEl = document.createElement('div');
                orderEl.className = 'order-item';
                
                // Format timestamp
                const orderDate = new Date(order.timestamp);
                const formattedDate = orderDate.toLocaleDateString() + ' ' + orderDate.toLocaleTimeString();
                
                orderEl.innerHTML = `
                    <div class="order-header">
                        <span class="order-id">${order.id}</span>
                        <span class="order-time">${formattedDate}</span>
                    </div>
                    <div class="order-details">
                        <p>${order.type === 'patient' ? 'Patient: ' + order.patient.name : 'Ward Stock'}</p>
                        <p>Ward: ${order.ward}</p>
                        <p>Medications: ${order.medications.length}</p>
                    </div>
                    <span class="order-status status-${order.urgency}">${order.urgency.toUpperCase()}</span>
                    <span class="order-status status-${order.status}">${order.status.toUpperCase()}</span>
                `;
                
                recentOrdersList.appendChild(orderEl);
            });
        } else {
            recentOrdersList.innerHTML = '<p class="empty-state">No recent orders to display</p>';
        }
    }
}
