/**
 * Ward Model
 * 
 * Handles database operations for wards and hospitals
 */
const { db } = require('../db/init');
const logger = require('../utils/logger');

/**
 * Get all wards with hospital information
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Array>} - List of wards with hospital info
 */
const getAllWards = async (userId, ip) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT w.id, w.name, w.description, w.is_active, w.created_at, w.updated_at,
              h.id as hospital_id, h.name as hospital_name
       FROM wards w
       LEFT JOIN hospitals h ON w.hospital_id = h.id
       ORDER BY h.name, w.name`,
      [],
      (err, wards) => {
        if (err) {
          logger.logError(userId, err, { action: 'GET_ALL_WARDS' }, ip);
          return reject(err);
        }
        
        // Log access
        logger.logDataAccess(userId, 'wards', 'all', { action: 'LIST' }, ip);
        resolve(wards);
      }
    );
  });
};

/**
 * Get ward by ID
 * @param {number} id - Ward ID
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Ward data with hospital info
 */
const getWardById = async (id, userId, ip) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT w.id, w.name, w.description, w.is_active, w.created_at, w.updated_at,
              h.id as hospital_id, h.name as hospital_name
       FROM wards w
       LEFT JOIN hospitals h ON w.hospital_id = h.id
       WHERE w.id = ?`,
      [id],
      (err, ward) => {
        if (err) {
          logger.logError(userId, err, { action: 'GET_WARD', wardId: id }, ip);
          return reject(err);
        }
        
        if (!ward) {
          return resolve(null);
        }
        
        // Log access
        logger.logDataAccess(userId, 'ward', id, { action: 'VIEW' }, ip);
        resolve(ward);
      }
    );
  });
};

/**
 * Create a new ward
 * @param {Object} wardData - Ward data object
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Created ward data
 */
const createWard = async (wardData, userId, ip) => {
  const { name, description, hospital_id, is_active } = wardData;
  
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO wards (name, description, hospital_id, is_active)
       VALUES (?, ?, ?, ?)`,
      [name, description || null, hospital_id || null, is_active === false ? 0 : 1],
      function(err) {
        if (err) {
          logger.logError(userId, err, { action: 'CREATE_WARD', wardData }, ip);
          return reject(err);
        }
        
        const wardId = this.lastID;
        
        // Log ward creation
        logger.logDataModification(userId, 'ward', wardId, 'CREATE', {
          name,
          hospital_id
        }, ip);
        
        // Get the created ward with hospital info
        getWardById(wardId, userId, ip)
          .then(ward => resolve(ward))
          .catch(err => reject(err));
      }
    );
  });
};

/**
 * Update an existing ward
 * @param {number} id - Ward ID
 * @param {Object} wardData - Ward data to update
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Updated ward data
 */
const updateWard = async (id, wardData, userId, ip) => {
  const { name, description, hospital_id, is_active } = wardData;
  
  return new Promise((resolve, reject) => {
    // First check if ward exists
    getWardById(id, userId, ip)
      .then(existingWard => {
        if (!existingWard) {
          return reject(new Error('Ward not found'));
        }
        
        // Build update query dynamically
        const updateFields = [];
        const updateParams = [];
        
        if (name !== undefined) {
          updateFields.push('name = ?');
          updateParams.push(name);
        }
        
        if (description !== undefined) {
          updateFields.push('description = ?');
          updateParams.push(description);
        }
        
        if (hospital_id !== undefined) {
          updateFields.push('hospital_id = ?');
          updateParams.push(hospital_id);
        }
        
        if (is_active !== undefined) {
          updateFields.push('is_active = ?');
          updateParams.push(is_active ? 1 : 0);
        }
        
        // Add updated_at timestamp
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        
        // Only update if there are fields to update
        if (updateFields.length > 0) {
          const query = `UPDATE wards SET ${updateFields.join(', ')} WHERE id = ?`;
          updateParams.push(id);
          
          db.run(query, updateParams, function(err) {
            if (err) {
              logger.logError(userId, err, { action: 'UPDATE_WARD', wardId: id, wardData }, ip);
              return reject(err);
            }
            
            // Log ward update
            logger.logDataModification(userId, 'ward', id, 'UPDATE', {
              name,
              hospital_id,
              is_active
            }, ip);
            
            // Get the updated ward
            getWardById(id, userId, ip)
              .then(ward => resolve(ward))
              .catch(err => reject(err));
          });
        } else {
          // No changes to make
          resolve(existingWard);
        }
      })
      .catch(err => reject(err));
  });
};

/**
 * Delete a ward
 * @param {number} id - Ward ID
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<boolean>} - Success status
 */
const deleteWard = async (id, userId, ip) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM wards WHERE id = ?', [id], function(err) {
      if (err) {
        logger.logError(userId, err, { action: 'DELETE_WARD', wardId: id }, ip);
        return reject(err);
      }
      
      if (this.changes === 0) {
        return resolve(false);
      }
      
      // Log ward deletion
      logger.logDataModification(userId, 'ward', id, 'DELETE', {}, ip);
      resolve(true);
    });
  });
};

/**
 * Get all hospitals
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Array>} - List of hospitals
 */
const getAllHospitals = async (userId, ip) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, name, address, postcode, phone, created_at, updated_at
       FROM hospitals
       ORDER BY name`,
      [],
      (err, hospitals) => {
        if (err) {
          logger.logError(userId, err, { action: 'GET_ALL_HOSPITALS' }, ip);
          return reject(err);
        }
        
        // Log access
        logger.logDataAccess(userId, 'hospitals', 'all', { action: 'LIST' }, ip);
        resolve(hospitals);
      }
    );
  });
};

