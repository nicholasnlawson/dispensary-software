/**
 * Admin Ward Management
 * 
 * Handles ward and hospital management in the admin panel
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check if user is authenticated and has full admin access (super-admin or admin)
  if (!AuthUtils.isAuthenticated() || !AuthUtils.hasFullAdminAccess()) {
    // If user is logged in but doesn't have full admin access, redirect to dashboard
    if (AuthUtils.isAuthenticated()) {
      window.location.href = '/dashboard.html';
    } else {
      window.location.href = '/login.html';
    }
    return;
  }

  // DOM Elements - Wards
  const wardsTableBody = document.getElementById('wards-table-body');
  const wardAlertBox = document.getElementById('ward-alert-box');
  const addWardBtn = document.getElementById('add-ward-btn');
  const wardModal = document.getElementById('ward-modal');
  const wardForm = document.getElementById('ward-form');
  const wardModalTitle = document.getElementById('ward-modal-title');
  const wardIdInput = document.getElementById('ward-id');
  const wardNameInput = document.getElementById('ward-name');
  const wardDescriptionInput = document.getElementById('ward-description');
  const wardHospitalSelect = document.getElementById('ward-hospital');
  const wardStatusGroup = document.getElementById('ward-status-group');
  const confirmDeleteWardModal = document.getElementById('confirm-delete-ward-modal');
  const deleteWardIdInput = document.getElementById('delete-ward-id');
  const confirmDeleteWardBtn = document.getElementById('confirm-delete-ward-btn');

  // DOM Elements - Hospitals
  const addHospitalBtn = document.getElementById('add-hospital-btn');
  const hospitalModal = document.getElementById('hospital-modal');
  const hospitalForm = document.getElementById('hospital-form');
  const hospitalModalTitle = document.getElementById('hospital-modal-title');
  const hospitalIdInput = document.getElementById('hospital-id');
  const hospitalNameInput = document.getElementById('hospital-name');
  const hospitalAddressInput = document.getElementById('hospital-address');
  const hospitalPostcodeInput = document.getElementById('hospital-postcode');
  const hospitalPhoneInput = document.getElementById('hospital-phone');
  const confirmDeleteHospitalModal = document.getElementById('confirm-delete-hospital-modal');
  const deleteHospitalIdInput = document.getElementById('delete-hospital-id');
  const confirmDeleteHospitalBtn = document.getElementById('confirm-delete-hospital-btn');

  // Close modal buttons
  const closeButtons = document.querySelectorAll('.close-btn, .close-modal');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      wardModal.style.display = 'none';
      hospitalModal.style.display = 'none';
      confirmDeleteWardModal.style.display = 'none';
      confirmDeleteHospitalModal.style.display = 'none';
    });
  });

  // Initialize
  loadWards();
  loadHospitals(); // This only populates the dropdown

  // Event Listeners
  addWardBtn.addEventListener('click', () => openAddWardModal());
  addHospitalBtn.addEventListener('click', () => openAddHospitalModal());
  wardForm.addEventListener('submit', handleWardFormSubmit);
  hospitalForm.addEventListener('submit', handleHospitalFormSubmit);
  confirmDeleteWardBtn.addEventListener('click', handleDeleteWard);
  confirmDeleteHospitalBtn.addEventListener('click', handleDeleteHospital);

  /**
   * Load all wards and display in table
   */
  async function loadWards() {
    try {
      const response = await window.apiClient.getAllWards();
      
      if (response.success) {
        displayWards(response.wards);
      } else {
        showAlert(wardAlertBox, 'Error loading wards', 'error');
      }
    } catch (error) {
      console.error('Error loading wards:', error);
      showAlert(wardAlertBox, 'Error loading wards: ' + error.message, 'error');
    }
  }

  /**
   * Display wards in the table
   * @param {Array} wards - List of wards
   */
  function displayWards(wards) {
    wardsTableBody.innerHTML = '';
    
    if (wards.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="5" class="empty-table">No wards found</td>`;
      wardsTableBody.appendChild(row);
      return;
    }
    
    wards.forEach(ward => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>${ward.name}</td>
        <td>${ward.description || '-'}</td>
        <td>${ward.hospital_name || 'No Hospital'}</td>
        <td>${ward.is_active ? '<span class="status-active">Active</span>' : '<span class="status-inactive">Inactive</span>'}</td>
        <td class="actions">
          <button class="btn btn-sm btn-edit" data-id="${ward.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-id="${ward.id}">Delete</button>
        </td>
      `;
      
      // Add event listeners to buttons
      const editBtn = row.querySelector('.btn-edit');
      const deleteBtn = row.querySelector('.btn-danger');
      
      editBtn.addEventListener('click', () => openEditWardModal(ward.id));
      deleteBtn.addEventListener('click', () => openDeleteWardModal(ward.id));
      
      wardsTableBody.appendChild(row);
    });
  }

  /**
   * Load all hospitals and populate select dropdown
   */
  async function loadHospitals() {
    try {
      const response = await window.apiClient.getAllHospitals();
      
      if (response.success) {
        populateHospitalDropdown(response.hospitals);
        displayHospitalsTable(response.hospitals); // Display hospitals in table
      } else {
        console.error('Error loading hospitals:', response.message);
        showAlert(wardAlertBox, 'Error loading hospitals', 'error');
      }
    } catch (error) {
      console.error('Error loading hospitals:', error);
      showAlert(wardAlertBox, 'Error loading hospitals: ' + error.message, 'error');
    }
  }

  /**
   * Populate hospital dropdown in ward form
   * @param {Array} hospitals - List of hospitals
   */
  function populateHospitalDropdown(hospitals) {
    // Clear existing options except the first one
    while (wardHospitalSelect.options.length > 1) {
      wardHospitalSelect.remove(1);
    }
    
    // Add hospital options
    hospitals.forEach(hospital => {
      const option = document.createElement('option');
      option.value = hospital.id;
      option.textContent = hospital.name;
      wardHospitalSelect.appendChild(option);
    });
  }

  /**
   * Open modal to add a new ward
   */
  function openAddWardModal() {
    wardModalTitle.textContent = 'Add New Ward';
    wardForm.reset();
    wardIdInput.value = '';
    wardStatusGroup.style.display = 'none'; // Hide status for new wards
    wardModal.style.display = 'block';
  }

  /**
   * Open modal to edit an existing ward
   * @param {number} wardId - Ward ID
   */
  async function openEditWardModal(wardId) {
    try {
      const response = await window.apiClient.getWardById(wardId);
      
      if (response.success) {
        const ward = response.ward;
        
        wardModalTitle.textContent = 'Edit Ward';
        wardIdInput.value = ward.id;
        wardNameInput.value = ward.name;
        wardDescriptionInput.value = ward.description || '';
        wardHospitalSelect.value = ward.hospital_id || '';
        
        // Set active status
        const activeRadio = document.querySelector('input[name="ward-is-active"][value="1"]');
        const inactiveRadio = document.querySelector('input[name="ward-is-active"][value="0"]');
        
        if (ward.is_active) {
          activeRadio.checked = true;
        } else {
          inactiveRadio.checked = true;
        }
        
        wardStatusGroup.style.display = 'block'; // Show status for existing wards
        wardModal.style.display = 'block';
      } else {
        showAlert(wardAlertBox, 'Error loading ward details', 'error');
      }
    } catch (error) {
      console.error('Error loading ward details:', error);
      showAlert(wardAlertBox, 'Error loading ward details: ' + error.message, 'error');
    }
  }

  /**
   * Open modal to confirm ward deletion
   * @param {number} wardId - Ward ID
   */
  function openDeleteWardModal(wardId) {
    deleteWardIdInput.value = wardId;
    confirmDeleteWardModal.style.display = 'block';
  }

  /**
   * Handle ward form submission (create or update)
   * @param {Event} event - Form submit event
   */
  async function handleWardFormSubmit(event) {
    event.preventDefault();
    
    const wardId = wardIdInput.value;
    const name = wardNameInput.value;
    const description = wardDescriptionInput.value;
    const hospitalId = wardHospitalSelect.value;
    
    // Get active status if editing existing ward
    let isActive = true;
    if (wardStatusGroup.style.display !== 'none') {
      const activeRadio = document.querySelector('input[name="ward-is-active"]:checked');
      isActive = activeRadio.value === '1';
    }
    
    const wardData = {
      name,
      description,
      hospital_id: hospitalId || null,
      is_active: isActive
    };
    
    try {
      let response;
      
      if (wardId) {
        // Update existing ward
        response = await window.apiClient.updateWard(wardId, wardData);
        if (response.success) {
          showAlert(wardAlertBox, 'Ward updated successfully', 'success');
        }
      } else {
        // Create new ward
        response = await window.apiClient.createWard(wardData);
        if (response.success) {
          showAlert(wardAlertBox, 'Ward created successfully', 'success');
        }
      }
      
      // Close modal and reload wards
      wardModal.style.display = 'none';
      loadWards();
    } catch (error) {
      console.error('Error saving ward:', error);
      showAlert(wardAlertBox, 'Error saving ward: ' + error.message, 'error');
    }
  }

  /**
   * Handle ward deletion
   */
  async function handleDeleteWard() {
    const wardId = deleteWardIdInput.value;
    
    try {
      const response = await window.apiClient.deleteWard(wardId);
      
      if (response.success) {
        showAlert(wardAlertBox, 'Ward deleted successfully', 'success');
        confirmDeleteWardModal.style.display = 'none';
        loadWards();
      } else {
        showAlert(wardAlertBox, 'Error deleting ward: ' + response.message, 'error');
      }
    } catch (error) {
      console.error('Error deleting ward:', error);
      showAlert(wardAlertBox, 'Error deleting ward: ' + error.message, 'error');
    }
  }

  /**
   * Open modal to add a new hospital
   */
  function openAddHospitalModal() {
    hospitalModalTitle.textContent = 'Add New Hospital';
    hospitalForm.reset();
    hospitalIdInput.value = '';
    hospitalModal.style.display = 'block';
  }

  /**
   * Open modal to edit an existing hospital
   * @param {number} hospitalId - Hospital ID
   */
  async function openEditHospitalModal(hospitalId) {
    try {
      const response = await window.apiClient.getHospitalById(hospitalId);
      
      if (response.success && response.hospital) {
        const hospital = response.hospital;
        
        // Set modal title
        hospitalModalTitle.textContent = 'Edit Hospital';
        
        // Populate form fields
        hospitalIdInput.value = hospital.id;
        hospitalNameInput.value = hospital.name;
        hospitalAddressInput.value = hospital.address || '';
        hospitalPostcodeInput.value = hospital.postcode || '';
        hospitalPhoneInput.value = hospital.phone || '';
        
        // Show modal
        hospitalModal.style.display = 'block';
      } else {
        showAlert(wardAlertBox, 'Error loading hospital details', 'error');
      }
    } catch (error) {
      console.error('Error loading hospital details:', error);
      showAlert(wardAlertBox, 'Error loading hospital details: ' + error.message, 'error');
    }
  }

  /**
   * Open modal to confirm hospital deletion
   * @param {number} hospitalId - Hospital ID
   */
  function openDeleteHospitalModal(hospitalId) {
    deleteHospitalIdInput.value = hospitalId;
    confirmDeleteHospitalModal.style.display = 'block';
  }

  /**
   * Handle hospital form submission (create or update)
   * @param {Event} event - Form submit event
   */
  async function handleHospitalFormSubmit(event) {
    event.preventDefault();
    
    const id = hospitalIdInput.value;
    const name = hospitalNameInput.value;
    const address = hospitalAddressInput.value;
    const postcode = hospitalPostcodeInput.value;
    const phone = hospitalPhoneInput.value;
    
    try {
      let response;
      
      if (id) {
        // Update existing hospital
        response = await window.apiClient.updateHospital(id, {
          name,
          address,
          postcode,
          phone
        });
        if (response.success) {
          showAlert(wardAlertBox, 'Hospital updated successfully', 'success');
        }
      } else {
        // Create new hospital
        response = await window.apiClient.createHospital({
          name,
          address,
          postcode,
          phone
        });
        if (response.success) {
          showAlert(wardAlertBox, 'Hospital created successfully', 'success');
        }
      }
      
      // Close modal and reload data
      hospitalModal.style.display = 'none';
      
      // Update UI
      updateHospitalsList(); // Update the hospitals list
      loadWards(); // Refresh wards list
      loadHospitals(); // Update the hospital dropdown
    } catch (error) {
      console.error('Error saving hospital:', error);
      showAlert(wardAlertBox, 'Error saving hospital: ' + error.message, 'error');
    }
  }

  /**
   * Handle hospital deletion
   */
  async function handleDeleteHospital() {
    const hospitalId = deleteHospitalIdInput.value;
    
    try {
      const response = await window.apiClient.deleteHospital(hospitalId);
      
      if (response.success) {
        showAlert(wardAlertBox, 'Hospital deleted successfully', 'success');
        confirmDeleteHospitalModal.style.display = 'none';
        
        // Update the UI by removing the deleted hospital
        const hospitalItem = document.querySelector(`.hospital-item[data-id="${hospitalId}"]`);
        if (hospitalItem) {
          hospitalItem.remove();
        }
        
        // Refresh wards list and hospital dropdown
        loadWards();
        loadHospitals(); // Just update the dropdown, not the hospitals list
      } else {
        showAlert(wardAlertBox, 'Error deleting hospital: ' + response.message, 'error');
      }
    } catch (error) {
      console.error('Error deleting hospital:', error);
      showAlert(wardAlertBox, 'Error deleting hospital: ' + error.message, 'error');
    }
  }

  /**
   * Show alert message
   * @param {HTMLElement} alertBox - Alert box element
   * @param {string} message - Alert message
   * @param {string} type - Alert type (success, error)
   */
  function showAlert(alertBox, message, type = 'success') {
    alertBox.textContent = message;
    alertBox.className = `alert ${type === 'success' ? 'alert-success' : 'alert-danger'}`;
    alertBox.style.display = 'block';
    
    // Hide alert after 5 seconds
    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 5000);
  }

  /**
   * Display hospitals in the table
   * @param {Array} hospitals - List of hospitals
   */
  function displayHospitalsTable(hospitals) {
    const hospitalsTableBody = document.getElementById('hospitals-table-body');
    if (!hospitalsTableBody) return;
    
    hospitalsTableBody.innerHTML = '';
    
    if (hospitals.length === 0) {
      hospitalsTableBody.innerHTML = '<tr><td colspan="3">No hospitals found</td></tr>';
      return;
    }
    
    hospitals.forEach(hospital => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${hospital.name}</td>
        <td>${hospital.address || 'No address'}</td>
        <td class="actions">
          <button class="btn btn-sm btn-secondary edit-hospital-btn" data-id="${hospital.id}">Edit</button>
          <button class="btn btn-sm btn-danger delete-hospital-btn" data-id="${hospital.id}">Delete</button>
        </td>
      `;
      
      // Add event listeners
      const editBtn = row.querySelector('.edit-hospital-btn');
      const deleteBtn = row.querySelector('.delete-hospital-btn');
      
      editBtn.addEventListener('click', () => openEditHospitalModal(hospital.id));
      deleteBtn.addEventListener('click', () => openDeleteHospitalModal(hospital.id));
      
      hospitalsTableBody.appendChild(row);
    });
  }




});
