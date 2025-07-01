/**
 * Dispensary Model
 *
 * Handles database operations for dispensaries
 */
const { db } = require('../db/init');
const logger = require('../utils/logger');

/**
 * Get all dispensaries with hospital information
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Array>} - List of dispensaries with hospital info
 */
const getAllDispensaries = async (userId, ip) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT d.id, d.name, d.description, d.hospital_id, d.created_at, d.updated_at,
              h.name as hospital_name
       FROM dispensaries d
       LEFT JOIN hospitals h ON d.hospital_id = h.id
       ORDER BY h.name, d.name`,
      [],
      (err, dispensaries) => {
        if (err) {
          logger.logError(userId, err, { action: 'GET_ALL_DISPENSARIES' }, ip);
          return reject(err);
        }
        logger.logDataAccess(userId, 'dispensaries', 'all', { action: 'LIST' }, ip);
        resolve(dispensaries);
      }
    );
  });
};

/**
 * Get dispensary by ID
 * @param {number} id - Dispensary ID
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Dispensary data with hospital info
 */
const getDispensaryById = async (id, userId, ip) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT d.id, d.name, d.description, d.hospital_id, d.created_at, d.updated_at,
              h.name as hospital_name
       FROM dispensaries d
       LEFT JOIN hospitals h ON d.hospital_id = h.id
       WHERE d.id = ?`,
      [id],
      (err, dispensary) => {
        if (err) {
          logger.logError(userId, err, { action: 'GET_DISPENSARY', dispensaryId: id }, ip);
          return reject(err);
        }
        if (!dispensary) {
          return resolve(null);
        }
        logger.logDataAccess(userId, 'dispensary', id, { action: 'VIEW' }, ip);
        resolve(dispensary);
      }
    );
  });
};

/**
 * Create a new dispensary
 * @param {Object} dispensaryData - Dispensary data object
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Created dispensary data
 */
const createDispensary = async (dispensaryData, userId, ip) => {
  const { name, description, hospital_id } = dispensaryData;
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO dispensaries (name, description, hospital_id)
       VALUES (?, ?, ?)`,
      [name, description || null, hospital_id || null],
      function(err) {
        if (err) {
          logger.logError(userId, err, { action: 'CREATE_DISPENSARY', dispensaryData }, ip);
          return reject(err);
        }
        const dispensaryId = this.lastID;
        logger.logDataModification(userId, 'dispensary', dispensaryId, 'CREATE', { name, hospital_id }, ip);
        getDispensaryById(dispensaryId, userId, ip)
          .then(dispensary => resolve(dispensary))
          .catch(err => reject(err));
      }
    );
  });
};

/**
 * Update an existing dispensary
 * @param {number} id - Dispensary ID
 * @param {Object} dispensaryData - Dispensary data to update
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<Object>} - Updated dispensary data
 */
const updateDispensary = async (id, dispensaryData, userId, ip) => {
  const { name, description, hospital_id } = dispensaryData;
  return new Promise((resolve, reject) => {
    getDispensaryById(id, userId, ip)
      .then(existingDispensary => {
        if (!existingDispensary) {
          return reject(new Error('Dispensary not found'));
        }

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

        if (updateFields.length === 0) {
          return resolve(existingDispensary);
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        const query = `UPDATE dispensaries SET ${updateFields.join(', ')} WHERE id = ?`;
        updateParams.push(id);

        db.run(query, updateParams, function(err) {
          if (err) {
            logger.logError(userId, err, { action: 'UPDATE_DISPENSARY', dispensaryId: id, dispensaryData }, ip);
            return reject(err);
          }
          logger.logDataModification(userId, 'dispensary', id, 'UPDATE', { name, description, hospital_id }, ip);
          getDispensaryById(id, userId, ip)
            .then(dispensary => resolve(dispensary))
            .catch(err => reject(err));
        });
      })
      .catch(err => reject(err));
  });
};

/**
 * Delete a dispensary
 * @param {number} id - Dispensary ID
 * @param {string} userId - ID of requesting user (for audit logs)
 * @param {string} ip - IP address of requester (for audit logs)
 * @returns {Promise<boolean>} - Success status
 */
const deleteDispensary = async (id, userId, ip) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM dispensaries WHERE id = ?', [id], function(err) {
      if (err) {
        logger.logError(userId, err, { action: 'DELETE_DISPENSARY', dispensaryId: id }, ip);
        return reject(err);
      }
      if (this.changes === 0) {
        return resolve(false);
      }
      logger.logDataModification(userId, 'dispensary', id, 'DELETE', {}, ip);
      resolve(true);
    });
  });
};

module.exports = {
  getAllDispensaries,
  getDispensaryById,
  createDispensary,
  updateDispensary,
  deleteDispensary
};
