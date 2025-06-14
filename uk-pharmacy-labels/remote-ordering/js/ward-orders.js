/**
 * Remote Ordering System
 * Ward Orders Module
 * Handles the ward ordering interface functionality
 */

document.addEventListener('DOMContentLoaded', async () => {
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
 * Load and set current user information
 */
async function loadCurrentUser() {
    try {
        // Get the current user from the authentication system
        const response = await fetch('/api/auth/current-user');
        const userData = await response.json();
        
        if (userData && userData.success) {
            // Store user info in window object for easy access
            window.currentUser = userData.user;
            
            // Set hidden requester fields
            document.getElementById('requester-name').value = userData.user.name || '';
            document.getElementById('requester-role').value = userData.user.role || '';
            document.getElementById('ws-requester-name').value = userData.user.name || '';
            document.getElementById('ws-requester-role').value = userData.user.role || '';
            
            // Display user info in header if applicable
            const userInfoElement = document.getElementById('user-info');
            if (userInfoElement) {
                userInfoElement.textContent = `Logged in as: ${userData.user.name} (${userData.user.role})`;
            }
        } else {
            console.error('Failed to load user data');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
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
        // Load medications list
        const medsResponse = await fetch('/data/medications.json');
        let medicationsData = await medsResponse.json();
        
        // Load formulations
        const formsResponse = await fetch('/data/formulations.json');
        let formulationsData = await formsResponse.json();
        
        console.log(`Loaded ${medicationsData.length} medications and ${Object.keys(formulationsData).length} formulation categories`);
        
        // Setup autocomplete data
        window.medicationsData = medicationsData;
        window.formulationsData = formulationsData;
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
    }
}

/**
 * Setup medication name autocomplete
 * @param {HTMLInputElement} inputElement - Input element
 */
function setupMedicationAutocomplete(inputElement) {
    if (!inputElement || !window.medicationsData.length) return;
    
    // Create a simple autocomplete wrapper around the input
    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';
    inputElement.parentNode.insertBefore(wrapper, inputElement);
    wrapper.appendChild(inputElement);
    
    // Create the autocomplete dropdown
    const dropdownList = document.createElement('ul');
    dropdownList.className = 'autocomplete-list';
    wrapper.appendChild(dropdownList);
    
    // Show options based on input
    inputElement.addEventListener('input', () => {
        const value = inputElement.value.toLowerCase();
        dropdownList.innerHTML = '';
        
        if (value.length < 2) {
            dropdownList.style.display = 'none';
            return;
        }
        
        // Find matching medications
        const matches = window.medicationsData.filter(med => {
            if (typeof med === 'string') {
                return med.toLowerCase().includes(value);
            } else if (med.name) {
                return med.name.toLowerCase().includes(value);
            }
            return false;
        }).slice(0, 10); // Limit to 10 results
        
        if (matches.length > 0) {
            dropdownList.style.display = 'block';
            matches.forEach(med => {
                const item = document.createElement('li');
                item.textContent = typeof med === 'string' ? med : med.name;
                item.addEventListener('click', () => {
                    inputElement.value = item.textContent;
                    dropdownList.style.display = 'none';
                    
                    // Trigger change event to update related fields (e.g., formulation)
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
 * Setup formulation autocomplete
 * @param {HTMLInputElement} inputElement - Input element
 */
function setupFormulationAutocomplete(inputElement) {
    if (!inputElement || !Object.keys(window.formulationsData).length) return;
    
    // Create a simple autocomplete wrapper around the input
    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';
    inputElement.parentNode.insertBefore(wrapper, inputElement);
    wrapper.appendChild(inputElement);
    
    // Create the autocomplete dropdown
    const dropdownList = document.createElement('ul');
    dropdownList.className = 'autocomplete-list';
    wrapper.appendChild(dropdownList);
    
    // Show options based on input
    inputElement.addEventListener('input', () => {
        const value = inputElement.value.toLowerCase();
        dropdownList.innerHTML = '';
        
        if (value.length < 1) {
            dropdownList.style.display = 'none';
            return;
        }
        
        // Flatten the formulations data for searching
        let allFormulations = [];
        for (const category in window.formulationsData) {
            if (Array.isArray(window.formulationsData[category])) {
                allFormulations = [...allFormulations, ...window.formulationsData[category]];
            }
        }
        
        // Find matching formulations
        const matches = allFormulations
            .filter(form => form.toLowerCase().includes(value))
            .slice(0, 10); // Limit to 10 results
        
        if (matches.length > 0) {
            dropdownList.style.display = 'block';
            matches.forEach(form => {
                const item = document.createElement('li');
                item.textContent = form;
                item.addEventListener('click', () => {
                    inputElement.value = item.textContent;
                    dropdownList.style.display = 'none';
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
        const medications = [];
        const medicationItems = document.querySelectorAll('#medications-container .medication-item');
        let hasValidMedications = false;
        
        medicationItems.forEach((item) => {
            const nameInput = item.querySelector('.med-name');
            const formInput = item.querySelector('.med-form');
            const strengthInput = item.querySelector('.med-strength');
            const quantityInput = item.querySelector('.med-quantity');
            const notesInput = item.querySelector('.med-notes');
            
            if (nameInput && nameInput.value && quantityInput && quantityInput.value) {
                hasValidMedications = true;
                medications.push({
                    name: nameInput.value,
                    form: formInput ? formInput.value : '',
                    strength: strengthInput ? strengthInput.value : '',
                    quantity: quantityInput.value,
                    notes: notesInput ? notesInput.value : ''
                });
            }
        });
        
        if (!hasValidMedications) {
            alert('Please add at least one medication with name and quantity.');
            return;
        }
        
        // Create order object
        const orderData = {
            type: 'patient',
            ward: wardId,
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
        
        // Submit order using OrderManager
        if (OrderManager) {
            const order = OrderManager.createOrder(orderData);
            
            // Display confirmation and reset form
            alert(`Order ${order.id} submitted successfully!`);
            document.getElementById('patient-med-form').reset();
            
            // Reload recent orders
            loadRecentOrders();
            
            // Re-populate autocomplete fields for first medication
            setupMedicationAutocomplete(document.getElementById('med-name-1'));
            setupFormulationAutocomplete(document.getElementById('med-form-1'));
        } else {
            console.error('OrderManager not found');
            alert('Error submitting order. Please try again.');
        }
    } catch (error) {
        console.error('Error submitting patient order:', error);
        alert(`Error: ${error.message || 'Unknown error submitting order'}`);
    }
}

/**
 * Submit ward stock order
 */
function submitWardStockOrder() {
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
        const medications = [];
        const medicationItems = document.querySelectorAll('#ws-medications-container .medication-item');
        let hasValidMedications = false;
        
        medicationItems.forEach((item) => {
            const nameInput = item.querySelector('.med-name');
            const formInput = item.querySelector('.med-form');
            const strengthInput = item.querySelector('.med-strength');
            const quantityInput = item.querySelector('.med-quantity');
            
            if (nameInput && nameInput.value && quantityInput && quantityInput.value) {
                hasValidMedications = true;
                medications.push({
                    name: nameInput.value,
                    form: formInput ? formInput.value : '',
                    strength: strengthInput ? strengthInput.value : '',
                    quantity: quantityInput.value
                });
            }
        });
        
        if (!hasValidMedications) {
            alert('Please add at least one medication with name and quantity.');
            return;
        }
        
        // Create order object
        const orderData = {
            type: 'ward-stock',
            ward: wardId,
            medications: medications,
            requester: {
                name: requesterName,
                role: requesterRole
            },
            notes: orderNotes || ''
        };
        
        // Submit order using OrderManager
        if (OrderManager) {
            const order = OrderManager.createOrder(orderData);
            
            // Display confirmation and reset form
            alert(`Order ${order.id} submitted successfully!`);
            document.getElementById('ward-stock-med-form').reset();
            
            // Reload recent orders
            loadRecentOrders();
            
            // Re-populate autocomplete fields for first medication
            setupMedicationAutocomplete(document.getElementById('ws-med-name-1'));
            setupFormulationAutocomplete(document.getElementById('ws-med-form-1'));
        } else {
            console.error('OrderManager not found');
            alert('Error submitting order. Please try again.');
        }
    } catch (error) {
        console.error('Error submitting ward stock order:', error);
        alert(`Error: ${error.message || 'Unknown error submitting order'}`);
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
