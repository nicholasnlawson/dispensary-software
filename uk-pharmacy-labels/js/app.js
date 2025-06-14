/**
 * Downtime Pharmacy Label Generator
 * Main application file
 */

// Global array to store queued labels
let labelQueue = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize the application
    initApp();
    
    // Initialize the medication manager
    await MedicationManager.init();
    
    // Load hospitals from the admin section
    await loadHospitals();
    
    // Set current date as default for dispensed date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dispensed-date').value = today;
    
    // Event listeners
    document.getElementById('preview-btn').addEventListener('click', generatePreview);
    document.getElementById('add-to-queue-btn').addEventListener('click', addToQueue);
    document.getElementById('generate-bag-label-btn').addEventListener('click', generateBagLabel);
    document.getElementById('print-queue-btn').addEventListener('click', printQueue);
    document.getElementById('clear-queue-btn').addEventListener('click', clearQueue);
    document.getElementById('label-form').addEventListener('reset', clearPreview);
    document.getElementById('new-patient-btn').addEventListener('click', clearPatientDetails);
    
    // Initialize shorthand functionality when page loads
    LabelGenerator.initShorthand();
    
    // Register the service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    }
});

/**
 * Initialize the application
 */
function initApp() {
    // Check authentication and manage admin link visibility
    manageAuthUI();
}

/**
 * Load hospitals from the admin section and populate the dropdown
 */
async function loadHospitals() {
    try {
        console.log('Starting loadHospitals function');
        
        // Fetch hospitals from API and cache them
        const hospitals = await DataManager.fetchAndCacheHospitals();
        console.log('Fetched hospitals:', hospitals);
        
        // Get the dropdown element
        const dispensaryLocation = document.getElementById('dispensary-location');
        console.log('Dispensary location element:', dispensaryLocation);
        if (!dispensaryLocation) return;
        
        // Clear existing options
        dispensaryLocation.innerHTML = '';
        
        if (hospitals && hospitals.length > 0) {
            console.log('Using hospitals from database, count:', hospitals.length);
            // Add hospitals from the admin section
            hospitals.forEach(hospital => {
                console.log('Adding hospital to dropdown:', hospital);
                const option = document.createElement('option');
                option.value = hospital.id.toString();
                option.textContent = hospital.name;
                dispensaryLocation.appendChild(option);
            });
        } else {
            console.log('No hospitals found, using fallback options');
            // Fallback to hardcoded options if no hospitals found
            const defaultOptions = [
                { value: 'south-tyneside', text: 'South Tyneside District Hospital' },
                { value: 'sunderland-royal', text: 'Sunderland Royal Hospital' },
                { value: 'sunderland-eye', text: 'Sunderland Eye Infirmary' }
            ];
            
            defaultOptions.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.text;
                dispensaryLocation.appendChild(optionElement);
            });
            
            // Set default value
            dispensaryLocation.value = 'south-tyneside';
        }
        console.log('Final dropdown options:', dispensaryLocation.innerHTML);
    } catch (error) {
        console.error('Error loading hospitals:', error);
    }
}

/**
 * Manage authentication-related UI elements
 */
function manageAuthUI() {
    // Get the admin link element
    const adminLink = document.getElementById('admin-nav-link');
    if (adminLink) {
        // Only show admin link if user has admin role
        if (AuthUtils.isAuthenticated() && AuthUtils.hasRole('admin')) {
            adminLink.style.display = 'inline-block';
        } else {
            adminLink.style.display = 'none';
        }
    }
}

/**
 * Generate label preview based on form data
 */
