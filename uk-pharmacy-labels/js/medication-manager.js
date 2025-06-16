/**
 * UK Pharmacy Back-Up Label Generator
 * Medication Manager Module
 * Handles medication autocomplete and warning labels
 */

const MedicationManager = {
    // Data storage
    medications: [],
    formulations: {},
    warningLabels: [],
    medicationWarnings: [],
    
    /**
     * Initialize the medication manager
     * Loads data from JSON files
     */
    async init() {
        try {
            // Load medication data
            let medications, formulations, warnings, medicationWarnings;
            
            try {
                // Try to load from data directory
                [medications, formulations, warnings, medicationWarnings] = await Promise.all([
                    this.fetchJSON('data/drug_aliases.json'),
                    this.fetchJSON('data/formulation_aliases.json'),
                    this.fetchJSON('data/bnf_labels.json'),
                    this.fetchJSON('data/drug_formulations_warnings.json')
                ]);
            } catch (e) {
                console.warn('Error loading from data directory, trying root directory:', e);
                
                // Try with root directory paths
                [medications, formulations, warnings, medicationWarnings] = await Promise.all([
                    this.fetchJSON('../drug_aliases.json'),
                    this.fetchJSON('../formulation_aliases.json'),
                    this.fetchJSON('../bnf_labels.json'),
                    this.fetchJSON('../drug_formulations_warnings.json')
                ]);
            }
            
            this.medications = medications || [];
            this.formulations = formulations || {};
            this.warningLabels = warnings?.cautionary_advisory_labels || [];
            this.medicationWarnings = medicationWarnings || [];
            
            console.log('Loaded medications:', this.medications.length);
            console.log('Loaded warning labels:', this.warningLabels.length);
            console.log('Loaded medication warnings:', this.medicationWarnings.length);
            
            // Initialize autocomplete
            this.initAutocomplete();
            
            console.log('Medication data loaded successfully');
        } catch (error) {
            console.error('Error loading medication data:', error);
            // Still initialize autocomplete with empty data
            this.initAutocomplete();
        }
    },
    
    /**
     * Fetch JSON data from a file
     * @param {string} url - URL of the JSON file
     * @returns {Promise<Object>} - Parsed JSON data
     */
    async fetchJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.statusText}`);
        }
        return response.json();
    },
    
    /**
     * Initialize autocomplete for medication and formulation inputs
     */
    initAutocomplete() {
        // Setup medication autocomplete
        const medicationInput = document.getElementById('med-name');
        if (medicationInput) {
            this.setupAutocomplete(medicationInput, this.getMedicationSuggestions.bind(this));
            medicationInput.addEventListener('change', this.updateWarningLabels.bind(this));
        }
        
        // Setup formulation autocomplete
        const formulationSelect = document.getElementById('med-form');
        if (formulationSelect) {
            // Replace select with input for autocomplete
            const formulationInput = document.createElement('input');
            formulationInput.type = 'text';
            formulationInput.id = 'med-form';
            formulationInput.placeholder = 'e.g., tablets, capsules, solution';
            formulationSelect.parentNode.replaceChild(formulationInput, formulationSelect);
            
            // Setup autocomplete
            this.setupAutocomplete(formulationInput, this.getFormulationSuggestions.bind(this));
            
            // Add event listeners for formulation changes
            formulationInput.addEventListener('change', () => {
                // Clear warnings and find new ones for the updated formulation
                this.updateWarningLabels();
            });
            
            // Also listen for input events to handle autocomplete selection
            formulationInput.addEventListener('input', () => {
                // Debounce to avoid too frequent updates
                clearTimeout(formulationInput._debounceTimer);
                formulationInput._debounceTimer = setTimeout(() => {
                    this.updateWarningLabels();
                }, 300);
            });
        }
    },
    
    /**
     * Setup autocomplete for an input element
     * @param {HTMLInputElement} inputElement - Input element to add autocomplete to
     * @param {Function} getSuggestions - Function to get suggestions based on input
     */
    setupAutocomplete(inputElement, getSuggestions) {
        // Create autocomplete container
        const autocompleteContainer = document.createElement('div');
        autocompleteContainer.className = 'autocomplete-container';
        
        // Create wrapper for positioning
        const wrapper = document.createElement('div');
        wrapper.className = 'autocomplete-wrapper';
        
        // Replace input with wrapper
        inputElement.parentNode.insertBefore(wrapper, inputElement);
        wrapper.appendChild(inputElement);
        wrapper.appendChild(autocompleteContainer);
        
        // Handle input events
        inputElement.addEventListener('input', () => {
            const value = inputElement.value.trim();
            if (value.length < 2) {
                autocompleteContainer.innerHTML = '';
                return;
            }
            
            const suggestions = getSuggestions(value);
            this.renderSuggestions(suggestions, autocompleteContainer, inputElement);
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!inputElement.contains(event.target) && !autocompleteContainer.contains(event.target)) {
                autocompleteContainer.innerHTML = '';
            }
        });
        
        // Handle input focus
        inputElement.addEventListener('focus', () => {
            const value = inputElement.value.trim();
            if (value.length >= 2) {
                const suggestions = getSuggestions(value);
                this.renderSuggestions(suggestions, autocompleteContainer, inputElement);
            }
        });
        
        // Handle keyboard navigation
        inputElement.addEventListener('keydown', (e) => {
            const items = autocompleteContainer.querySelectorAll('li');
            if (!items.length) return;
            
            const active = autocompleteContainer.querySelector('.active');
            let index = -1;
            
            if (active) {
                index = Array.from(items).indexOf(active);
            }
            
            // Down arrow
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                index = (index + 1) % items.length;
                this.setActiveItem(items, index);
            }
            
            // Up arrow
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                index = (index - 1 + items.length) % items.length;
                this.setActiveItem(items, index);
            }
            
            // Enter key
            else if (e.key === 'Enter' && active) {
                e.preventDefault();
                active.click();
            }
            
            // Escape key
            else if (e.key === 'Escape') {
                autocompleteContainer.innerHTML = '';
            }
        });
    },
    
    /**
     * Set active item in autocomplete list
     * @param {NodeList} items - List items
     * @param {number} index - Index of active item
     */
    setActiveItem(items, index) {
        items.forEach(item => item.classList.remove('active'));
        items[index].classList.add('active');
        items[index].scrollIntoView({ block: 'nearest' });
    },
    
    /**
     * Render suggestions in the autocomplete container
     * @param {Array} suggestions - List of suggestions
     * @param {HTMLElement} container - Container to render suggestions in
     * @param {HTMLInputElement} inputElement - Input element
     */
    renderSuggestions(suggestions, container, inputElement) {
        container.innerHTML = '';
        
        if (suggestions.length === 0) {
            return;
        }
        
        const ul = document.createElement('ul');
        ul.className = 'autocomplete-list';
        
        suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion;
            li.addEventListener('click', () => {
                inputElement.value = suggestion;
                container.innerHTML = '';
                inputElement.dispatchEvent(new Event('change'));
            });
            ul.appendChild(li);
        });
        
        container.appendChild(ul);
    },
    
    /**
     * Get medication suggestions based on input
     * @param {string} input - User input
     * @returns {Array} - List of medication suggestions
     */
    getMedicationSuggestions(input) {
        if (!input || input.trim() === '') {
            return [];
        }
        
        const lowercaseInput = input.toLowerCase().trim();
        const matches = [];
        
        // Search through medications and their aliases
        for (const med of this.medications) {
            const matchingAliases = [];
            let mainNameMatches = false;
            
            // Check medication name (main name)
            if (med.name.toLowerCase().includes(lowercaseInput)) {
                mainNameMatches = true;
                matchingAliases.push(med.name); // Add main name first
            }
            
            // Check all aliases
            for (const alias of med.aliases || []) {
                if (alias.toLowerCase().includes(lowercaseInput)) {
                    // Only add the alias if it's not the same as the main name (case insensitive comparison)
                    if (alias.toLowerCase() !== med.name.toLowerCase()) {
                        matchingAliases.push(alias);
                    }
                }
            }
            
            // If we found any matches for this medication, add them all to the results
            if (matchingAliases.length > 0) {
                // If the main name doesn't match, but an alias does, add the main name first to provide context
                if (!mainNameMatches && matchingAliases.length > 0) {
                    matches.push(med.name); // Add main name first
                }
                
                // Then add all matching aliases
                matches.push(...matchingAliases);
            }
        }
        
        // Return unique matches (max 20 - increased to accommodate more aliases)
        return [...new Set(matches)].slice(0, 20);
    },
    
    /**
     * Get formulation suggestions based on input
     * @param {string} input - User input
     * @returns {Array} - List of formulation suggestions
     */
    getFormulationSuggestions(input) {
        const lowercaseInput = input.toLowerCase();
        const matches = [];
        
        // Use formulations from the JSON file
        // Generate standardized formulation names from the categories
        const standardizedFormulations = Object.keys(this.formulations.formulations).map(category => {
            return category
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        });
        
        // Add standardized formulation names
        for (const formulation of standardizedFormulations) {
            if (formulation.toLowerCase().includes(lowercaseInput)) {
                matches.push(formulation);
            }
        }
        
        // Add all aliases from the JSON file
        for (const [category, aliases] of Object.entries(this.formulations.formulations)) {
            if (Array.isArray(aliases)) {
                for (const alias of aliases) {
                    if (alias.toLowerCase().includes(lowercaseInput)) {
                        matches.push(alias);
                    }
                }
            }
        }
        
        // Add specific formulations from drug warnings if available
        if (this.medicationWarnings && this.medicationWarnings.length > 0) {
            const uniqueFormulations = new Set();
            
            // Extract unique formulations from medication warnings
            this.medicationWarnings.forEach(med => {
                if (med.formulation && Array.isArray(med.formulation)) {
                    med.formulation.forEach(form => uniqueFormulations.add(form));
                }
            });
            
            // Add matching formulations to results
            for (const form of uniqueFormulations) {
                if (form.toLowerCase().includes(lowercaseInput)) {
                    matches.push(form);
                }
            }
        }
        
        // Return unique matches (max 15)
        return [...new Set(matches)].slice(0, 15);
    },
    
    /**
     * Process formulation categories recursively
     * @param {Object|Array} category - Category or array of formulations
     * @param {string} input - Lowercase input to match
     * @param {Array} matches - Array to add matches to
     */
    processFormulationCategory(category, input, matches) {
        // If it's an array, check each formulation
        if (Array.isArray(category)) {
            category.forEach(form => {
                if (typeof form === 'string' && form.toLowerCase().includes(input)) {
                    matches.push(form);
                }
            });
            return;
        }
        
        // If it's an object, process each property
        if (typeof category === 'object' && category !== null) {
            for (const key in category) {
                this.processFormulationCategory(category[key], input, matches);
            }
        }
    },
    
    /**
     * Check for recent medication orders for the current patient and medication
     * @returns {Promise<void>}
     */
    async checkRecentMedications() {
        const medicationName = document.getElementById('med-name').value.trim();
        if (!medicationName) return;
        
        // Get patient details
        const patientName = document.getElementById('patient-name')?.value.trim();
        const hospitalNumber = document.getElementById('patient-hospital-id')?.value.trim();
        const nhsNumber = document.getElementById('patient-nhs')?.value.trim();
        
        // Don't check if we don't have patient identifiers
        if (!patientName && !hospitalNumber && !nhsNumber) {
            this.clearRecentMedicationWarning();
            return;
        }
        
        try {
            // Call the API to check for recent orders
            const result = await window.apiClient.checkRecentMedications(
                { name: patientName, hospitalId: hospitalNumber, nhs: nhsNumber },
                [{ name: medicationName }]
            );
            
            // Display warning if recent orders found
            if (result && result.recentOrders && result.recentOrders.length > 0) {
                this.showRecentMedicationWarning(result.recentOrders);
            } else {
                this.clearRecentMedicationWarning();
            }
        } catch (error) {
            console.error('Error checking recent medications:', error);
            this.clearRecentMedicationWarning();
        }
    },
    
    /**
     * Show warning for recent medication orders
     * @param {Array} recentOrders - List of recent orders
     */
    showRecentMedicationWarning(recentOrders) {
        // Check if warning container already exists
        let warningContainer = document.getElementById('recent-med-warning');
        
        // Create warning container if it doesn't exist
        if (!warningContainer) {
            warningContainer = document.createElement('div');
            warningContainer.id = 'recent-med-warning';
            warningContainer.className = 'warning-container alert alert-warning';
            
            // Insert after the medication name input
            const medicationInput = document.getElementById('med-name');
            if (medicationInput && medicationInput.parentNode) {
                medicationInput.parentNode.insertBefore(
                    warningContainer, 
                    medicationInput.nextSibling
                );
            }
        }
        
        // Format warning message
        const order = recentOrders[0];
        const orderDate = new Date(order.timestamp);
        const formattedDate = orderDate.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        
        // Create warning content
        warningContainer.innerHTML = `
            <strong>⚠️ WARNING:</strong> This medication was ordered for this patient on 
            ${formattedDate} (${recentOrders.length > 1 ? recentOrders.length + ' orders' : '1 order'} 
            in the last 14 days).
        `;
    },
    
    /**
     * Clear recent medication warning
     */
    clearRecentMedicationWarning() {
        const warningContainer = document.getElementById('recent-med-warning');
        if (warningContainer) {
            warningContainer.remove();
        }
    },
    
    /**
     * Update warning labels based on selected medication and formulation
     */
    updateWarningLabels() {
        const medicationName = document.getElementById('med-name').value.trim();
        const formulation = document.getElementById('med-form').value.trim();
        const additionalInfoField = document.getElementById('additional-info');
        
        // Always clear existing warnings when updating
        if (additionalInfoField) {
            // If the field contains warnings, clear it completely
            // This ensures a fresh start for new formulation warnings
            const currentContent = additionalInfoField.value;
            if (this.warningLabels.some(label => currentContent.includes(label.text))) {
                additionalInfoField.value = '';
            }
        }
        
        // Check for recent medication orders for this patient/medication
        this.checkRecentMedications();
        
        // If we don't have both medication and formulation, just clear warnings and return
        if (!medicationName || !formulation) {
            return;
        }
        
        // Find matching warning labels
        const labelNumbers = this.findWarningLabels(medicationName, formulation);
        
        // Get the warning texts
        const warnings = this.getWarningTexts(labelNumbers);
        
        // Update the additional info field with warnings
        if (additionalInfoField && warnings.length > 0) {
            additionalInfoField.value = warnings.join('\n\n');
        }
    },
    
    /**
     * Standardize medication name based on drug aliases
     * @param {string} medicationName - Medication name to standardize
     * @returns {string} - Standardized medication name
     */
    standardizeMedicationName(medicationName) {
        if (!medicationName) return '';
        
        const normalizedMed = medicationName.toLowerCase().trim();
        
        // Early return if empty
        if (normalizedMed === '') return normalizedMed;
        
        // Find the medication entry that contains this as an alias
        for (const med of this.medications) {
            const aliases = med.aliases.map(alias => alias.toLowerCase().trim());
            
            // If this exact name is in aliases or is the main name
            if (aliases.includes(normalizedMed) || med.name.toLowerCase().trim() === normalizedMed) {
                return med.name.toLowerCase().trim();
            }
        }
        
        // If no match was found, return the original
        return normalizedMed;
    },
    
    /**
     * Find warning label numbers for a medication and formulation
     * @param {string} medicationName - Medication name
     * @param {string} formulation - Medication formulation
     * @returns {Array} - List of warning label numbers
     */
    findWarningLabels(medicationName, formulation) {
        // Normalize inputs
        const normalizedMed = medicationName.toLowerCase().trim();
        const normalizedForm = formulation.toLowerCase().trim();
        
        // Get standardized medication name and formulation
        const standardizedMed = this.standardizeMedicationName(normalizedMed);
        const standardizedForm = this.standardizeFormulation(normalizedForm);

        // Find all possible medication names that could match (including all aliases)
        const possibleMedNames = [normalizedMed, standardizedMed];
        
        // Add all aliases for the medication
        for (const med of this.medications) {
            const mainMedName = med.name.toLowerCase().trim();
            const aliases = med.aliases.map(alias => alias.toLowerCase().trim());
            
            // If the input is the main medication name or any of its aliases,
            // include the main medication name and all its aliases as possible matches
            if (mainMedName === normalizedMed || mainMedName === standardizedMed || 
                aliases.includes(normalizedMed) || aliases.includes(standardizedMed)) {
                possibleMedNames.push(mainMedName, ...aliases);
                break;
            }
        }
        
        // Find matching medication in warnings
        for (const med of this.medicationWarnings) {
            // Check if medication name matches
            const medNames = med.name.map(name => name.toLowerCase().trim());
            
            // Determine if there's a medication match using standard names and aliases
            const isMedMatch = medNames.some(name => {
                // Check against all possible medication names including aliases
                if (possibleMedNames.includes(name)) {
                    return true;
                }
                
                // Special handling for combination drugs with slashes
                if (name.includes('/')) {
                    // If this is a combination drug with a slash
                    const nameParts = name.split('/').map(part => part.trim());
                    
                    // If searching for a single drug, DO NOT match with combination drugs
                    // This fixes the issue where selecting a single component would match with combination medications
                    if (!normalizedMed.includes('/') && !standardizedMed.includes('/')) {
                        return false; // Single medications should not match with combination medications
                    }
                    
                    // For a combination drug search, require ALL parts to match
                    // (implementation of new requirements)
                    const searchParts = normalizedMed.includes('/') ? 
                        normalizedMed.split('/').map(part => part.trim()) : 
                        standardizedMed.split('/').map(part => part.trim());
                    
                    // Must have the same number of parts in the combination
                    if (searchParts.length !== nameParts.length) {
                        return false;
                    }
                    
                    // Check that ALL parts of the combination medication match
                    // This ensures both/all parts before and after the slash are required to match
                    const allPartsMatch = searchParts.every(searchPart => 
                        nameParts.some(namePart => 
                            searchPart === namePart || possibleMedNames.includes(namePart)
                        )
                    );
                    
                    return allPartsMatch;
                }
                
                // Check standardized versions of the warning medication name
                const standardizedWarningName = this.standardizeMedicationName(name);
                return possibleMedNames.includes(standardizedWarningName);
            });
            
            if (!isMedMatch) {
                continue;
            }
            
            // Check if formulation matches (using both original and standardized forms)
            const formulations = med.formulation.map(form => form.toLowerCase().trim());
            if (!formulations.some(form => 
                normalizedForm.includes(form) || 
                form.includes(normalizedForm) ||
                standardizedForm.includes(form) ||
                form.includes(standardizedForm) ||
                this.areFormulationsSimilar(form, normalizedForm)
            )) {
                continue;
            }
            
            // Return label numbers
            return med.label_number || [];
        }
        
        return [];
    },
    
    /**
     * Standardize formulation to handle aliases and synonyms
     * @param {string} formulation - Formulation to standardize
     * @returns {string} - Standardized formulation
     */
    standardizeFormulation(formulation) {
        if (!formulation) return '';
        
        const form = formulation.toLowerCase().trim();
        
        // Early return if empty
        if (form === '') return form;
        
        // Flattened structure - directly check each category
        for (const [category, aliases] of Object.entries(this.formulations.formulations)) {
            if (!Array.isArray(aliases)) continue;
            
            // Convert all aliases to lowercase for exact matching
            const lowerAliases = aliases.map(alias => alias.toLowerCase().trim());
            
            // Check for exact match or match with common variations
            if (lowerAliases.includes(form) || 
                // Also check plurals/singulars by adding/removing 's'
                (form.endsWith('s') && lowerAliases.includes(form.slice(0, -1))) ||
                (!form.endsWith('s') && lowerAliases.includes(form + 's'))) {
                
                // Return the standardized category name (convert underscores to spaces and capitalize first letters)
                return category
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            }
        }
        
        // If we get here, no match was found - return the original
        return form;
    },
    
    /**
     * Check if two formulations are similar enough to be considered a match
     * @param {string} form1 - First formulation
     * @param {string} form2 - Second formulation
     * @returns {boolean} - True if formulations are similar
     */
    areFormulationsSimilar(form1, form2) {
        if (!form1 || !form2) return false;
        
        const normalizedForm1 = form1.toLowerCase().trim();
        const normalizedForm2 = form2.toLowerCase().trim();
        
        // If they're exactly the same, return true immediately
        if (normalizedForm1 === normalizedForm2) return true;
        
        // Standardize both formulations
        const standardizedForm1 = this.standardizeFormulation(normalizedForm1);
        const standardizedForm2 = this.standardizeFormulation(normalizedForm2);
        
        // If standardization produced the same result, they're similar
        if (standardizedForm1 === standardizedForm2) {
            return true;
        }
        
        // Check if both forms appear in the same alias group - use exact matching
        for (const [category, aliases] of Object.entries(this.formulations.formulations)) {
            if (!Array.isArray(aliases)) continue;
            
            // Convert all aliases to lowercase for comparison
            const lowerAliases = aliases.map(alias => alias.toLowerCase().trim());
            
            // Check if both forms are in the same alias list (exact matches only)
            const form1Match = lowerAliases.includes(normalizedForm1) || 
                              (normalizedForm1.endsWith('s') && lowerAliases.includes(normalizedForm1.slice(0, -1))) || 
                              (!normalizedForm1.endsWith('s') && lowerAliases.includes(normalizedForm1 + 's'));
                
            const form2Match = lowerAliases.includes(normalizedForm2) || 
                              (normalizedForm2.endsWith('s') && lowerAliases.includes(normalizedForm2.slice(0, -1))) || 
                              (!normalizedForm2.endsWith('s') && lowerAliases.includes(normalizedForm2 + 's'));
            
            if (form1Match && form2Match) {
                return true;
            }
        }
        
        return false;
    },
    
    /**
     * Get warning texts for a list of label numbers
     * @param {Array} labelNumbers - List of warning label numbers
     * @returns {Array} - List of warning texts
     */
    getWarningTexts(labelNumbers) {
        const warnings = [];
        
        for (const labelNum of labelNumbers) {
            const label = this.warningLabels.find(l => l.label_number === labelNum);
            if (label) {
                warnings.push(label.text);
            }
        }
        
        return warnings;
    }
};
