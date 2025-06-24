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
      id: providedId, type, wardId, requester, notes,
      // Also check for flattened requester properties
      requesterName: flatRequesterName,
      requesterRole: flatRequesterRole
    } = orderData;

    return new Promise((resolve, reject) => {
      // BUGFIX: Always generate a valid UUID if no ID is provided
      const id = providedId || `ORD${Date.now().toString().substring(6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      // Add debugging with the ID we'll actually use
      console.log(`Creating order with ID: ${id} and data:`, JSON.stringify(orderData, null, 2));
      
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
        function(err) { // IMPORTANT: Use function() instead of arrow to access this.lastID
          if (err) {
            console.error('Error inserting order:', err);
            return reject(err);
          }
          
          // Log the operation results
          console.log(`✅ ORDER INSERT SUCCESS - ID: ${id}, LastID: ${this.lastID}, Changes: ${this.changes}`);
          console.log(`Database reports: ${this.changes} row(s) affected`);

          // Verify the order exists immediately after insert
          db.get('SELECT id, type FROM orders WHERE id = ?', [id], (verifyErr, row) => {
            if (verifyErr) {
              console.error('Error verifying order insertion:', verifyErr);
            } else if (!row) {
              console.error('⚠️ CRITICAL: Order not found in database immediately after insert!');
            } else {
              console.log(`✅ Verified order exists in DB: ${JSON.stringify(row)}`);
            }
          });
          
          // If patient order, insert patient details
          if (type === 'patient' && orderData.patient) {
            // Encrypt sensitive patient information
            const patientData = { ...orderData.patient };
            
            // Log patient data before processing to verify input
            console.log('Patient data received:', JSON.stringify(patientData, null, 2));
            
            // Encrypt patient name and date of birth if encryption is configured
            if (encryption.isEncryptionConfigured()) {
              patientData.name = encryption.encrypt(patientData.name);
              if (patientData.dob) {
                patientData.dob = encryption.encrypt(patientData.dob);
              }
            }
            
            // BUGFIX: Handle various possible field names for hospital ID and NHS number
            const nhsNumber = patientData.nhs || patientData.nhsNumber || patientData.nhs_number || null;
            const hospitalId = patientData.hospitalId || patientData.hospitalNumber || patientData.hospital_id || null;
            
            // Log the values we're about to store
            console.log('Storing patient identifiers:', {
              id,
              patient_name: patientData.name ? '(encrypted)' : null,
              patient_nhs: nhsNumber,
              patient_hospital_id: hospitalId
            });
            
            db.run(
              `INSERT INTO order_patients (
                order_id, patient_name, patient_dob, 
                patient_nhs, patient_hospital_id
              ) VALUES (?, ?, ?, ?, ?)`,
              [
                id,
                patientData.name,
                patientData.dob || null,
                nhsNumber,
                hospitalId
              ],
              function(err) {
                if (err) {
                  console.error('Error inserting patient details:', err);
                  console.error('Full error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                  return reject(err);
                }
                
                // Log patient insert success
                console.log(`✅ PATIENT INSERT SUCCESS - Order ID: ${id}, Changes: ${this.changes}`);
                
                // Verify patient was actually added to the database
                db.get('SELECT order_id, patient_hospital_id FROM order_patients WHERE order_id = ?', [id], (verifyErr, row) => {
                  if (verifyErr) {
                    console.error('Error verifying patient insertion:', verifyErr);
                  } else if (!row) {
                    console.error(`⚠️ CRITICAL: Patient record not found for order ${id} immediately after insert!`);
                  } else {
                    console.log(`✅ Verified patient exists in DB: ${JSON.stringify(row)}`);
                  }
                });
                
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
              console.log(`Order ${id} created successfully with no medications`);
              return resolve({ success: true, id });
            }
            
            // Log medications we're about to insert
            console.log(`Inserting ${orderData.medications.length} medications for order ${id}:`, 
              JSON.stringify(orderData.medications, null, 2));
            
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
                function(err) {
                  const medName = med.name;
                  
                  if (err) {
                    hasError = true;
                    console.error(`Error inserting medication "${medName}":`, err);
                    console.error('Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                    return reject(err);
                  }
                  
                  // Log success
                  console.log(`✅ MEDICATION INSERT SUCCESS - Order ID: ${id}, Med: "${medName}", Changes: ${this.changes}`);
                  
                  // Verify medication was actually added
                  db.get('SELECT order_id, name FROM order_medications WHERE order_id = ? AND name = ?', 
                    [id, med.name], (verifyErr, row) => {
                    if (verifyErr) {
                      console.error(`Error verifying medication "${medName}" insertion:`, verifyErr);
                    } else if (!row) {
                      console.error(`⚠️ CRITICAL: Medication "${medName}" not found for order ${id} after insert!`);
                    } else {
                      console.log(`✅ Verified medication "${medName}" exists in DB: ${JSON.stringify(row)}`);
                    }
                  });
                  
                  completed++;
                  console.log(`Medication progress: ${completed}/${orderData.medications.length}`);
                  
                  if (completed === orderData.medications.length && !hasError) {
                    console.log(`✅ All ${completed} medications inserted successfully. Order ID: ${id}`);
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
        SELECT o.id, o.type, o.ward_id, o.timestamp, o.status, o.requester_name, o.requester_role, 
        o.notes, o.processed_by, o.processed_at, o.checked_by, o.processing_notes,
        o.cancelled_by, o.cancellation_reason, o.cancelled_at,
        w.name as ward_name, h.name as hospital_name
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
                      dose: med.dose,
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
          
          // 1. Update order status to cancelled and set cancellation fields
          db.run(
            `UPDATE orders SET 
              status = ?, 
              processing_notes = CASE 
                WHEN processing_notes IS NULL THEN ? 
                ELSE processing_notes || '\n' || ?
              END,
              cancelled_by = ?,
              cancellation_reason = ?,
              cancelled_at = ?
            WHERE id = ?`,
            [
              'cancelled', 
              `Cancelled: ${reason}`, 
              `Cancelled: ${reason}`,
              cancelledBy,
              reason,
              actualTimestamp, 
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
        if (!orderId) {
          return reject(new Error('Order ID is required'));
        }
        
        const { limit = 100, offset = 0, sortOrder = 'DESC' } = options;
        const allowedSortOrders = ['ASC', 'DESC'];
        
        if (!allowedSortOrders.includes(sortOrder.toUpperCase())) {
          return reject(new Error('Invalid sort order. Must be ASC or DESC'));
        }
        
        // Check which schema/table structure we have
        db.all(
          'PRAGMA table_info(order_history)',
          [],
          function(err, columns) {
            if (err) {
              logger.error('Error checking order_history table:', err);
              return reject(err);
            }
            
            // Determine which query to use based on table structure
            let sql;
            if (Array.isArray(columns) && columns.some(col => col.name === 'action_timestamp')) {
              // First schema version
              sql = `
                SELECT 
                  id, order_id, action_type, action_timestamp, 
                  modified_by, reason, previous_data, new_data 
                FROM order_history 
                WHERE order_id = ? 
                ORDER BY action_timestamp ${sortOrder.toUpperCase()} 
                LIMIT ? OFFSET ?
              `;
            } else {
              // Second schema version
              sql = `
                SELECT 
                  id, order_id, action, timestamp, user_id, user_name,
                  details, metadata
                FROM order_history
                WHERE order_id = ?
                ORDER BY timestamp ${sortOrder.toUpperCase()}
                LIMIT ? OFFSET ?
              `;
            }
            
            // Execute the appropriate query
            db.all(sql, [orderId, limit, offset], (err, rows) => {
              if (err) {
                logger.error(`Error retrieving order history for ${orderId}:`, err);
                return reject(err);
              }
              
              if (!rows || rows.length === 0) {
                // Return empty history array rather than error
                return resolve({ 
                  success: true, 
                  history: [],
                  pagination: {
                    total: 0,
                    limit,
                    offset,
                    hasMore: false
                  }
                });
              }
              
              // Format the history entries based on schema
              const history = rows.map(row => {
                if (row.action_timestamp) {
                  // First schema format
                  try {
                    return {
                      id: row.id,
                      orderId: row.order_id,
                      actionType: row.action_type,
                      timestamp: row.action_timestamp,
                      modifiedBy: row.modified_by,
                      reason: row.reason,
                      previousData: row.previous_data ? JSON.parse(row.previous_data) : null,
                      newData: row.new_data ? JSON.parse(row.new_data) : null
                    };
                  } catch (e) {
                    logger.error('Error parsing JSON in history row:', e);
                    return {
                      id: row.id,
                      orderId: row.order_id,
                      actionType: row.action_type,
                      timestamp: row.action_timestamp,
                      modifiedBy: row.modified_by,
                      reason: row.reason,
                      previousData: null,
                      newData: null,
                      parseError: true
                    };
                  }
                } else {
                  // Second schema format
                  let details = row.details;
                  try {
                    if (typeof details === 'string' && details.trim()) {
                      details = JSON.parse(details);
                    }
                  } catch (e) {
                    // Keep as-is if not valid JSON
                  }
                  
                  let metadata = row.metadata;
                  try {
                    if (typeof metadata === 'string' && metadata.trim()) {
                      metadata = JSON.parse(metadata);
                    }
                  } catch (e) {
                    // Keep as-is if not valid JSON
                  }
                  
                  return {
                    id: row.id,
                    orderId: row.order_id,
                    action: row.action,
                    timestamp: row.timestamp,
                    userId: row.user_id,
                    userName: row.user_name,
                    details,
                    metadata
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
                      total: countResult ? countResult.total : history.length,
                      limit,
                      offset,
                      hasMore: countResult ? (offset + limit < countResult.total) : false
                    }
                  });
                }
              );
            });
          });
      } catch (error) {
        logger.error('Error getting order history:', error);
        reject(error);
      }
    });
  },

  /**
   * Search for orders by medication name
   * @param {string} medicationName - Medication name to search for
   * @param {Object} options - Optional parameters (limit, offset, etc.)
   * @returns {Promise} - Promise resolving to array of matching orders
   */
  /**
   * Search for orders by medication name
   * @param {string} medicationName - Medication name to search for
   * @param {Object} options - Optional parameters (limit, offset, etc.)
   * @returns {Promise} - Promise resolving to array of matching orders
   */
  searchOrdersByMedication(medicationName, options = {}) {
    return new Promise((resolve, reject) => {
      const limit = options.limit || 50; // Default to 50 results
      const offset = options.offset || 0;

      if (!medicationName) {
        return resolve([]); // Return empty array if no search term
      }

      // Use LIKE query to search for medication name
      const searchParam = `%${medicationName}%`;

      // Query orders that have medications matching the search term
      db.all(
        `SELECT DISTINCT o.* 
         FROM orders o
         JOIN order_medications m ON o.id = m.order_id
         WHERE m.name LIKE ? 
         ORDER BY o.timestamp DESC
         LIMIT ? OFFSET ?`,
        [searchParam, limit, offset],
        async (err, orders) => {
          if (err) {
            console.error('Error searching orders by medication:', err);
            return reject(err);
          }

          // If no matching orders, return empty array
          if (!orders || orders.length === 0) {
            return resolve([]);
          }

          try {
            // Process each order to get full details
            const orderPromises = orders.map(order => this.getOrderById(order.id));
            const fullOrders = await Promise.all(orderPromises);
            
            // Filter out any null results (in case any orders were deleted)
            resolve(fullOrders.filter(order => order != null));
          } catch (error) {
            console.error('Error fetching full order details:', error);
            reject(error);
          }
        }
      );
    }).catch(error => {
      console.error('Error in searchOrdersByMedication:', error);
      throw error;
    });
  },
  
  /**
   * Advanced search for orders with multiple filter criteria
   * - Search by tokens across medication names and patient names
   * - Filter by ward/location
   * 
   * @param {string} primarySearchTerm - Main search term (displayed in UI)
   * @param {Object} options - Search options
   * @param {Array} options.searchTokens - Array of search tokens for multi-word search
   * @param {string} options.wardId - Optional ward ID to filter by location
   * @param {number} options.limit - Maximum number of results to return
   * @param {number} options.offset - Offset for pagination
   * @returns {Promise} - Promise resolving to array of matching orders
   */
  advancedOrderSearch(primarySearchTerm, options = {}) {
    return new Promise((resolve, reject) => {
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const wardId = options.wardId || null;
      const searchTokens = options.searchTokens || [];
      
      console.log(`Advanced search with tokens: [${searchTokens.join(', ')}], wardId: ${wardId}`);
      
      if (!primarySearchTerm && searchTokens.length === 0) {
        return resolve([]);
      }
      
      // Build dynamic query based on search parameters
      let query = `
        SELECT DISTINCT o.* 
        FROM orders o
        JOIN order_medications m ON o.id = m.order_id
        LEFT JOIN order_patients p ON o.id = p.order_id
        WHERE 1=1`;
      
      const params = [];
      
      // Add medication name conditions
      if (searchTokens.length > 0) {
        // Create groups of conditions for each token
        const tokenConditions = [];
        
        searchTokens.forEach(token => {
          const tokenParam = `%${token}%`;
          // For each token, create a condition group that matches either medication or patient name
          tokenConditions.push(`(m.name LIKE ? OR p.patient_name LIKE ?)`);
          params.push(tokenParam, tokenParam);
        });
        
        // Join token conditions with AND to require all tokens to match
        query += ` AND (${ tokenConditions.join(' AND ') })`;
      } else if (primarySearchTerm) {
        // Basic search if no tokens
        const searchParam = `%${primarySearchTerm}%`;
        query += ` AND (m.name LIKE ? OR p.patient_name LIKE ?)`;
        params.push(searchParam, searchParam);
      }
      
      // Add ward filter if specified
      if (wardId) {
        query += ` AND o.ward_id = ?`;
        params.push(wardId);
      }
      
      // Add order and limit
      query += `
        ORDER BY o.timestamp DESC
        LIMIT ? OFFSET ?`;
      
      params.push(limit, offset);
      
      // Execute the query
      db.all(query, params, async (err, orders) => {
        if (err) {
          console.error('Error in advanced search:', err);
          return reject(err);
        }
        
        // If no matching orders, return empty array
        if (!orders || orders.length === 0) {
          return resolve([]);
        }
        
        try {
          // Process each order to get full details
          const orderPromises = orders.map(order => this.getOrderById(order.id));
          const fullOrders = await Promise.all(orderPromises);
          
          // Filter out any null results (in case any orders were deleted)
          resolve(fullOrders.filter(order => order != null));
        } catch (error) {
          console.error('Error fetching full order details:', error);
          reject(error);
        }
      });
    }).catch(error => {
      console.error('Error in advancedOrderSearch:', error);
      throw error;
    });
  },

  /**
   * Check for recent medication orders for a patient or ward stock within the last 14/2 days
   * @param {Object} patientData - Patient identification data
   * @param {Array} medications - List of medications to check
   * @param {string} wardId - Ward ID for ward stock orders
   * @param {Function} callback - Callback function
   */
  checkRecentMedicationOrders(patientData, medications, wardId, callback) {
    console.log('[DEBUG - OrderModel] Starting checkRecentMedicationOrders with:', 
               JSON.stringify({patientData, medications: medications.map(m => m.name || m.medication_name), wardId}, null, 2));
    
    return new Promise((resolve, reject) => {
          
      // Extract patient identifiers
      const { patientName, nhsNumber, hospitalNumber } = patientData;
      
      // We need at least one identifier to find the patient
      // For reliable results, prioritize hospital/NHS numbers over names (which may be encrypted)
      // Note: For ward stock orders, the hospitalNumber is used to store the wardId
      if (!hospitalNumber && !nhsNumber && !patientName) {
        logger.info('Cannot check recent medications: No patient identifiers provided');
        return resolve([]);
      }
      
      // Check if this is a ward stock request (hospital number is actually a ward ID)
      const isWardStock = hospitalNumber && hospitalNumber.startsWith('ward-');

      // Calculate cutoff date - 2 days for ward stock, 14 days for patient meds
      const cutoffDate = new Date();
      if (isWardStock) {
        // Use 2-day window for ward stock orders
        cutoffDate.setDate(cutoffDate.getDate() - 2);
        logger.info(`Using 2-day window for ward stock duplicate check`);
      } else {
        // Use 14-day window for patient medication orders
        cutoffDate.setDate(cutoffDate.getDate() - 14);
        logger.info(`Using 14-day window for patient medication duplicate check`);
      }
      const cutoffDateStr = cutoffDate.toISOString();

      // Build medication names list for the query
      const medicationNames = medications.map(med => med.name?.toLowerCase()).filter(name => name);
      if (!medicationNames.length) {
        return resolve([]);
      }

      // Prepare query parameters
      const queryParams = [cutoffDateStr];
      
      // Build matching condition based on whether this is a ward stock order or patient order
      // For ward stock: use ward_id in orders table
      // For patient: use patient identifiers from order_patients table
      let whereConditions = [];
      
      // LOGGING: All data we have
      logger.info(`DEBUG - Data received: ${JSON.stringify(patientData)}`);
      logger.info(`DEBUG - Is Ward Stock: ${isWardStock}`);

      if (isWardStock) {
        // For ward stock orders, match directly on ward_id in orders table
        whereConditions.push('o.type = "ward-stock"');
        whereConditions.push('o.ward_id = ?');
        // Strip the "ward-" prefix when matching ward_id in the database
        const actualWardId = hospitalNumber.replace(/^ward-/, '');
        queryParams.push(actualWardId); // Strip prefix to match the stored value
        logger.info(`DEBUG - Using ward_id for matching: o.ward_id = '${actualWardId}' (from ${hospitalNumber})`);
      } else {
        // For patient orders, use patient identifiers
        whereConditions.push('o.type = "patient"');
        
        // Build patient matching condition prioritizing hospital/NHS numbers
        // NOTE: patient_name will be encrypted if encryption is enabled, so we can't reliably use it
        // for SQL matching. Instead, rely on hospital_id and nhs number which are not encrypted.
        const patientConditions = [];
        
        // Prioritize hospital number (most reliable, unencrypted identifier)
        if (hospitalNumber) {
          patientConditions.push('LOWER(p.patient_hospital_id) = LOWER(?)');
          queryParams.push(hospitalNumber);
          logger.info(`DEBUG - Using hospital number for matching: LOWER(p.patient_hospital_id) = LOWER('${hospitalNumber}')`);
        }
        
        // Next priority: NHS number (also unencrypted)
        if (nhsNumber) {
          patientConditions.push('p.patient_nhs = ?');
          queryParams.push(nhsNumber);
          logger.info(`DEBUG - Using NHS number for matching: p.patient_nhs = '${nhsNumber}'`);
        }
        
        // Only use patient name if we have no other identifiers AND encryption isn't configured
        // This prevents trying to match plaintext against encrypted values
        if (!hospitalNumber && !nhsNumber && patientName && !encryption.isEncryptionConfigured()) {
          patientConditions.push('LOWER(p.patient_name) LIKE LOWER(?)');
          queryParams.push(`%${patientName}%`);
        }
        
        // If no usable patient matching conditions for a patient order, return empty results
        if (patientConditions.length === 0) {
          logger.info('Cannot build patient condition: No usable unencrypted patient identifiers');
          return resolve([]);
        }
        
        // Add patient conditions to the where clause
        whereConditions.push(`(${patientConditions.join(' OR ')})`);
      }
      
      const whereConditionStr = whereConditions.map(cond => `AND ${cond}`).join(' ');

      // Transform medication names for more flexible matching
      const transformedMedNames = medicationNames.map(name => {
        // Tokenize the medication name to make matching more flexible
        // Example: "Aspirin 75mg tablets" -> ["aspirin", "75mg", "tablets"]
        const tokens = name.toLowerCase().split(/\s+/);
        
        // Take the first token as the base name and filter out common suffixes
        let baseName = tokens[0];
        // Strip any non-alphanumeric characters for more flexible matching
        baseName = baseName.replace(/[^a-z0-9]/g, '');
        
        // Log the transformation for debugging
        logger.info(`Transformed medication "${name}" to base name "${baseName}"`);
        
        return baseName;
      });
      
      // Build medication conditions with very flexible LIKE operators
      const medConditions = transformedMedNames.map(() => 'LOWER(m.name) LIKE ?');
      
      // Use more permissive wildcards for better matching possibilities
      const medParams = transformedMedNames.map(name => `%${name}%`);
      
      // Log all medication patterns we're looking for
      logger.info(`Looking for medication patterns: ${JSON.stringify(medParams)}`);
      
      queryParams.push(...medParams);
      
      // Add query to search for exact medication names as entered
      medicationNames.forEach(fullName => {
        medConditions.push('LOWER(m.name) LIKE ?');
        queryParams.push(`%${fullName.toLowerCase()}%`);
        logger.info(`Also checking for exact match: %${fullName.toLowerCase()}%`);
      });
      
      const medicationCondition = `AND (${medConditions.join(' OR ')})`;
      
      // Build the SQL query with proper joins
      let sql;
      
      if (isWardStock) {
        // For ward stock orders, we don't need to join with patient table, but we do need to join with wards table to get ward name
        sql = `
          SELECT o.id, o.type, o.timestamp, o.status, o.requester_name, o.ward_id,
                 m.name as medication_name, m.quantity, m.form as formulation, m.strength, m.dose,
                 NULL as patient_name, NULL as patient_hospital_id, NULL as patient_nhs,
                 w.name as ward_name
          FROM orders o
          JOIN order_medications m ON o.id = m.order_id
          LEFT JOIN wards w ON o.ward_id = w.id
          WHERE o.timestamp >= ?
            ${whereConditionStr}
            ${medicationCondition}
          ORDER BY o.timestamp DESC
        `;
      } else {
        // For patient orders, join with patient table and wards table
        sql = `
          SELECT o.id, o.type, o.timestamp, o.status, o.requester_name, o.ward_id,
                 m.name as medication_name, m.quantity, m.dose, m.form as formulation, m.strength,
                 p.patient_name, p.patient_hospital_id, p.patient_nhs,
                 w.name as ward_name
          FROM orders o
          JOIN order_patients p ON o.id = p.order_id
          JOIN order_medications m ON o.id = m.order_id
          LEFT JOIN wards w ON o.ward_id = w.id
          WHERE o.timestamp >= ?
            ${whereConditionStr}
            ${medicationCondition}
          ORDER BY o.timestamp DESC
        `;
      }
      
      // Log the query for debugging
      logger.info('Recent medication check SQL:', sql);
      logger.info('Parameters:', JSON.stringify(queryParams));

      // Debug query check - Run direct query to see what's in the database for this patient
      logger.info('DEBUGGING - Running direct database query to check what orders exist for this patient');
      db.all(
        `SELECT o.id, o.timestamp, p.patient_name, p.patient_hospital_id, p.patient_nhs, m.name as medication_name 
         FROM orders o 
         JOIN order_patients p ON o.id = p.order_id 
         JOIN order_medications m ON o.id = m.order_id 
         WHERE LOWER(p.patient_hospital_id) LIKE ? 
         ORDER BY o.timestamp DESC LIMIT 10`,
        [`%${hospitalNumber}%`],
        (debugErr, debugRows) => {
          if (debugErr) {
            logger.error('Debug query error:', debugErr);
          } else {
            logger.info(`DEBUGGING - Found ${debugRows.length} orders for hospital ID like '${hospitalNumber}'`);
            debugRows.forEach((row, idx) => {
              let patientNameDisplay = row.patient_name;
              // Try to decrypt if needed
              if (encryption.isEncryptionConfigured() && patientNameDisplay) {
                try {
                  patientNameDisplay = encryption.decrypt(patientNameDisplay);
                } catch (e) {
                  patientNameDisplay = '(encrypted)';
                }
              }
              logger.info(`DEBUGGING - Order ${idx+1}: ID=${row.id}, Date=${row.timestamp}, Patient=${patientNameDisplay} (${row.patient_hospital_id}/${row.patient_nhs}), Med=${row.medication_name}`);
            });
          }
        }
      );

      // Execute the actual query for recent medications
      logger.info('Executing final query with all conditions');
      db.all(sql, queryParams, (err, rows) => {
        if (err) {
          console.error('Error checking recent medication orders:', err);
          return reject(err);
        }

        logger.info(`DEBUGGING - Query returned ${rows.length} rows`);
        if (rows.length === 0) {
          logger.info('DEBUGGING - No matches found with query. Possible issues:');
          logger.info('DEBUGGING - 1. Patient identifiers do not match exactly what is in database');
          logger.info('DEBUGGING - 2. Medication name format differs from what is in database');
          logger.info('DEBUGGING - 3. Orders might be older than 14 days');
        } else {
          logger.info('DEBUGGING - Raw matches from database:');
          rows.forEach((row, idx) => {
            logger.info(`DEBUGGING - Match ${idx+1}: ID=${row.id}, Date=${row.timestamp}, Medication=${row.medication_name}`);
          });
        }

        // Map each row to a structured order object
        const recentOrders = rows.map(row => {
          // Debug the raw database row
          logger.info('Raw database row for recent order:', JSON.stringify(row));
          
          // Create the medication object within the order
          const medication = {
            name: row.medication_name,
            formulation: row.formulation || row.form, // Support both column names
            quantity: row.quantity,
            strength: row.strength,
            dose: row.dose || null // Always include dose field even if null
          };

          // Get ward name from ward_id if available
          let wardName = null;
          if (row.ward_name) {
            // Use the ward name from the query result
            wardName = row.ward_name;
          } else if (row.ward_id) {
            // Fallback if ward name wasn't joined
            wardName = `Ward ${row.ward_id}`;
          }

          let displayPatientName = "Patient";
          
          // Try to decrypt patient name from the row if encryption is enabled
          if (row.patient_name && encryption.isEncryptionConfigured()) {
            try {
              displayPatientName = encryption.decrypt(row.patient_name);
            } catch (decryptErr) {
              // If decryption fails, just use identifiers
              logger.warn(`Could not decrypt patient name for order ${row.id}`, decryptErr);
              displayPatientName = row.patient_nhs || row.patient_hospital_id || "Patient";
            }
          } else if (row.patient_name) {
            // If encryption is not enabled, use patient name as-is
            displayPatientName = row.patient_name;
          }

          const orderObject = {
            id: row.id,
            type: row.type,
            timestamp: row.timestamp,
            status: row.status,
            requesterName: row.requester_name, 
            wardId: row.ward_id,
            wardName: wardName,
            patientName: displayPatientName,
            patientHospitalId: row.patient_hospital_id,
            patientNhs: row.patient_nhs,
            medication
          };
          
          // Debug the mapped order object
          logger.info('Mapped order object for response:', JSON.stringify(orderObject));
          
          return orderObject;
        });

        logger.info(`Found ${recentOrders.length} recent medication orders`);
        if (recentOrders.length > 0) {
          logger.info('Sample recent order:', JSON.stringify(recentOrders[0]));
        }
        resolve(recentOrders);
      });
    });
  },
};

module.exports = OrderModel;