function generatePreview() {
    // Get form data
    const formData = getFormData();
    
    // Generate label
    const labelContent = LabelGenerator.generateSingleLabel(formData);
    
    // Update preview
    const previewContainer = document.getElementById('preview-content');
    if (previewContainer) {
        previewContainer.innerHTML = labelContent;
        
        // Show message if content would be split across multiple labels when printed
        const labelPreviewSection = document.getElementById('label-preview');
        
        // Remove any existing warning
        const existingWarning = labelPreviewSection.querySelector('.split-label-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
        
        if (LabelGenerator.needsMultipleLabels(formData)) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'split-label-warning';
            warningDiv.textContent = 'Note: This content will be split across multiple labels when printed';
            labelPreviewSection.appendChild(warningDiv);
        }
    }
}

/**
 * Add a label to the queue
 */
function addToQueue() {
    // Get form data
    const formData = getFormData();
    
    // Validate form data
    if (!formData.medicationName) {
        alert('Please enter a medication name');
        return;
    }
    
    if (!formData.dosageInstructions) {
        alert('Please enter dosage instructions');
        return;
    }
    
    // Get number of labels to add (default to 1 if invalid)
    const numberOfLabels = formData.numberOfLabels || 1;
    
    // Add the label to the queue the specified number of times
    for (let i = 0; i < numberOfLabels; i++) {
        labelQueue.push({...formData});
    }
    
    // Update queue display
    updateQueueDisplay();
    
    // Provide feedback on how many labels were added
    if (numberOfLabels > 1) {
        alert(`${numberOfLabels} copies of this label have been added to the queue.`);
    }
    
    // Save patient details for reuse
    const patientName = document.getElementById('patient-name').value;
    const patientDOB = document.getElementById('patient-dob').value;
    const patientNHS = document.getElementById('patient-nhs').value;
    const patientAddress = document.getElementById('patient-address').value;
    
    // Clear only medication details
    clearMedicationDetails();
    clearPreview();
    
    // Restore patient details
    document.getElementById('patient-name').value = patientName;
    document.getElementById('patient-dob').value = patientDOB;
    document.getElementById('patient-nhs').value = patientNHS;
    document.getElementById('patient-address').value = patientAddress;
    
    // Set current date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dispensed-date').value = today;
}

/**
 * Update the queue display
 */
function updateQueueDisplay() {
    const queueContainer = document.getElementById('queue-container');
    
    // Clear container
    queueContainer.innerHTML = '';
    
    // Update count
    document.getElementById('queue-count').textContent = `(${labelQueue.length})`;
    
    // Enable/disable clear button
    document.getElementById('clear-queue-btn').disabled = labelQueue.length === 0;
    
    if (labelQueue.length === 0) {
        queueContainer.innerHTML = '<div class="queue-empty">No labels in queue</div>';
        return;
    }
    
    // Add labels to queue
    labelQueue.forEach((labelData, index) => {
        const listItem = document.createElement('div');
        listItem.className = labelData.isBagLabel ? 'queue-item bag-label' : 'queue-item';
        
        if (labelData.isBagLabel) {
            // Display bag label differently
            listItem.innerHTML = `
                <div class="queue-medication">${labelData.patientName}</div>
                <div class="queue-dosage">Bag Label</div>
                <div class="queue-patient">DOB: ${labelData.patientDOB ? new Date(labelData.patientDOB).toLocaleDateString('en-GB') : ''}</div>
                <button class="remove-btn" data-index="${index}">Remove</button>
            `;
        } else {
            // Regular medication label
            listItem.innerHTML = `
                <div class="queue-medication">${labelData.medicationName}${labelData.medicationStrength ? ` ${labelData.medicationStrength}` : ''} ${labelData.medicationFormulation || ''}</div>
                <div class="queue-dosage">${labelData.dosageInstructions || ''}</div>
                <div class="queue-patient">${labelData.patientName || ''}</div>
                <button class="remove-btn" data-index="${index}">Remove</button>
            `;
        }
        
        queueContainer.appendChild(listItem);
        
        // Add click event to remove button
        listItem.querySelector('.remove-btn').addEventListener('click', () => {
            removeFromQueue(index);
        });
    });
}

