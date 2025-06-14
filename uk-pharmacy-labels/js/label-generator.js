/**
 * Downtime Pharmacy Label Generator
 * Label Generator Module
 */

const LabelGenerator = {
    /**
     * Reference to the ShorthandCodes module
     * Moved to separate file for easier maintenance
     */
    
    /**
     * Initialize shorthand functionality
     */
    initShorthand() {
        const shorthandInput = document.getElementById('shorthand-input');
        const applyShorthandBtn = document.getElementById('apply-shorthand-btn');
        const dosageTextarea = document.getElementById('dosage');
        
        if (shorthandInput && applyShorthandBtn && dosageTextarea) {
            // Apply shorthand when button is clicked
            applyShorthandBtn.addEventListener('click', () => {
                const translatedText = this.translateShorthand(shorthandInput.value);
                if (translatedText) {
                    dosageTextarea.value = translatedText;
                    shorthandInput.value = '';
                }
            });
            
            // Apply shorthand when Enter key is pressed in the input field
            shorthandInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const translatedText = this.translateShorthand(shorthandInput.value);
                    if (translatedText) {
                        dosageTextarea.value = translatedText;
                        shorthandInput.value = '';
                    }
                }
            });
        }
    },
    
    /**
     * Translate shorthand text to full instructions
     * @param {string} shorthand - Shorthand text to translate
     * @returns {string} - Translated full text instructions
     */
    translateShorthand(shorthand) {
        if (!shorthand || shorthand.trim() === '') {
            return '';
        }
        
        // Trim for consistent processing
        const input = shorthand.trim();
        
        // Pre-process input to handle special formats
        // 1. Replace hyphens between codes with spaces (e.g., "1t-bd" becomes "1t bd")
        // 2. Preserve meaningful codes like "7/7" and numeric ranges
        // 3. Handle punctuation like commas after codes
        
        // First, preserve special patterns like "7/7" (days), "3/52" (weeks), etc.
        const preservePatterns = [
            { pattern: /(\d+)\/7/g, placeholder: '__DAYS__' },     // Days pattern (e.g., 7/7)
            { pattern: /(\d+)\/52/g, placeholder: '__WEEKS__' },   // Weeks pattern (e.g., 3/52)
            { pattern: /(\d+)\/12/g, placeholder: '__MONTHS__' },  // Months pattern (e.g., 6/12)
            { pattern: /(\d+)-(\d+)(t|c|p|d|ml)/g, placeholder: '__RANGE__' } // Dosage ranges (e.g., 1-2t)
        ];
        
        // Create a map to store original values
        const preservedValues = new Map();
        let processedInput = input;
        
        // Replace special patterns with placeholders to preserve them
        preservePatterns.forEach(({ pattern, placeholder }, index) => {
            processedInput = processedInput.replace(pattern, (match) => {
                const key = `${placeholder}_${index}_${Math.random().toString(36).substr(2, 5)}`;
                preservedValues.set(key, match);
                return key;
            });
        });
        
        // Now replace hyphens between potential codes with spaces
        // But be careful not to affect negative numbers or other valid uses of hyphens
        processedInput = processedInput.replace(/([a-z0-9])-((?![0-9])[a-z0-9])/gi, '$1 $2');
        
        // Restore preserved values
        preservedValues.forEach((value, key) => {
            processedInput = processedInput.replace(key, value);
        });
        
        // Check if we're dealing with a complex multi-part instruction with punctuation
        // e.g., "1t,bd" or "1t, bd" or "1t,bd,7/7"
        if (/[,;]/.test(processedInput)) {
            // Split the input by commas and semicolons, preserving the punctuation
            const segments = processedInput.split(/([,;])/).filter(s => s.trim());
            let result = '';
            
            // Process each segment and potential code
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i].trim();
                
                // Skip empty segments and isolated punctuation
                if (!segment || segment === ',' || segment === ';') {
                    continue;
                }
                
                // Try to translate the segment
                const translated = this._translateSingleComponent(segment);
                
                // Add to result with appropriate spacing and punctuation
                if (i > 0 && segments[i-1] && (segments[i-1] === ',' || segments[i-1] === ';')) {
                    // If the previous segment was punctuation, add it
                    result += segments[i-1] + ' ' + translated;
                } else if (result) {
                    // Otherwise just add with a space
                    result += ' ' + translated;
                } else {
                    // First segment
                    result = translated;
                }
            }
            
            return result || input; // Return original if no translation found
        }
        
        // For simpler cases without punctuation, just do the normal translation
        return this._translateSingleComponent(processedInput);
    },
    
    /**
     * Helper method to translate a single component of shorthand
     * @private
     * @param {string} component - The shorthand component to translate
     * @returns {string} - Translated component
     */
    _translateSingleComponent(component) {
        // Check if it's a direct match for a simple code
        const directMatch = ShorthandCodes.getFullText(component);
        if (directMatch) {
            return directMatch;
        }
        
        // Handle compound shorthand (e.g., "1t bd" = "Take ONE tablet TWICE a day")
        const parts = component.split(/\s+/);
        if (parts.length >= 2) {
            let result = '';
            
            // First part is usually dosage quantity
            const firstPart = ShorthandCodes.getFullText(parts[0]);
            if (firstPart) {
                result = firstPart;
            }
            
            // Second part is usually frequency
            const secondPart = ShorthandCodes.getFullText(parts[1]);
            if (secondPart) {
                result += result ? ' ' + secondPart : secondPart;
            }
            
            // Handle additional parts if present
            for (let i = 2; i < parts.length; i++) {
                const nextPart = ShorthandCodes.getFullText(parts[i]);
                if (nextPart) {
                    result += ' ' + nextPart;
                } else {
                    // If not a known shorthand, add as is
                    result += ' ' + parts[i];
                }
            }
            
            return result || component; // Return original if no translation found
        }
        
        // If no translation found, return original
        return component;
    },
    /**
     * Generate labels based on the form data
     * @param {Object} data - Form data
     * @returns {Array} - Array of HTML content for the labels
     */
    generateLabels(data) {
        // Check if content needs to be split across multiple labels
        const splitInfo = this.needsMultipleLabels(data);
        
        if (splitInfo.needsSplitting) {
            return this.generateSplitLabels(data, splitInfo);
        } else {
            return [this.generateSingleLabel(data)];
        }
    },

    /**
     * Check if content needs to be split across multiple labels
     * @param {Object} data - Form data
     * @returns {Object} - Object with details about what needs splitting and how
     */
    needsMultipleLabels(data) {
        // Calculate approximate content length
        const medicationLength = (data.medicationName || '').length + 
                               (data.medicationStrength || '').length + 
                               (data.medicationFormulation || '').length;
        const dosageLength = (data.dosageInstructions || '').length;
        const warningLength = (data.additionalInformation ? data.additionalInformation.length : 0);
        
        // Check combined content length for normal splitting
        const totalContentLength = dosageLength + warningLength;
        
        // Set very conservative thresholds to ensure instructions never overflow
        // As per client requirement: long instructions MUST be split across multiple labels
        const dosageThreshold = 60; // Very aggressive threshold for dosage instructions
        
        // Count the number of sentences in the dosage instructions
        const sentenceCount = (data.dosageInstructions || '').split('. ').length;
        
        // If dosage instructions exceed the threshold OR have multiple sentences, they should be split
        // This is key for ensuring instructions are properly split rather than truncated
        if (dosageLength > dosageThreshold || (dosageLength > 40 && sentenceCount > 1)) {
            return {
                needsSplitting: true,
                splitDosage: true, // Force splitting dosage
                splitWarnings: warningLength > 100 // Also split warnings if they're long
            };
        }
        
        // For shorter content with warnings, we still need to be careful
        const singleLabelThreshold = 150; // Much more conservative threshold
        
        // If total content is small enough, keep on one label
        if (totalContentLength <= singleLabelThreshold && dosageLength <= 60) {
            return {
                needsSplitting: false
            };
        }
        
        // For all other cases, we need to split content
        return {
            needsSplitting: true,
            splitDosage: dosageLength > 60,
            splitWarnings: warningLength > 100
        };
    },

    /**
     * Generate split labels for long content
     * @param {Object} data - Form data
        const medicationFull = `${data.medicationName || ''} ${medicationStrength}${data.medicationFormulation || ''}`;
        
        // Get warning text from additional information field (already includes standard warning if enabled)
        let warningText = data.additionalInformation || '';
        
        // Define constants for label generation
        const MAX_LINES_PER_LABEL = 3; // Number of lines per label for dosage
        const LINE_LENGTH = 35; // Optimal line length for pharmacy labels (dosage)
        
        // Process dosage instructions
        const dosageContent = data.dosageInstructions || '';
        
        // Create arrays to hold processed content
        const dosageLabels = [];
        const warningLabels = [];
        
        // Process dosage instructions
        if (dosageContent) {
            // Normalize all line breaks for consistent processing
            const normalizedContent = dosageContent.replace(/\r\n|\r/g, '\n');
            
            // Split the content into sentences for better readability
            // This regex splits on periods, question marks, and exclamation points followed by a space
            const sentences = normalizedContent.split(/([.!?]\s+)/).filter(s => s.trim());
            
            // Recombine the sentences with their punctuation
            const processedSentences = [];
            for (let i = 0; i < sentences.length; i += 2) {
                if (i + 1 < sentences.length) {
                    processedSentences.push(sentences[i] + sentences[i + 1].trim());
                } else {
                    processedSentences.push(sentences[i]);
                }
            }
            
            // Hard-wrap text to create discrete lines of approximately equal length
            const dosageLines = [];
            
            // Process each sentence and create visual lines
            for (const sentence of processedSentences) {
                if (sentence.trim() === '') continue; // Skip empty sentences
                
                // For very short sentences, use them as-is
                if (sentence.length <= LINE_LENGTH) {
                    dosageLines.push(sentence);
                    continue;
                }
                
                // For longer sentences, break them into visual lines
                const words = sentence.split(/\s+/);
                let currentLine = '';
                
                for (const word of words) {
                    // If this word would make the line too long, start a new line
                    // Exception: if this is the first word on the line, keep it regardless of length
                    if (currentLine && (currentLine + ' ' + word).length > LINE_LENGTH) {
                        dosageLines.push(currentLine); // Add completed line
                        currentLine = word; // Start new line with this word
                    } else {
                        // Add word to current line with appropriate spacing
                        currentLine = currentLine ? currentLine + ' ' + word : word;
                    }
                }
                
                // Add the final line if there's anything left
                if (currentLine) {
                    dosageLines.push(currentLine);
                }
            }
            
            // Group dosage lines into labels (approximately MAX_LINES_PER_LABEL per label)
            for (let i = 0; i < dosageLines.length; i += MAX_LINES_PER_LABEL) {
                const labelLines = dosageLines.slice(i, i + MAX_LINES_PER_LABEL);
                if (labelLines.length > 0) {
                    // Store the raw lines and their count for potential optimization later
                    dosageLabels.push({
                        content: labelLines.join('<br>'),
                        lineCount: labelLines.length
                    });
                }
            }
            
            // Process warnings separately
            if (warningText) {
                // Define a longer line length for warnings due to the smaller font size
                // Dosage font is 8.5pt, warning font is 5.5pt, so we scale approximately by that ratio
                const WARNING_LINE_LENGTH = Math.floor(LINE_LENGTH * 1.55); // About 54 characters per line
                const WARNING_LINES_PER_LABEL = MAX_LINES_PER_LABEL * 2; // Warnings can fit more lines per label
                
                // Normalize line breaks for consistent processing
                const normalizedWarning = warningText.replace(/\r\n|\r/g, '\n');
                const warningLines = [];
                
                // Split warnings into visual lines
                const warningWords = normalizedWarning.split(/\s+/);
                let currentLine = '';
                
                for (const word of warningWords) {
                    if (currentLine && (currentLine + ' ' + word).length > WARNING_LINE_LENGTH) {
                        warningLines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = currentLine ? currentLine + ' ' + word : word;
                    }
                }
                
                if (currentLine) {
                    warningLines.push(currentLine);
                }
                
                // Group warning lines into label chunks
                for (let i = 0; i < warningLines.length; i += WARNING_LINES_PER_LABEL) {
                    const labelLines = warningLines.slice(i, i + WARNING_LINES_PER_LABEL);
                    if (labelLines.length > 0) {
                        warningLabels.push({
                            content: labelLines.join('<br>'),
                            lineCount: labelLines.length
                        });
                    }
                }
            }
            
            // Helper function to calculate how many warning lines can fit in a dosage label
            // Each dosage line counts as 1 unit, each warning line counts as 0.5 units
            // Total units per label should not exceed 3 (equivalent to 3 dosage lines or 6 warning lines)
            const calculateAvailableWarningLines = (dosageLineCount) => {
                const totalUnits = 3; // Maximum units per label
                const usedUnits = dosageLineCount; // Each dosage line is 1 unit
                const remainingUnits = totalUnits - usedUnits;
                return Math.floor(remainingUnits * 2); // Each warning line is 0.5 units, so multiply by 2
            };
            
            // Decide if we can combine warnings with any dosage labels
            let firstLabelCombinesWarnings = false;
            let lastLabelCombinesWarnings = false;
            let warningsOnFirstLabel = 0; // How many warning labels to add to first dosage label
            let warningsOnLastLabel = 0;  // How many warning labels to add to last dosage label
            let firstWarningToShow = 0;   // Index of first standalone warning label
            
            // Check if there's room on dosage labels for warnings
            if (dosageLabels.length > 0 && warningLabels.length > 0) {
                // Try to add warnings to the first dosage label
                if (dosageLabels.length >= 1) {
                    const firstDosageLabel = dosageLabels[0];
                    const availableLines = calculateAvailableWarningLines(firstDosageLabel.lineCount);
                    
                    if (availableLines > 0 && warningLabels.length > 0) {
                        // Check which warning labels can fit on first dosage label
                        for (let i = 0; i < warningLabels.length; i++) {
                            if (warningLabels[i].lineCount <= availableLines) {
                                firstLabelCombinesWarnings = true;
                                warningsOnFirstLabel = 1;
                                firstWarningToShow = 1; // Skip first warning when showing standalone warnings
                                break;
                            }
                        }
                    }
                }
                
                // Also try to add warnings to the last dosage label (if different from first)
                if (dosageLabels.length > 1) {
                    const lastDosageLabel = dosageLabels[dosageLabels.length - 1];
                    const availableLines = calculateAvailableWarningLines(lastDosageLabel.lineCount);
                    
                    // If we already added a warning to the first label, start checking from the second warning
                    const startingWarningIndex = firstLabelCombinesWarnings ? 1 : 0;
                    
                    if (availableLines > 0 && warningLabels.length > startingWarningIndex) {
                        // Check which warning labels can fit on last dosage label
                        if (warningLabels[startingWarningIndex].lineCount <= availableLines) {
                            lastLabelCombinesWarnings = true;
                            warningsOnLastLabel = 1;
                            firstWarningToShow = startingWarningIndex + warningsOnLastLabel;
                        }
                    }
                }
            }
            
            // Calculate total number of labels
            // Total = dosage labels + warning labels - warnings that are combined with dosage labels
            const warningLabelsToSkip = warningsOnFirstLabel + warningsOnLastLabel;
            const totalLabels = dosageLabels.length + Math.max(0, warningLabels.length - warningLabelsToSkip);
            
            // Generate dosage labels first
            for (let i = 0; i < dosageLabels.length; i++) {
                const isFirstDosageLabel = i === 0;
                const isLastDosageLabel = i === dosageLabels.length - 1;
                const dosageLabel = dosageLabels[i];
                let mainContent;
                
                // First label with warnings
                if (isFirstDosageLabel && firstLabelCombinesWarnings && warningLabels.length > 0) {
                    mainContent = `
                        <div class="dosage-instructions">${dosageLabel.content}</div>
                        <div class="additional-info">${warningLabels[0].content}</div>
                    `;
                }
                // Last label with warnings (if not the same as first)
                else if (isLastDosageLabel && lastLabelCombinesWarnings && warningLabels.length > warningsOnFirstLabel) {
                    const warningIndex = firstLabelCombinesWarnings ? 1 : 0;
                    mainContent = `
                        <div class="dosage-instructions">${dosageLabel.content}</div>
                        <div class="additional-info">${warningLabels[warningIndex].content}</div>
                    `;
                }
                // Regular dosage label without warnings
                else {
                    mainContent = `<div class="dosage-instructions">${dosageLabel.content}</div>`;
                }
                
                labels.push(this.createLabelHtml({
                    medicationFull,
                    medicationQuantity: data.medicationQuantity,
                    mainContent: mainContent,
                    mainContentClass: 'content-wrapper',
                    labelNumber: i + 1,
                    totalLabels: totalLabels,
                    patientName: data.patientName,
                    date,
                    dispensary
                }));
            }
            
            // Then generate any remaining standalone warning labels
            // Skip warnings that were combined with dosage labels
            let standaloneWarningNumber = 1;
            for (let i = firstWarningToShow; i < warningLabels.length; i++) {
                const warningLabel = warningLabels[i];
                
                labels.push(this.createLabelHtml({
                    medicationFull,
                    medicationQuantity: data.medicationQuantity,
                    mainContent: `<div class="additional-info">${warningLabel.content}</div>`,
                    mainContentClass: 'content-wrapper',
                    labelNumber: dosageLabels.length + standaloneWarningNumber,
                    totalLabels: totalLabels,
                    patientName: data.patientName,
                    date,
                    dispensary
                }));
                
                standaloneWarningNumber++;
            }
            
            return labels;
        } 
        // If there was no dosage content, but we have warnings, create a label just for warnings
        else if (warningText) {
            // Process the warning text for a single label
            const WARNING_LINE_LENGTH = Math.floor(LINE_LENGTH * 1.55);
            const normalizedWarning = warningText.replace(/\r\n|\r/g, '\n');
            const warningLines = [];
            const warningWords = normalizedWarning.split(/\s+/);
            
            let currentLine = '';
            for (const word of warningWords) {
                if (currentLine && (currentLine + ' ' + word).length > WARNING_LINE_LENGTH) {
                    warningLines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = currentLine ? currentLine + ' ' + word : word;
                }
            }
            
            if (currentLine) {
                warningLines.push(currentLine);
            }
            
            // Create a single label with just warnings
            labels.push(this.createLabelHtml({
                medicationFull,
                medicationQuantity: data.medicationQuantity,
                mainContent: `<div class="additional-info">${warningLines.join('<br>')}</div>`,
                mainContentClass: 'content-wrapper',
                labelNumber: 1,
                totalLabels: 1,
                patientName: data.patientName,
                date,
                dispensary
            }));
            
            return labels;
        }
        
        // If we got here with no content at all, return a simple label with just medication info
        if (labels.length === 0) {
            labels.push(this.createLabelHtml({
                medicationFull,
                medicationQuantity: data.medicationQuantity,
                mainContent: '',
                mainContentClass: 'content-wrapper',
                labelNumber: 1,
                totalLabels: 1,
                patientName: data.patientName,
                date,
                dispensary
            }));
        }
        
        return labels;
    },

    /**
     * Create HTML for a single label in a multi-label set
     * @param {Object} options - Options for the label
     * @returns {string} - HTML content for the label
     */
    createLabelHtml(options) {
        const {
            medicationFull,
            medicationQuantity,
            mainContent,
            mainContentClass,
            labelNumber,
            totalLabels,
            patientName,
            date,
            dispensary
        } = options;
        
        return `
            <div class="label-content">
                <!-- Initial boxes for dispenser and checker -->
                <div class="initials-boxes">
                    <div class="initials-box"></div>
                    <div class="initials-box"></div>
                </div>
                
                <!-- Top Section: Medication info and main content -->
                <div class="label-top-section">
                    <!-- Row 1: Quantity, Medication Name, Strength, Formulation (ensure single line) -->
                    <div class="medication">
                        <div class="med-name single-line">${medicationQuantity ? `${medicationQuantity} ` : ''}${medicationFull}</div>
                    </div>
                    
                    <!-- Row 2: Main Content (Dosage or Warnings) -->
                    <div class="${mainContentClass}">
                        ${mainContent}
                    </div>
                </div>
                
                <!-- Bottom Section: Patient info and pharmacy details -->
                <div class="label-bottom-section">
                    <!-- Row 4: Patient Name, Date -->
                    <div class="patient-row">
                        <span class="patient-name">${patientName || ''}</span>
                        <span class="dispensing-date">${date}</span>
                    </div>
                    
                    <!-- Label Number at Bottom -->
                    <div class="split-label-info">
                        <span class="label-number">Label ${labelNumber} of ${totalLabels}</span>
                    </div>
                    
                    <!-- Bottom Row: Pharmacy Details -->
                    <div class="pharmacy-details">
                        ${dispensary.name}, ${dispensary.address}, Tel: ${dispensary.phone}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Generate a single label based on the form data
     * @param {Object} data - Form data
     * @returns {string} - HTML content for the label
     */
    generateLabel(data) {
        return this.generateSingleLabel(data);
    },

    /**
     * Generate a bag label with patient details
     * @param {Object} data - Form data with patient details
     * @returns {string} - HTML content for the bag label
     */
    generateBagLabel(data) {
        // Get dispensary information from the admin-managed hospital list
        const dispensary = DataManager.getDispensaryInfo(data.dispensaryLocation);
        
        // Format date of birth
        const dobDate = data.patientDOB ? new Date(data.patientDOB) : null;
        const dob = dobDate ? dobDate.toLocaleDateString('en-GB') : '';
        
        // Format dispensing date
        const dispensedDate = data.dateOfDispensing ? new Date(data.dateOfDispensing).toLocaleDateString('en-GB') : '';
        
        // Generate HTML for the bag label - compact format for small labels
        return `
            <div class="bag-label">
                <!-- Patient Information Section -->
                <div class="bag-label-patient-section">
                    <div class="bag-label-patient-name">${data.patientName || ''}</div>
                    <div class="bag-label-patient-details">
                        <div>DOB: ${dob}</div>
                        ${data.patientNHS ? `<div>NHS: ${data.patientNHS}</div>` : ''}
                    </div>
                    <div class="bag-label-patient-address">${data.patientAddress || ''}</div>
                </div>
                
                <!-- Dispensary Information -->
                <div class="bag-label-dispensary">
                    <div class="bag-label-date">Date: ${dispensedDate}</div>
                    <div class="bag-label-pharmacy">${dispensary.name}</div>
                    <div class="bag-label-pharmacy-details">${dispensary.address}${dispensary.postcode ? `, ${dispensary.postcode}` : ''}, Tel: ${dispensary.phone || 'N/A'}</div>
                </div>
            </div>
        `;
    },
    
    /**
     * Generate a single label based on the form data
     * @param {Object} data - Form data
     * @returns {string} - HTML content for the label
     */
    generateSingleLabel(data) {
        // Get dispensary information from the admin-managed hospital list
        const dispensary = DataManager.getDispensaryInfo(data.dispensaryLocation);
        
        // Format date
        const date = data.dateOfDispensing ? new Date(data.dateOfDispensing).toLocaleDateString('en-GB') : '';
        
        // Format medication name, strength and formulation
        const medicationStrength = data.medicationStrength ? `${data.medicationStrength} ` : '';
        const medicationFull = `${data.medicationName || ''} ${medicationStrength}${data.medicationFormulation || ''}`;
        
        // Check content length to prevent overflow
        const dosageLength = (data.dosageInstructions || '').length;
        const warningsLength = (data.additionalInformation || '').length;
        const totalContentLength = dosageLength + warningsLength;
        
        // If content is too long, we should split into multiple labels instead
        if (totalContentLength > 350) {
            return this.generateSplitLabels(data, { needsSplitting: true })[0];
        }
        
        // Generate HTML for the label
        return `
        <div class="label-content">
            <!-- Initial boxes for dispenser and checker -->
            <div class="initials-boxes">
                <div class="initials-box"></div>
                <div class="initials-box"></div>
            </div>
            
            <!-- Top Section: Medication info and main content -->
            <div class="label-top-section">
                <!-- Row 1: Quantity, Medication Name, Strength, Formulation (ensure single line) -->
                <div class="medication">
                    <div class="med-name single-line">${data.medicationQuantity ? `${data.medicationQuantity} ` : ''}${medicationFull}</div>
                </div>
                
                <!-- Row 2: Dosage Instructions (always in large font) -->
                <div class="dosage-instructions">
                    ${data.dosageInstructions || ''}
                </div>
                
                <!-- Row 3: Warnings and Additional Information (always in smaller font) -->
                ${data.additionalInformation ? `
                <div class="additional-info">
                    ${data.additionalInformation || ''}
                </div>` : ''}
            </div>
            
            <!-- Bottom Section: Patient info and pharmacy details -->
            <div class="label-bottom-section">
                <!-- Row 4: Patient Name, Date -->
                <div class="patient-row">
                    <span class="patient-name">${data.patientName || ''}</span>
                    <span class="dispensing-date">${date}</span>
                </div>
                
                <!-- Bottom Row: Pharmacy Details -->
                <div class="pharmacy-details">
                    ${dispensary.name}, ${dispensary.address}${dispensary.postcode ? `, ${dispensary.postcode}` : ''}, Tel: ${dispensary.phone || 'N/A'}
                </div>
            </div>
        </div>
        `;
    },
    
    /**
     * Format a date string to UK format (DD/MM/YYYY)
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date
     */
    formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },
    
    /**
     * Format NHS Number with spaces (e.g., 123 456 7890)
     * @param {string} nhsNumber 
     * @returns {string} Formatted NHS number
     */
    formatNHSNumber(nhsNumber) {
        if (!nhsNumber) return '';
        
        // Remove any non-digit characters
        const digits = nhsNumber.replace(/\D/g, '');
        
        // Format as XXX XXX XXXX
        if (digits.length === 10) {
            return `${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}`;
        }
        
        return nhsNumber; // Return original if not 10 digits
    },
    
    /**
     * Create a formatted medication string
     * @param {Object} data - The form data
     * @returns {string} Formatted medication string
     */
    formatMedication(data) {
        let result = data.medicationName;
        
        if (data.medicationStrength) {
            result += ` ${data.medicationStrength}`;
        }
        
        if (data.medicationForm) {
            result += ` ${data.medicationForm}`;
        }
        
        return result;
    },
    
    /**
     * Get standard UK medication warnings
     * @returns {string} HTML for standard warnings
     */
    getStandardWarnings() {
        return `
            <div class="warning">
                Keep out of the reach and sight of children.
            </div>
        `;
    },
    
    /**
     * Get HTML for dispensing and checking initials boxes
     * @returns {string} HTML for initials boxes
     */
    getInitialsBoxes() {
        return `
            <div class="initials-boxes">
                <div class="initials-box">
                    <div class="box-label">Disp</div>
                    <div class="box"></div>
                </div>
                <div class="initials-box">
                    <div class="box-label">Check</div>
                    <div class="box"></div>
                </div>
            </div>
        `;
    },
    /**
     * Generate a complete set of labels for printing on A4 page
     * @param {Object} data - The form data
     * @param {number} quantity - Number of labels to generate (max 24 per page)
     * @returns {string} - HTML for the A4 page of labels
     */
    generateLabelsForPrinting(data, quantity = 1) {
        // Ensure quantity is within limits (max 24 labels per A4 sheet)
        const labelCount = Math.min(quantity, 24);
        
        // Generate the single label HTML content
        const labelContent = this.generateLabel(data);
        
        // Create container for all labels
        let html = '<div class="print-labels-container">';
        
        // Add the required number of labels
        for (let i = 0; i < labelCount; i++) {
            html += `<div class="print-label uk-label">${labelContent}</div>`;
        }
        
        html += '</div>';
        
        return html;
    }
};
