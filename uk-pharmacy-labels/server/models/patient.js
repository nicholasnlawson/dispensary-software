/**
 * Patient Data Model
 * 
 * This module handles all patient data operations with automatic encryption
 * of sensitive fields for GDPR compliance.
 */
const { db } = require('../db/init');
const dbCrypto = require('../utils/db-crypto');
const logger = require('../utils/logger');

// Define which patient fields should be encrypted
const SENSITIVE_FIELDS = [
  'nhsNumber',
  'dateOfBirth',
  'patientName',
  'address',
  'postcode',
  'medicationDetails'
];

/**
 * Get patient by ID with automatic decryption of sensitive fields
 * @param {number} id - Patient ID
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Decrypted patient data
 */
const getPatientById = async (id, userId, ip) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM patients WHERE id = ?', [id], (err, row) => {
      if (err) {
        logger.logError(userId, err, { 
          action: 'GET_PATIENT', 
          patientId: id 
        }, ip);
        return reject(err);
      }
      
      if (!row) {
        return resolve(null);
      }
      
      // Log access to patient data
      logger.logDataAccess(userId, 'patient', id, {
        fields: 'all'
      }, ip);
      
      // Decrypt sensitive fields
      const decryptedPatient = dbCrypto.decryptRow(row, SENSITIVE_FIELDS);
      resolve(decryptedPatient);
    });
  });
};

/**
 * Create a new patient with automatic encryption of sensitive fields
 * @param {Object} patientData - Patient data object
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Created patient data (with ID)
 */
const createPatient = async (patientData, userId, ip) => {
  // Encrypt sensitive fields
  const encryptedPatient = dbCrypto.encryptRow(patientData, SENSITIVE_FIELDS);
  
  // Create query parts dynamically based on available fields
  const fields = Object.keys(encryptedPatient).join(', ');
  const placeholders = Object.keys(encryptedPatient).map(() => '?').join(', ');
  const values = Object.values(encryptedPatient);
  
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO patients (${fields}) VALUES (${placeholders})`,
      values,
      function(err) {
        if (err) {
          logger.logError(userId, err, { 
            action: 'CREATE_PATIENT',
            patientData: { ...patientData, nhsNumber: '[REDACTED]' }
          }, ip);
          return reject(err);
        }
        
        // Log patient creation
        logger.logDataModification(userId, 'patient', this.lastID, 'CREATE', {
          nhsNumber: '[REDACTED]' // Don't log actual NHS number
        }, ip);
        
        // Return created patient with ID
        resolve({ id: this.lastID, ...patientData });
      }
    );
  });
};

/**
 * Update patient data with automatic encryption of sensitive fields
 * @param {number} id - Patient ID
 * @param {Object} patientData - Patient data to update
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Updated patient data
 */
const updatePatient = async (id, patientData, userId, ip) => {
  // Encrypt sensitive fields
  const encryptedPatient = dbCrypto.encryptRow(patientData, SENSITIVE_FIELDS);
  
  // Create SET clause dynamically
  const setClause = Object.keys(encryptedPatient)
    .map(field => `${field} = ?`)
    .join(', ');
  
  const values = [...Object.values(encryptedPatient), id];
  
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE patients SET ${setClause} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          logger.logError(userId, err, { 
            action: 'UPDATE_PATIENT',
            patientId: id
          }, ip);
          return reject(err);
        }
        
        // Log patient update
        logger.logDataModification(userId, 'patient', id, 'UPDATE', {
          fields: Object.keys(patientData)
        }, ip);
        
        // Return updated patient data
        resolve({ id, ...patientData });
      }
    );
  });
};

/**
 * Delete patient data
 * @param {number} id - Patient ID
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<boolean>} - Success indicator
 */
const deletePatient = async (id, userId, ip) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM patients WHERE id = ?', [id], function(err) {
      if (err) {
        logger.logError(userId, err, { 
          action: 'DELETE_PATIENT',
          patientId: id
        }, ip);
        return reject(err);
      }
      
      // Log patient deletion
      logger.logDataModification(userId, 'patient', id, 'DELETE', {}, ip);
      
      resolve(this.changes > 0);
    });
  });
};

/**
 * Search for patients with automatic decryption of results
 * Note: This is a simple implementation. For production use with encrypted fields,
 * consider a more sophisticated search approach.
 * @param {Object} query - Search criteria
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Array>} - List of matching patients
 */
const searchPatients = async (query, userId, ip) => {
  // Build WHERE clause based on query fields that aren't sensitive
  // For encrypted fields, we'll need to retrieve all and filter in memory
  let whereClause = '1=1'; // Default to match all
  const params = [];
  
  // Only add non-sensitive fields to the SQL WHERE clause
  Object.keys(query).forEach(field => {
    if (!SENSITIVE_FIELDS.includes(field)) {
      whereClause += ` AND ${field} LIKE ?`;
      params.push(`%${query[field]}%`);
    }
  });
  
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM patients WHERE ${whereClause}`, params, (err, rows) => {
      if (err) {
        logger.logError(userId, err, { 
          action: 'SEARCH_PATIENTS',
          query
        }, ip);
        return reject(err);
      }
      
      // Log the search
      logger.logDataAccess(userId, 'patient', 'search', {
        criteria: query,
        resultCount: rows?.length || 0
      }, ip);
      
      // Decrypt all results
      const decryptedResults = rows.map(row => dbCrypto.decryptRow(row, SENSITIVE_FIELDS));
      
      // Filter by encrypted fields if needed
      const filteredResults = decryptedResults.filter(patient => {
        // Check each sensitive field in the query
        return Object.keys(query)
          .filter(field => SENSITIVE_FIELDS.includes(field))
          .every(field => {
            // If field is in sensitive fields and in the query
            return patient[field] && 
              patient[field].toString().toLowerCase()
                .includes(query[field].toString().toLowerCase());
          });
      });
      
      resolve(filteredResults);
    });
  });
};

module.exports = {
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  searchPatients,
  SENSITIVE_FIELDS
};
