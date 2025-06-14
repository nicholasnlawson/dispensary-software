/**
 * UK Pharmacy Back-Up Label Generator
 * Data Manager Module
 * Handles local data storage and retrieval
 */

const DataManager = {
    // Storage keys
    KEYS: {
        HOSPITAL_INFO: 'uk_pharmacy_hospital_info',
        PHARMACISTS: 'uk_pharmacy_pharmacists',
        PRESCRIPTION_HISTORY: 'uk_pharmacy_prescription_history',
        DISPENSARY_LOCATIONS: 'uk_pharmacy_dispensary_locations',
        CACHED_HOSPITALS: 'uk_pharmacy_cached_hospitals'
    },
    
    /**
     * Save hospital information to local storage
     * @param {Object} info - Hospital information object
     */
    saveHospitalInfo(info) {
        localStorage.setItem(this.KEYS.HOSPITAL_INFO, JSON.stringify(info));
    },
    
    /**
     * Get hospital information from local storage
     * @returns {Object|null} Hospital info or null if not set
     */
    getHospitalInfo() {
        const data = localStorage.getItem(this.KEYS.HOSPITAL_INFO);
        return data ? JSON.parse(data) : null;
    },
    
    /**
     * Get dispensary information based on selected location
     * @param {string} locationId - The selected location ID
     * @returns {Object} Dispensary information
     */
    getDispensaryInfo(locationId) {
        // First check if we have hospitals from the admin section
        const cachedHospitals = this.getCachedHospitals();
        
        if (cachedHospitals && cachedHospitals.length > 0) {
            // Try to find the hospital by ID
            const hospital = cachedHospitals.find(h => h.id.toString() === locationId.toString());
            if (hospital) {
                return {
                    name: hospital.name,
                    address: hospital.address,
                    postcode: hospital.postcode || 'Not specified',
                    phone: hospital.phone || 'Not specified'
                };
            }
        }
        
        // Fallback to hardcoded values if hospital not found
        const fallbackLocations = {
            'south-tyneside': {
                name: 'South Tyneside District Hospital',
                address: 'Harton Lane, South Shields',
                postcode: 'NE34 0PL',
                phone: '0191 4041000'
            }
        };
        
        return fallbackLocations['south-tyneside'];
    },
    
    /**
     * Fetch hospitals from the API and cache them locally
     * @returns {Promise<Array>} Promise resolving to array of hospitals
     */
    async fetchAndCacheHospitals() {
        try {
            const response = await window.apiClient.getAllHospitals();
            
            if (response.success && Array.isArray(response.hospitals)) {
                // Cache the hospitals locally
                localStorage.setItem(this.KEYS.CACHED_HOSPITALS, JSON.stringify(response.hospitals));
                return response.hospitals;
            } else {
                console.error('Error fetching hospitals:', response.message || 'Unknown error');
                return [];
            }
        } catch (error) {
            console.error('Error fetching hospitals:', error);
            return [];
        }
    },
    
    /**
     * Get cached hospitals from local storage
     * @returns {Array} Array of hospital objects
     */
    getCachedHospitals() {
        const data = localStorage.getItem(this.KEYS.CACHED_HOSPITALS);
        return data ? JSON.parse(data) : [];
    },
    
    /**
     * Add a pharmacist to the list of known pharmacists
     * @param {string} name - Pharmacist name
     */
    addPharmacist(name) {
        if (!name || name.trim() === '') return;
        
        const pharmacists = this.getPharmacists() || [];
        
        // Check if already exists to avoid duplicates
        if (!pharmacists.includes(name)) {
            pharmacists.push(name);
            localStorage.setItem(this.KEYS.PHARMACISTS, JSON.stringify(pharmacists));
        }
    },
    
    /**
     * Get the list of known pharmacists
     * @returns {Array} List of pharmacist names
     */
    getPharmacists() {
        const data = localStorage.getItem(this.KEYS.PHARMACISTS);
        return data ? JSON.parse(data) : [];
    },
    
    /**
     * Save a prescription to history
     * @param {Object} prescriptionData - The prescription data
     */
    savePrescriptionToHistory(prescriptionData) {
        // Don't store prescription history if required fields are missing
        if (!prescriptionData.patientName || !prescriptionData.medicationName) {
            return;
        }
        
        const history = this.getPrescriptionHistory();
        
        // Add timestamp and unique ID
        const prescription = {
            ...prescriptionData,
            timestamp: new Date().toISOString(),
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
        };
        
        // Add to history (most recent first)
        history.unshift(prescription);
        
        // Keep only the most recent 100 prescriptions
        const trimmedHistory = history.slice(0, 100);
        
        localStorage.setItem(this.KEYS.PRESCRIPTION_HISTORY, JSON.stringify(trimmedHistory));
    },
    
    /**
     * Get prescription history
     * @returns {Array} List of prescription records
     */
    getPrescriptionHistory() {
        const data = localStorage.getItem(this.KEYS.PRESCRIPTION_HISTORY);
        return data ? JSON.parse(data) : [];
    },
    
    /**
     * Get a specific prescription by ID
     * @param {string} id - Prescription ID
     * @returns {Object|null} Prescription data or null if not found
     */
    getPrescriptionById(id) {
        const history = this.getPrescriptionHistory();
        return history.find(item => item.id === id) || null;
    },
    
    /**
     * Export all data as a JSON file
     * This can be used for backup purposes
     */
    exportData() {
        const exportData = {
            hospitalInfo: this.getHospitalInfo(),
            pharmacists: this.getPharmacists(),
            prescriptionHistory: this.getPrescriptionHistory(),
            exportDate: new Date().toISOString()
        };
        
        // Create a download link
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `pharmacy-labels-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    },
    
    /**
     * Import data from a JSON file
     * @param {Object} importData - The data to import
     * @returns {boolean} Success or failure
     */
    importData(importData) {
        try {
            // Validate data structure
            if (!importData || typeof importData !== 'object') {
                return false;
            }
            
            // Import hospital info if valid
            if (importData.hospitalInfo && typeof importData.hospitalInfo === 'object') {
                this.saveHospitalInfo(importData.hospitalInfo);
            }
            
            // Import pharmacists if valid
            if (Array.isArray(importData.pharmacists)) {
                localStorage.setItem(this.KEYS.PHARMACISTS, JSON.stringify(importData.pharmacists));
            }
            
            // Import prescription history if valid
            if (Array.isArray(importData.prescriptionHistory)) {
                localStorage.setItem(this.KEYS.PRESCRIPTION_HISTORY, JSON.stringify(importData.prescriptionHistory));
            }
            
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    },
    
    /**
     * Clear all stored data
     * Warning: This will delete all data!
     */
    clearAllData() {
        if (confirm('WARNING: This will delete all hospital, pharmacist, and prescription data. This cannot be undone. Continue?')) {
            localStorage.removeItem(this.KEYS.HOSPITAL_INFO);
            localStorage.removeItem(this.KEYS.PHARMACISTS);
            localStorage.removeItem(this.KEYS.PRESCRIPTION_HISTORY);
            alert('All data has been cleared.');
            return true;
        }
        return false;
    }
};
