/**
 * OrderGroup model - handles group-related operations 
 */
const { db } = require('../db/init');
const { getTimestamp } = require('../utils/timestamp');

class OrderGroupModel {
    /**
     * Creates a new order group
     * @param {object} groupData - Group data including orderIds, groupNumber and notes
     * @returns {Promise<object>} Created group data
     */
    async createGroup(groupData) {
        const { orderIds, groupNumber, notes } = groupData;
        
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            throw new Error('Order IDs must be a non-empty array');
        }
        
        if (!groupNumber) {
            throw new Error('Group number is required');
        }
        
        const timestamp = getTimestamp();
        
        return new Promise((resolve, reject) => {
            // Use SQLite's run method with a transaction
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                // Insert new group into order_groups table
                db.run(
                    'INSERT INTO order_groups (group_number, notes, timestamp) VALUES (?, ?, ?)',
                    [groupNumber, notes || '', timestamp],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        
                        const groupId = this.lastID;
                        
                        // Create a promise for each order update
                        const updatePromises = orderIds.map(orderId => {
                            return new Promise((resolveUpdate, rejectUpdate) => {
                                db.run(
                                    'UPDATE orders SET group_id = ? WHERE id = ?',
                                    [groupId, orderId],
                                    (err) => {
                                        if (err) return rejectUpdate(err);
                                        resolveUpdate();
                                    }
                                );
                            });
                        });
                        
                        // Process all updates
                        Promise.all(updatePromises)
                            .then(() => {
                                db.run('COMMIT', (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }
                                    
                                    // Return the created group
                                    resolve({
                                        id: groupId,
                                        groupNumber,
                                        notes,
                                        timestamp,
                                        orderIds
                                    });
                                });
                            })
                            .catch(error => {
                                db.run('ROLLBACK');
                                reject(error);
                            });
                    }
                );
            });
        });
    }
    
    /**
     * Gets all groups
     * @returns {Promise<Array>} Array of groups
     */
    async getGroups() {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM order_groups ORDER BY timestamp DESC',
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }
    
    /**
     * Gets a group by ID
     * @param {number} groupId - Group ID
     * @returns {Promise<object>} Group data
     */
    async getGroupById(groupId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM order_groups WHERE id = ?',
                [groupId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);
                    
                    const group = row;
                    
                    // Get orders in this group
                    db.all(
                        'SELECT id FROM orders WHERE group_id = ?',
                        [groupId],
                        (err, orderRows) => {
                            if (err) return reject(err);
                            
                            group.orderIds = orderRows.map(row => row.id);
                            resolve(group);
                        }
                    );
                }
            );
        });
    }
}

module.exports = new OrderGroupModel();