/**
 * Remove a label from the queue
 */
function removeFromQueue(index) {
    labelQueue.splice(index, 1);
    updateQueueDisplay();
}

/**
 * Clear the entire queue
 */
function clearQueue() {
    if (labelQueue.length === 0) return;
    
    if (confirm('Are you sure you want to clear all labels from the queue?')) {
        labelQueue = [];
        updateQueueDisplay();
    }
}

/**
 * Print all labels in the queue
 */
function printQueue() {
    if (labelQueue.length === 0) {
        alert('There are no labels in the queue to print');
        return;
    }
    
    // Ask user which label position to start from (1-24 on an A4 sheet)
    let startPosition = prompt('Enter the label number to start from (1-24):', '1');
    
    // Validate input
    startPosition = parseInt(startPosition);
    if (isNaN(startPosition) || startPosition < 1 || startPosition > 24) {
        alert('Please enter a valid number between 1 and 24');
        return;
    }
    
    // Create a print container if it doesn't exist
    let printContainer = document.getElementById('print-container');
    if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'print-container';
        document.body.appendChild(printContainer);
    }
    
    // Clear previous content
    printContainer.innerHTML = '';
    
    // Create a container for all the labels
    const labelsContainer = document.createElement('div');
    labelsContainer.className = 'print-labels-container';
    printContainer.appendChild(labelsContainer);
    
    // For tracking how many labels we've processed
    let labelCount = 0;
    
    // Create all the label elements first
    const labelElements = [];
    
    // Process each label in the queue
    labelQueue.forEach(labelData => {
        if (labelData.isBagLabel) {
            // Handle bag label differently - they have a completely different format
            const bagLabel = document.createElement('div');
            bagLabel.className = 'print-label';
            bagLabel.innerHTML = LabelGenerator.generateBagLabel(labelData);
            labelElements.push(bagLabel);
            labelCount++;
        } else if (LabelGenerator.needsMultipleLabels(labelData)) {
            // Create multiple medication labels
            const splitLabels = createSplitLabels(labelData);
            splitLabels.forEach(label => {
                labelElements.push(label);
                labelCount++;
            });
        } else {
            // Create a single medication label
            const label = createSingleLabel(labelData);
            labelElements.push(label);
            labelCount++;
        }
    });
    
    // Calculate grid positions for labels
    // Each A4 sheet has 3 columns and 8 rows (24 labels total)
    
    // Add empty placeholders for labels that are already used
    for (let i = 1; i < startPosition; i++) {
        const emptyLabel = document.createElement('div');
        emptyLabel.className = 'print-label empty-label';
        labelsContainer.appendChild(emptyLabel);
    }
    
    // Add the actual labels
    labelElements.forEach(label => {
        labelsContainer.appendChild(label);
    });
    
    // Position the print container off-screen during preparation
    printContainer.style.position = 'absolute';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '0';
    printContainer.style.display = 'block';
    
    // Give browser time to render before printing
    setTimeout(() => {
        // Print
        window.print();
        
        // Ask if queue should be cleared after printing
        if (confirm(`${labelCount} labels printed. Do you want to clear the queue?`)) {
            labelQueue = [];
            updateQueueDisplay();
        }
    }, 500);
}

/**
 * Create a single printed label
 * @param {Object} labelData - Data for the label
 * @returns {HTMLElement} - The label element
 */
function createSingleLabel(labelData) {
    // Create the label container
    const label = document.createElement('div');
    label.className = 'print-label uk-label';
    
    // Generate the label content based on type
    let content;
    if (labelData.isBagLabel) {
        content = LabelGenerator.generateBagLabel(labelData);
    } else {
        content = LabelGenerator.generateSingleLabel(labelData);
    }
    
    label.innerHTML = content;
    
    return label;
}

/**
 * Create multiple printed labels for split content
 * @param {Object} labelData - Data for the labels
 * @returns {Array} - Array of label elements
 */
