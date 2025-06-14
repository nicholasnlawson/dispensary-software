/**
 * Order Model
 * Handles database operations for medication orders
 */

const { db } = require('../db/init');
const logger = {
  warn: console.warn,
  error: console.error,
  info: console.info
};
const uuid = require('uuid');
const encryption = require('../utils/encryption');

// Fields to encrypt in orders table
const SENSITIVE_FIELDS = [
  'patient_name',
  'patient_dob',
  'patient_id_number',
  'patient_address',
  'patient_details',
  'notes'
];

// Helper function to convert snake_case db columns to camelCase
const snakeToCamel = (str) => str.replace(/_([a-z])/g, (match, p1) => p1.toUpperCase());

// Helper to convert object keys from snake_case to camelCase
const convertToCamelCase = (obj) => {
  if (!obj) return null;
  const result = {};
  Object.entries(obj).forEach(([key, value]) => {
    result[snakeToCamel(key)] = value;
  });
  return result;
};

const OrderModel = {
  // Create a new order
  createOrder(orderData) {
    const { 
      id, type, wardId, requester, notes,
      // Also check for flattened requester properties
      requesterName: flatRequesterName,
      requesterRole: flatRequesterRole
    } = orderData;

    return new Promise((resolve, reject) => {
      // Add debugging
      console.log('Creating order with data:', JSON.stringify(orderData, null, 2));
      
      const timestamp = orderData.timestamp || new Date().toISOString();
      const status = orderData.status || 'pending';
      
      // Encrypt notes if available and encryption is configured
      let encryptedNotes = notes;
      if (encryption.isEncryptionConfigured() && notes) {
        encryptedNotes = encryption.encrypt(notes);
      }
      
      // Handle both nested and flattened requester data formats
      let requesterName, requesterRole;
      
      if (requester) {
        // Nested requester object format
        console.log('Using nested requester object:', JSON.stringify(requester, null, 2));
        requesterName = requester.name;
        requesterRole = requester.role;
      } else if (flatRequesterName || flatRequesterRole) {
        // Flattened format
        console.log('Using flattened requester properties');
        requesterName = flatRequesterName;
        requesterRole = flatRequesterRole;
      } else {
        // No requester info at all - will fail constraint
        console.log('No requester information found!');
      }
      
      console.log('Final requester data:', { requesterName, requesterRole });

      // Insert main order details
      console.log('Running DB insert with params:', {
        id, type, wardId, timestamp, status,
        requesterName, requesterRole, notes: notes || null
      });
      db.run(
        `INSERT INTO orders (
          id, type, ward_id, timestamp, status, 
          requester_name, requester_role, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, type, wardId, timestamp, status,
          requesterName, requesterRole, encryptedNotes || null
        ],
        (err) => {
          if (err) {
            console.error('Error inserting order:', err);
            return reject(err);
          }
          
          // If patient order, insert patient details
          if (type === 'patient' && orderData.patient) {
            // Encrypt sensitive patient information
            const patientData = { ...orderData.patient };
            
            // Encrypt patient name and date of birth if encryption is configured
            if (encryption.isEncryptionConfigured()) {
              patientData.name = encryption.encrypt(patientData.name);
              if (patientData.dob) {
                patientData.dob = encryption.encrypt(patientData.dob);
              }
            }
            
            db.run(
              `INSERT INTO order_patients (
                order_id, patient_name, patient_dob, 
                patient_nhs, patient_hospital_id
              ) VALUES (?, ?, ?, ?, ?)`,
              [
                id,
                patientData.name,
                patientData.dob || null,
                orderData.patient.nhs || null,
                orderData.patient.hospitalId
              ],
              (err) => {
                if (err) {
                  console.error('Error inserting patient details:', err);
                  return reject(err);
                }
                
                // Continue with medications after patient details inserted
                insertMedications();
              }
            );
          } else {
            // If not a patient order, skip patient insertion and go to medications
            insertMedications();
          }
          
          // Function to insert medications
          function insertMedications() {
            // If no medications, return success
            if (!orderData.medications || orderData.medications.length === 0) {
              return resolve({ success: true, id });
            }
            
            // Create a counter to track completed medication inserts
            let completed = 0;
            let hasError = false;
            
            // Insert each medication
            orderData.medications.forEach(med => {
              db.run(
                `INSERT INTO order_medications (
                  order_id, name, form, strength, quantity, dose, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  id,
                  med.name,
                  med.form || null,
                  med.strength || null,
                  med.quantity,
                  med.dose || null,
                  med.notes || null
                ],
                (err) => {
                  if (err && !hasError) {
                    hasError = true;
                    console.error('Error inserting medication:', err);
                    return reject(err);
                  }
                  
                  completed++;
                  if (completed === orderData.medications.length && !hasError) {
                    resolve({ success: true, id });
                  }
                }
              );
            });
          }
        }
      );
    }).catch(error => {
      console.error('Error creating order:', error);
      throw error;
    });
  },

  // Get order by ID with all related data
  getOrderById(orderId) {
    return new Promise((resolve, reject) => {
      // Get main order data
      db.get(
        `SELECT * FROM orders WHERE id = ?`,
        [orderId],
        (err, order) => {
          if (err) {
            console.error('Error fetching order:', err);
            return reject(err);
          }

          if (!order) {
            return resolve(null);
          }

          // Convert to camelCase
          const result = convertToCamelCase(order);
          
          // Decrypt notes field if encryption is configured
          if (encryption.isEncryptionConfigured() && result.notes) {
            try {
              result.notes = encryption.decrypt(result.notes);
            } catch (decryptErr) {
              // Log but continue - might be accessing legacy unencrypted data
              logger.warn(`Error decrypting notes for order ${orderId}:`, decryptErr);
            }
          }

          // Get patient data if it's a patient order
          if (result.type === 'patient') {
            db.get(
              `SELECT * FROM order_patients WHERE order_id = ?`,
              [orderId],
              (err, patient) => {
                if (err) {
                  console.error('Error fetching patient details:', err);
                  return reject(err);
                }
                
                if (patient) {
                  // Create patient object with potentially encrypted data
                  let patientData = {
                    name: patient.patient_name,
                    dob: patient.patient_dob,
                    nhs: patient.patient_nhs,
                    hospitalId: patient.patient_hospital_id
                  };
                  
                  // Decrypt sensitive fields if encryption is configured
                  if (encryption.isEncryptionConfigured()) {
                    try {
                      // Decrypt name and dob if they were encrypted
                      if (patientData.name) {
                        patientData.name = encryption.decrypt(patientData.name);
                      }
                      if (patientData.dob) {
                        patientData.dob = encryption.decrypt(patientData.dob);
                      }
                    } catch (decryptErr) {
                      // Log but continue - might be accessing legacy unencrypted data
                      logger.warn(`Error decrypting patient data for order ${orderId}:`, decryptErr);
                    }
                  }
                  
                  result.patient = patientData;
                }
                
                // Continue with fetching medications
                fetchMedications(result);
              }
            );
          } else {
            // If not a patient order, skip patient fetch and go to medications
            fetchMedications(result);
          }
          
          // Function to fetch medications
          function fetchMedications(orderResult) {
            db.all(
              `SELECT * FROM order_medications WHERE order_id = ?`,
              [orderId],
              (err, medications) => {
                if (err) {
                  console.error('Error fetching medications:', err);
                  return reject(err);
                }

                if (medications && medications.length) {
                  orderResult.medications = medications.map(med => ({
                    name: med.name,
                    form: med.form,
                    strength: med.strength,
                    quantity: med.quantity,
                    dose: med.dose,
                    notes: med.notes
                  }));
                } else {
                  orderResult.medications = [];
                }
                
                // Now get ward details
                fetchWardDetails(orderResult);
              }
            );
          }
          
          // Function to fetch ward details
          function fetchWardDetails(orderResult) {
            db.get(
              `SELECT w.id, w.name, h.name as hospital_name 
               FROM wards w
               JOIN hospitals h ON w.hospital_id = h.id
               WHERE w.id = ?`,
              [orderResult.wardId],
              (err, ward) => {
                if (err) {
                  console.error('Error fetching ward details:', err);
                  return reject(err);
                }

                if (ward) {
                  orderResult.wardName = ward.name;
                  orderResult.hospitalName = ward.hospital_name;
                }
                
                // All data fetched, return result
                resolve(orderResult);
              }
            );
          }
        }
      );
    }).catch(error => {
      console.error('Error getting order by ID:', error);
      throw error;
    });
  },
  // Update order status and processing details
  updateOrder(orderId, updateData) {
    return new Promise((resolve, reject) => {
      const { status, processedBy, checkedBy, processingNotes, notes } = updateData;

      // Build update query based on provided data
      const updates = [];
      const params = [];
      
      if (status) {
        updates.push('status = ?');
        params.push(status);
      }
      
      // Handle notes field with encryption if configured
      if (notes !== undefined) {
        updates.push('notes = ?');
        // Encrypt notes if encryption is configured
        if (encryption.isEncryptionConfigured() && notes) {
          params.push(encryption.encrypt(notes));
        } else {
          params.push(notes);
        }
      }

      if (processedBy) {
        updates.push('processed_by = ?');
        params.push(processedBy);
      }

      if (checkedBy) {
        updates.push('checked_by = ?');
        params.push(checkedBy);
      }

      if (processingNotes !== undefined) {
        updates.push('processing_notes = ?');
        params.push(processingNotes);
      }

      // If status is changing to completed, add processed_at timestamp
      if (status === 'completed') {
        updates.push('processed_at = ?');
        params.push(new Date().toISOString());
      }

      // Add order ID to params
      params.push(orderId);

      // Execute update
      db.run(
        `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function(err) {
          if (err) {
            console.error('Error updating order:', err);
            return reject(err);
          }
          
          resolve({ 
            success: this.changes > 0,
            message: this.changes > 0 ? 'Order updated' : 'Order not found'
          });
        }
      );
    }).catch(error => {
      console.error('Error updating order:', error);
      throw error;
    });
  },
  // Delete order and related data
  deleteOrder(orderId) {
    return new Promise((resolve, reject) => {
      // Due to CASCADE constraints, deleting from orders will delete related records
      db.run(
        `DELETE FROM orders WHERE id = ?`,
        [orderId],
        function(err) {
          if (err) {
            logger.error('Error deleting order:', err);
            return reject(err);
          }
          
          resolve({ 
            success: this.changes > 0,
            message: this.changes > 0 ? 'Order deleted' : 'Order not found'
          });
        }
      );
    }).catch(error => {
      logger.error('Error deleting order:', error);
      throw error;
    });
  },
  // Get orders with optional filtering
  getOrders(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT o.*, w.name as ward_name, h.name as hospital_name
        FROM orders o
        JOIN wards w ON o.ward_id = w.id
        JOIN hospitals h ON w.hospital_id = h.id
      `;

      const whereConditions = [];
      const params = [];

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        whereConditions.push('o.status = ?');
        params.push(filters.status);
      }

      if (filters.type && filters.type !== 'all') {
        whereConditions.push('o.type = ?');
        params.push(filters.type);
      }

      if (filters.wardId && filters.wardId !== 'all') {
        whereConditions.push('o.ward_id = ?');
        params.push(filters.wardId);
      }

      if (filters.hospitalId && filters.hospitalId !== 'all') {
        whereConditions.push('h.id = ?');
        params.push(filters.hospitalId);
      }

      // Add WHERE clause if we have conditions
      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      // Add ORDER BY clause
      query += ' ORDER BY o.timestamp DESC';

      // Add LIMIT if specified
      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      // Execute query
      db.all(query, params, (err, orders) => {
        if (err) {
          logger.error('Error fetching orders:', err);
          return reject(err);
        }

        // If no orders, return empty array
        if (!orders || orders.length === 0) {
          return resolve([]);
        }

        // Process orders one by one, building an array of promises
        const orderPromises = orders.map(order => {
          return new Promise((resolveOrder, rejectOrder) => {
            // Convert to camelCase
            const orderData = convertToCamelCase(order);
            
            // Decrypt notes field if encryption is configured
            if (encryption.isEncryptionConfigured() && orderData.notes) {
              try {
                orderData.notes = encryption.decrypt(orderData.notes);
              } catch (decryptErr) {
                // Log but continue - might be accessing legacy unencrypted data
                logger.warn(`Error decrypting notes for order ${orderData.id}:`, decryptErr);
              }
            }
            
            // For patient orders, get patient details
            if (orderData.type === 'patient') {
              db.get(
                `SELECT * FROM order_patients WHERE order_id = ?`,
                [orderData.id],
                (err, patient) => {
                  if (err) {
                    logger.error(`Error fetching patient details for order ${orderData.id}:`, err);
                    return rejectOrder(err);
                  }
                  
                  if (patient) {
                    // Create patient object with potentially encrypted data
                    let patientData = {
                      name: patient.patient_name,
                      dob: patient.patient_dob,
                      nhs: patient.patient_nhs,
                      hospitalId: patient.patient_hospital_id
                    };
                    
                    // Decrypt sensitive fields if encryption is configured
                    if (encryption.isEncryptionConfigured()) {
                      try {
                        // Decrypt name and dob if they were encrypted
                        if (patientData.name) {
                          patientData.name = encryption.decrypt(patientData.name);
                        }
                        if (patientData.dob) {
                          patientData.dob = encryption.decrypt(patientData.dob);
                        }
                      } catch (decryptErr) {
                        // Log but continue - might be accessing legacy unencrypted data
                        logger.warn(`Error decrypting patient data for order ${orderData.id}:`, decryptErr);
                      }
                    }
                    
                    orderData.patient = patientData;
                  }
                  
                  // Get medications for this order
                  fetchMedications(orderData, resolveOrder, rejectOrder);
                }
              );
            } else {
              // Not a patient order, just get medications
              fetchMedications(orderData, resolveOrder, rejectOrder);
            }
            
            // Helper to fetch medications for an order
            function fetchMedications(orderData, resolveOrder, rejectOrder) {
              db.all(
                `SELECT * FROM order_medications WHERE order_id = ?`,
                [orderData.id],
                (err, medications) => {
                  if (err) {
                    logger.error(`Error fetching medications for order ${orderData.id}:`, err);
                    return rejectOrder(err);
                  }
                  
                  if (medications && medications.length) {
                    orderData.medications = medications.map(med => ({
                      name: med.name,
                      form: med.form,
                      strength: med.strength,
                      quantity: med.quantity,
                      notes: med.notes
                    }));
                  } else {
                    orderData.medications = [];
                  }
                  
                  // Order data complete, resolve this order
                  resolveOrder(orderData);
                }
              );
            }
          });
        });
        
        // Wait for all order promises to resolve
        Promise.all(orderPromises)
          .then(orderResults => {
            resolve(orderResults);
          })
          .catch(err => {
            logger.error('Error processing orders:', err);
            reject(err);
          });
      });
    }).catch(error => {
      logger.error('Error getting orders:', error);
      throw error;
    });
  },
  
  /**
   * Cancel an order with audit trail
   * @param {string} orderId - Order ID
   * @param {Object} cancelData - Cancellation data (reason, cancelledBy, timestamp)
   * @returns {Promise} - Promise resolving to success status and order
   */
  cancelOrder(orderId, cancelData) {
    return new Promise(async (resolve, reject) => {
      try {
        // First get the current order to check if it can be cancelled
        const order = await this.getOrderById(orderId);
        
        if (!order) {
          return resolve({ 
            success: false, 
            message: 'Order not found' 
          });
        }
        
        // Cannot cancel orders that are already completed or cancelled
        if (order.status === 'completed' || order.status === 'cancelled') {
          return resolve({ 
            success: false, 
            message: `Order cannot be cancelled because it is already ${order.status}` 
          });
        }
        
        // Validate required data
        const { reason, cancelledBy, timestamp } = cancelData;
        if (!reason || !cancelledBy) {
          return resolve({ 
            success: false, 
            message: 'Reason and cancelledBy are required' 
          });
        }
        
        // Store previous status for audit trail
        const previousStatus = order.status;
        const actualTimestamp = timestamp || new Date().toISOString();
        
        // Start a transaction
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          // 1. Update order status to cancelled
          db.run(
            `UPDATE orders SET 
              status = ?, 
              processing_notes = CASE 
                WHEN processing_notes IS NULL THEN ? 
                ELSE processing_notes || '\n' || ?
              END
            WHERE id = ?`,
            [
              'cancelled', 
              `Cancelled: ${reason}`, 
              `Cancelled: ${reason}`, 
              orderId
            ],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                logger.error('Error updating order status:', err);
                return reject(err);
              }
              
              if (this.changes === 0) {
                db.run('ROLLBACK');
                return resolve({ 
                  success: false, 
                  message: 'Order not found' 
                });
              }
              
              // 2. Add entry to order history
              const historyData = {
                previousStatus,
                newStatus: 'cancelled',
                reason
              };
              
              db.run(
                `INSERT INTO order_history (
                  order_id, action_type, action_timestamp,
                  modified_by, reason, previous_data, new_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  orderId,
                  'status_change',
                  actualTimestamp,
                  cancelledBy,
                  reason,
                  JSON.stringify({ status: previousStatus }),
                  JSON.stringify({ status: 'cancelled' })
                ],
                function(err) {
                  if (err) {
                    db.run('ROLLBACK');
                    logger.error('Error adding order history:', err);
                    return reject(err);
                  }
                  
                  // Commit the transaction
                  db.run('COMMIT', async function(err) {
                    if (err) {
                      db.run('ROLLBACK');
                      logger.error('Error committing transaction:', err);
                      return reject(err);
                    }
                    
                    // Get updated order
                    try {
                      const updatedOrder = await OrderModel.getOrderById(orderId);
                      resolve({ 
                        success: true,
                        message: 'Order cancelled successfully',
                        order: updatedOrder
                      });
                    } catch (error) {
                      logger.error('Error fetching updated order:', error);
                      resolve({ 
                        success: true, 
                        message: 'Order cancelled successfully, but could not fetch updated data' 
                      });
                    }
                  });
                }
              );
            }
          );
        });
      } catch (error) {
        logger.error('Error cancelling order:', error);
        reject(error);
      }
    });
  },
  
  /**
   * Update all medications for an order
   * @param {string} orderId - Order ID
   * @param {Object} updateData - Update data with medications array and audit info
   * @returns {Promise} - Promise resolving to success status and updated order
   */
  updateOrderMedications(orderId, updateData) {
    return new Promise(async (resolve, reject) => {
      try {
        // First get the current order to check if it exists and can be modified
        const order = await this.getOrderById(orderId);
        
        if (!order) {
          return resolve({ 
            success: false, 
            message: 'Order not found' 
          });
        }
        
        // Cannot modify orders that are completed or cancelled
        if (order.status === 'completed' || order.status === 'cancelled') {
          return resolve({ 
            success: false, 
            message: `Order cannot be modified because it is ${order.status}` 
          });
        }
        
        // Validate required data
        const { medications, modifiedBy, reason, timestamp } = updateData;
        if (!medications || !Array.isArray(medications) || !modifiedBy || !reason) {
          return resolve({ 
            success: false, 
            message: 'Medications array, modifiedBy, and reason are required' 
          });
        }
        
        // Validate each medication
        for (const med of medications) {
          if (!med.name || !med.quantity) {
            return resolve({ 
              success: false, 
              message: 'Each medication must have a name and quantity' 
            });
          }
        }
        
        // Store current medications for audit trail
        const previousMedications = order.medications || [];
        const actualTimestamp = timestamp || new Date().toISOString();
        
        // Start a transaction
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          // 1. Delete all existing medications
          db.run(
            `DELETE FROM order_medications WHERE order_id = ?`,
            [orderId],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                logger.error('Error deleting existing medications:', err);
                return reject(err);
              }
              
              // 2. Insert new medications
              let completed = 0;
              let hasError = false;
              
              // If no medications, log history and commit
              if (!medications.length) {
                addHistoryAndCommit();
                return;
              }
              
              // Insert each new medication
              medications.forEach(med => {
                db.run(
                  `INSERT INTO order_medications (
                    order_id, name, form, strength, quantity, dose, notes
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    orderId,
                    med.name,
                    med.form || null,
                    med.strength || null,
                    med.quantity,
                    med.dose || null,
                    med.notes || null
                  ],
                  (err) => {
                    if (err && !hasError) {
                      hasError = true;
                      db.run('ROLLBACK');
                      logger.error('Error inserting medication:', err);
                      return reject(err);
                    }
                    
                    completed++;
                    if (completed === medications.length && !hasError) {
                      // All medications inserted successfully
                      addHistoryAndCommit();
                    }
                  }
                );
              });
              
              // Function to add history entry and commit transaction
              function addHistoryAndCommit() {
                // 3. Add history entry
                db.run(
                  `INSERT INTO order_history (
                    order_id, action_type, action_timestamp,
                    modified_by, reason, previous_data, new_data
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    orderId,
                    'medications_update',
                    actualTimestamp,
                    modifiedBy,
                    reason,
                    JSON.stringify({ medications: previousMedications }),
                    JSON.stringify({ medications: medications })
                  ],
                  function(err) {
                    if (err) {
                      db.run('ROLLBACK');
                      logger.error('Error adding order history:', err);
                      return reject(err);
                    }
                    
                    // 4. Update order notes
                    db.run(
                      `UPDATE orders SET 
                        processing_notes = CASE 
                          WHEN processing_notes IS NULL THEN ? 
                          ELSE processing_notes || '\n' || ?
                        END
                      WHERE id = ?`,
                      [
                        `Medications updated: ${reason}`, 
                        `Medications updated: ${reason}`, 
                        orderId
                      ],
                      function(err) {
                        if (err) {
                          db.run('ROLLBACK');
                          logger.error('Error updating order notes:', err);
                          return reject(err);
                        }
                        
                        // Commit the transaction
                        db.run('COMMIT', async function(err) {
                          if (err) {
                            db.run('ROLLBACK');
                            logger.error('Error committing transaction:', err);
                            return reject(err);
                          }
                          
                          // Get updated order
                          try {
                            const updatedOrder = await OrderModel.getOrderById(orderId);
                            resolve({ 
                              success: true,
                              message: 'Order medications updated successfully',
                              order: updatedOrder
                            });
                          } catch (error) {
                            logger.error('Error fetching updated order:', error);
                            resolve({ 
                              success: true, 
                              message: 'Order medications updated successfully, but could not fetch updated data' 
                            });
                          }
                        });
                      }
                    );
                  }
                );
              }
            }
          );
        });
      } catch (error) {
        logger.error('Error updating order medications:', error);
        reject(error);
      }
    });
  },
  
  /**
   * Add a single medication to an order
   * @param {string} orderId - Order ID
   * @param {Object} updateData - Update data with medication and audit info
   * @returns {Promise} - Promise resolving to success status and updated order
   */
  addOrderMedication(orderId, updateData) {
    return new Promise(async (resolve, reject) => {
      try {
        // First get the current order to check if it exists and can be modified
        const order = await this.getOrderById(orderId);
        
        if (!order) {
          return resolve({ 
            success: false, 
            message: 'Order not found' 
          });
        }
        
        // Cannot modify orders that are completed or cancelled
        if (order.status === 'completed' || order.status === 'cancelled') {
          return resolve({ 
            success: false, 
            message: `Order cannot be modified because it is ${order.status}` 
          });
        }
        
        // Validate required data
        const { medication, modifiedBy, reason, timestamp } = updateData;
        if (!medication || !medication.name || !medication.quantity || !modifiedBy || !reason) {
          return resolve({ 
            success: false, 
            message: 'Medication details, modifiedBy, and reason are required' 
          });
        }
        
        // Store current medications for audit trail
        const previousMedications = order.medications || [];
        const actualTimestamp = timestamp || new Date().toISOString();
        
        // Start a transaction
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          // 1. Insert new medication
          db.run(
            `INSERT INTO order_medications (
              order_id, name, form, strength, quantity, notes
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              orderId,
              medication.name,
              medication.form || null,
              medication.strength || null,
              medication.quantity,
              medication.notes || null
            ],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                logger.error('Error adding medication to order:', err);
                return reject(err);
              }
              
              // Create new medications array with the added medication
              const updatedMedications = [...previousMedications, medication];
              
              // 2. Add entry to order history
              db.run(
                `INSERT INTO order_history (
                  order_id, action_type, action_timestamp,
                  modified_by, reason, previous_data, new_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  orderId,
                  'medication_add',
                  actualTimestamp,
                  modifiedBy,
                  reason,
                  JSON.stringify({ medications: previousMedications }),
                  JSON.stringify({ medications: updatedMedications, added: medication })
                ],
                function(err) {
                  if (err) {
                    db.run('ROLLBACK');
                    logger.error('Error adding order history:', err);
                    return reject(err);
                  }
                  
                  // 3. Update order notes
                  db.run(
                    `UPDATE orders SET 
                      processing_notes = CASE 
                        WHEN processing_notes IS NULL THEN ? 
                        ELSE processing_notes || '\n' || ?
                      END
                    WHERE id = ?`,
                    [
                      `Medication added: ${medication.name} ${medication.quantity} - ${reason}`, 
                      `Medication added: ${medication.name} ${medication.quantity} - ${reason}`, 
                      orderId
                    ],
                    function(err) {
                      if (err) {
                        db.run('ROLLBACK');
                        logger.error('Error updating order notes:', err);
                        return reject(err);
                      }
                      
                      // Commit the transaction
                      db.run('COMMIT', async function(err) {
                        if (err) {
                          db.run('ROLLBACK');
                          logger.error('Error committing transaction:', err);
                          return reject(err);
                        }
                        
                        // Get updated order
                        try {
                          const updatedOrder = await OrderModel.getOrderById(orderId);
                          resolve({ 
                            success: true,
                            message: 'Medication added successfully',
                            order: updatedOrder
                          });
                        } catch (error) {
                          logger.error('Error fetching updated order:', error);
                          resolve({ 
                            success: true, 
                            message: 'Medication added successfully, but could not fetch updated data' 
                          });
                        }
                      });
                    }
                  );
                }
              );
            }
          );
        });
      } catch (error) {
        logger.error('Error adding medication to order:', error);
        reject(error);
      }
    });
  },
  
  /**
   * Remove a medication from an order by its ID
   * @param {string} orderId - Order ID
   * @param {Object} updateData - Update data with medicationId and audit info
   * @returns {Promise} - Promise resolving to success status and updated order
   */
  removeOrderMedication(orderId, updateData) {
    return new Promise(async (resolve, reject) => {
      try {
        // First get the current order to check if it exists and can be modified
        const order = await this.getOrderById(orderId);
        
        if (!order) {
          return resolve({ 
            success: false, 
            message: 'Order not found' 
          });
        }
        
        // Cannot modify orders that are completed or cancelled
        if (order.status === 'completed' || order.status === 'cancelled') {
          return resolve({ 
            success: false, 
            message: `Order cannot be modified because it is ${order.status}` 
          });
        }
        
        // Validate required data
        const { medicationId, modifiedBy, reason, timestamp } = updateData;
        if (!medicationId || !modifiedBy || !reason) {
          return resolve({ 
            success: false, 
            message: 'Medication ID, modifiedBy, and reason are required' 
          });
        }
        
        // Store current medications for audit trail
        const previousMedications = order.medications || [];
        const medicationToRemove = previousMedications.find(med => med.id === parseInt(medicationId));
        
        if (!medicationToRemove) {
          return resolve({
            success: false,
            message: 'Medication not found in this order'
          });
        }
        
        const actualTimestamp = timestamp || new Date().toISOString();
        
        // Start a transaction
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          // 1. Delete the specified medication
          db.run(
            `DELETE FROM order_medications WHERE id = ? AND order_id = ?`,
            [medicationId, orderId],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                logger.error('Error removing medication from order:', err);
                return reject(err);
              }
              
              if (this.changes === 0) {
                db.run('ROLLBACK');
                return resolve({ 
                  success: false, 
                  message: 'Medication not found or already removed' 
                });
              }
              
              // Create new medications array without the removed medication
              const updatedMedications = previousMedications.filter(med => med.id !== parseInt(medicationId));
              
              // 2. Add entry to order history
              db.run(
                `INSERT INTO order_history (
                  order_id, action_type, action_timestamp,
                  modified_by, reason, previous_data, new_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  orderId,
                  'medication_remove',
                  actualTimestamp,
                  modifiedBy,
                  reason,
                  JSON.stringify({ medications: previousMedications }),
                  JSON.stringify({ medications: updatedMedications, removed: medicationToRemove })
                ],
                function(err) {
                  if (err) {
                    db.run('ROLLBACK');
                    logger.error('Error adding order history:', err);
                    return reject(err);
                  }
                  
                  // 3. Update order notes
                  db.run(
                    `UPDATE orders SET 
                      processing_notes = CASE 
                        WHEN processing_notes IS NULL THEN ? 
                        ELSE processing_notes || '\n' || ?
                      END
                    WHERE id = ?`,
                    [
                      `Medication removed: ${medicationToRemove.name} ${medicationToRemove.quantity} - ${reason}`, 
                      `Medication removed: ${medicationToRemove.name} ${medicationToRemove.quantity} - ${reason}`, 
                      orderId
                    ],
                    function(err) {
                      if (err) {
                        db.run('ROLLBACK');
                        logger.error('Error updating order notes:', err);
                        return reject(err);
                      }
                      
                      // Commit the transaction
                      db.run('COMMIT', async function(err) {
                        if (err) {
                          db.run('ROLLBACK');
                          logger.error('Error committing transaction:', err);
                          return reject(err);
                        }
                        
                        // Get updated order
                        try {
                          const updatedOrder = await OrderModel.getOrderById(orderId);
                          resolve({ 
                            success: true,
                            message: 'Medication removed successfully',
                            order: updatedOrder
                          });
                        } catch (error) {
                          logger.error('Error fetching updated order:', error);
                          resolve({ 
                            success: true, 
                            message: 'Medication removed successfully, but could not fetch updated data' 
                          });
                        }
                      });
                    }
                  );
                }
              );
            }
          );
        });
      } catch (error) {
        logger.error('Error removing medication from order:', error);
        reject(error);
      }
    });
  },
  
  /**
   * Get the complete history for an order
   * @param {string} orderId - Order ID
   * @param {Object} options - Query options
   * @returns {Promise} - Promise resolving to order history
   */
  getOrderHistory(orderId, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const { limit = 100, offset = 0, sortBy = 'action_timestamp', sortOrder = 'DESC' } = options;
        
        // Validate sort parameters to prevent SQL injection
        const validSortColumns = ['action_timestamp', 'action_type', 'modified_by'];
        const validSortOrders = ['ASC', 'DESC'];
        
        const actualSortBy = validSortColumns.includes(sortBy) ? sortBy : 'action_timestamp';
        const actualSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
        
        // Query order history with pagination
        db.all(
          `SELECT 
            id, order_id, action_type, action_timestamp, 
            modified_by, reason, previous_data, new_data 
          FROM order_history 
          WHERE order_id = ? 
          ORDER BY ${actualSortBy} ${actualSortOrder} 
          LIMIT ? OFFSET ?`,
          [orderId, limit, offset],
          function(err, rows) {
            if (err) {
              logger.error('Error getting order history:', err);
              return reject(err);
            }
            
            // Parse JSON data fields
            const history = rows.map(row => {
              try {
                return {
                  ...row,
                  previous_data: row.previous_data ? JSON.parse(row.previous_data) : null,
                  new_data: row.new_data ? JSON.parse(row.new_data) : null
                };
              } catch (e) {
                logger.error('Error parsing JSON in history row:', e);
                return {
                  ...row,
                  previous_data: null,
                  new_data: null,
                  parse_error: true
                };
              }
            });
            
            // Get total count for pagination
            db.get(
              'SELECT COUNT(*) as total FROM order_history WHERE order_id = ?',
              [orderId],
              function(err, countResult) {
                if (err) {
                  logger.error('Error getting order history count:', err);
                  // Still return history but without total count
                  return resolve({ 
                    success: true, 
                    history 
                  });
                }
                
                resolve({ 
                  success: true, 
                  history,
                  pagination: {
                    total: countResult.total,
                    limit,
                    offset,
                    hasMore: offset + limit < countResult.total
                  }
                });
              }
            );
          }
        );
      } catch (error) {
        logger.error('Error getting order history:', error);
        reject(error);
      }
    });
  }
};

module.exports = OrderModel;