/**
 * Get hospital by ID
 * @param {number} id - Hospital ID
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Hospital data
 */
const getHospitalById = async (id, userId, ip) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, name, address, postcode, phone, created_at, updated_at
       FROM hospitals
       WHERE id = ?`,
      [id],
      (err, hospital) => {
        if (err) {
          logger.logError(userId, err, { action: 'GET_HOSPITAL', hospitalId: id }, ip);
          return reject(err);
        }
        
        if (!hospital) {
          return resolve(null);
        }
        
        // Log access
        logger.logDataAccess(userId, 'hospital', id, { action: 'VIEW' }, ip);
        resolve(hospital);
      }
    );
  });
};

/**
 * Create a new hospital
 * @param {Object} hospitalData - Hospital data object
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Created hospital data
 */
const createHospital = async (hospitalData, userId, ip) => {
  const { name, address, postcode, phone } = hospitalData;
  
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO hospitals (name, address, postcode, phone)
       VALUES (?, ?, ?, ?)`,
      [name, address || null, postcode || null, phone || null],
      function(err) {
        if (err) {
          logger.logError(userId, err, { action: 'CREATE_HOSPITAL', hospitalData }, ip);
          return reject(err);
        }
        
        const hospitalId = this.lastID;
        
        // Log hospital creation
        logger.logDataModification(userId, 'hospital', hospitalId, 'CREATE', {
          name
        }, ip);
        
        // Get the created hospital
        getHospitalById(hospitalId, userId, ip)
          .then(hospital => resolve(hospital))
          .catch(err => reject(err));
      }
    );
  });
};

/**
 * Update an existing hospital
 * @param {number} id - Hospital ID
 * @param {Object} hospitalData - Hospital data to update
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Updated hospital data
 */
const updateHospital = async (id, hospitalData, userId, ip) => {
  const { name, address, postcode, phone } = hospitalData;
  
  return new Promise((resolve, reject) => {
    // First check if hospital exists
    getHospitalById(id, userId, ip)
      .then(existingHospital => {
        if (!existingHospital) {
          return reject(new Error('Hospital not found'));
        }
        
        // Build update query dynamically
        const updateFields = [];
        const updateParams = [];
        
        if (name !== undefined) {
          updateFields.push('name = ?');
          updateParams.push(name);
        }
        
        if (address !== undefined) {
          updateFields.push('address = ?');
          updateParams.push(address);
        }
        
        if (postcode !== undefined) {
          updateFields.push('postcode = ?');
          updateParams.push(postcode);
        }
        
        if (phone !== undefined) {
          updateFields.push('phone = ?');
          updateParams.push(phone);
        }
        
        // Add updated_at timestamp
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        
        // Only update if there are fields to update
        if (updateFields.length > 0) {
          const query = `UPDATE hospitals SET ${updateFields.join(', ')} WHERE id = ?`;
          updateParams.push(id);
          
          db.run(query, updateParams, function(err) {
            if (err) {
              logger.logError(userId, err, { action: 'UPDATE_HOSPITAL', hospitalId: id, hospitalData }, ip);
              return reject(err);
            }
            
            // Log hospital update
            logger.logDataModification(userId, 'hospital', id, 'UPDATE', {
              name,
              address
            }, ip);
            
            // Get the updated hospital
            getHospitalById(id, userId, ip)
              .then(hospital => resolve(hospital))
              .catch(err => reject(err));
          });
        } else {
          // No changes to make
          resolve(existingHospital);
        }
      })
      .catch(err => reject(err));
  });
};

/**
 * Delete a hospital
 * @param {number} id - Hospital ID
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<boolean>} - Success status
 */
const deleteHospital = async (id, userId, ip) => {
  return new Promise((resolve, reject) => {
    // First update any wards that reference this hospital
    db.run('UPDATE wards SET hospital_id = NULL WHERE hospital_id = ?', [id], (err) => {
      if (err) {
        logger.logError(userId, err, { action: 'UPDATE_WARDS_BEFORE_DELETE_HOSPITAL', hospitalId: id }, ip);
        return reject(err);
      }
      
      // Now delete the hospital
      db.run('DELETE FROM hospitals WHERE id = ?', [id], function(err) {
        if (err) {
          logger.logError(userId, err, { action: 'DELETE_HOSPITAL', hospitalId: id }, ip);
          return reject(err);
        }
        
        if (this.changes === 0) {
          return resolve(false);
        }
        
        // Log hospital deletion
        logger.logDataModification(userId, 'hospital', id, 'DELETE', {}, ip);
        resolve(true);
      });
    });
  });
};

module.exports = {
  getAllWards,
  getWardById,
  createWard,
  updateWard,
  deleteWard,
  getAllHospitals,
  getHospitalById,
  createHospital,
  updateHospital,
  deleteHospital
};