function createSplitLabels(labelData) {
    const labels = [];
    
    // Generate all the label contents
    const contents = LabelGenerator.generateLabels(labelData);
    
    // Create a label element for each content
    contents.forEach(content => {
        const label = document.createElement('div');
        label.className = 'print-label uk-label';
        label.innerHTML = content;
        labels.push(label);
    });
    
    return labels;
}

/**
 * Clear the preview area
 */
function clearPreview() {
    const previewElement = document.getElementById('preview-content');
    previewElement.innerHTML = '<div class="preview-placeholder">Label preview will appear here</div>';
}

/**
 * Clear only medication details while preserving patient information
 */
function clearMedicationDetails() {
    // Clear medication fields
    document.getElementById('med-name').value = '';
    document.getElementById('med-form').value = 'tablets';
    document.getElementById('med-strength').value = '';
    document.getElementById('med-quantity').value = '';
    document.getElementById('dosage').value = '';
    document.getElementById('additional-info').value = '';
}

/**
 * Clear patient details when New Patient button is clicked
 */
function clearPatientDetails() {
    // Clear patient fields
    document.getElementById('patient-name').value = '';
    document.getElementById('patient-dob').value = '';
    document.getElementById('patient-nhs').value = '';
    document.getElementById('patient-address').value = '';
    
    // Also clear medication details
    clearMedicationDetails();
    
    // Clear preview
    clearPreview();
    
    // Focus on patient name field
    document.getElementById('patient-name').focus();
}

/**
 * Generate a bag label with patient details
 */
function generateBagLabel() {
    // Validate patient data
    const patientName = document.getElementById('patient-name').value;
    const patientDOB = document.getElementById('patient-dob').value;
    const patientAddress = document.getElementById('patient-address').value;
    
    if (!patientName) {
        alert('Please enter the patient name');
        return;
    }
    
    if (!patientDOB) {
        alert('Please enter the patient date of birth');
        return;
    }
    
    // Get form data for the bag label
    const formData = getFormData();
    
    // Generate bag label
    const labelContent = LabelGenerator.generateBagLabel(formData);
    
    // Update preview
    const previewContainer = document.getElementById('preview-content');
    if (previewContainer) {
        previewContainer.innerHTML = labelContent;
    }
    
    // Add to queue automatically
    labelQueue.push({
        ...formData,
        isBagLabel: true
    });
    
    // Update queue display
    updateQueueDisplay();
}

/**
 * Get all form data as an object
 */
function getFormData() {
    // Get the standard warning option
    const includeStandardWarning = document.getElementById('standard-warning').checked;
    
    // Get additional information
    let additionalInfo = document.getElementById('additional-info').value;
    
    // Add standard warning to the beginning of additional information if checked
    return {
        // Patient details
        patientName: document.getElementById('patient-name').value.trim(),
        patientDOB: document.getElementById('patient-dob').value,
        patientNHS: document.getElementById('patient-nhs').value.trim(),
        patientAddress: document.getElementById('patient-address').value.trim(),
            
        // Medication details
        medicationName: document.getElementById('med-name').value.trim(),
        medicationFormulation: document.getElementById('med-form').value,
        medicationStrength: document.getElementById('med-strength').value.trim(),
        medicationQuantity: document.getElementById('med-quantity').value.trim(),
            
        // Number of labels to generate
        numberOfLabels: parseInt(document.getElementById('number-of-labels').value) || 1,
            
        // Dosage instructions
        dosageInstructions: document.getElementById('dosage').value.trim(),
        additionalInformation: document.getElementById('additional-info').value.trim(),
        standardWarning: document.getElementById('standard-warning').checked,
            
        // Dispensing details
        dateOfDispensing: document.getElementById('dispensed-date').value,
        dispensaryLocation: document.getElementById('dispensary-location').value,
        showInitials: document.getElementById('show-initials').checked
    };
}