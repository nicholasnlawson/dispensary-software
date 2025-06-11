const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { db } = require('../db/init');
const { verifyToken, hasRole } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(verifyToken);

// Get all users (admin only)
router.get('/', hasRole('admin'), (req, res) => {
  db.all(
    `SELECT u.id, u.username, u.email, u.created_at, u.last_login, u.is_active
     FROM users u
     ORDER BY u.username`,
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      // Get roles for each user
      const userPromises = users.map(user => {
        return new Promise((resolve, reject) => {
          db.all(
            `SELECT r.name
             FROM roles r
             JOIN user_roles ur ON r.id = ur.role_id
             WHERE ur.user_id = ?`,
            [user.id],
            (err, roles) => {
              if (err) {
                reject(err);
              } else {
                resolve({
                  ...user,
                  roles: roles.map(role => role.name)
                });
              }
            }
          );
        });
      });
      
      Promise.all(userPromises)
        .then(usersWithRoles => {
          res.json({
            success: true,
            users: usersWithRoles
          });
        })
        .catch(err => {
          res.status(500).json({ success: false, message: 'Error retrieving user roles' });
        });
    }
  );
});

// Get specific user by ID (admin only)
router.get('/:id', hasRole('admin'), (req, res) => {
  const userId = req.params.id;
  
  db.get(
    `SELECT u.id, u.username, u.email, u.created_at, u.last_login, u.is_active
     FROM users u
     WHERE u.id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      // Get user roles
      db.all(
        `SELECT r.name
         FROM roles r
         JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
        [userId],
        (err, roles) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Error retrieving user roles' });
          }
          
          const userRoles = roles.map(role => role.name);
          
          res.json({
            success: true,
            user: {
              ...user,
              roles: userRoles
            }
          });
        }
      );
    }
  );
});

// Update user (admin only)
router.put('/:id', hasRole('admin'), async (req, res) => {
  const userId = req.params.id;
  const { username, email, password, roles, is_active } = req.body;
  
  // Check if user exists
  db.get('SELECT id FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Begin transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Update user information
      const updateFields = [];
      const updateParams = [];
      
      if (username) {
        updateFields.push('username = ?');
        updateParams.push(username);
      }
      
      if (email) {
        updateFields.push('email = ?');
        updateParams.push(email);
      }
      
      if (password) {
        // Hash the new password
        bcrypt.hash(password, 10, (err, passwordHash) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ success: false, message: 'Error hashing password' });
          }
          
          updateFields.push('password_hash = ?');
          updateParams.push(passwordHash);
          
          continueUpdate();
        });
      } else {
        continueUpdate();
      }
      
      function continueUpdate() {
        if (is_active !== undefined) {
          updateFields.push('is_active = ?');
          updateParams.push(is_active ? 1 : 0);
        }
        
        // Only update if there are fields to update
        if (updateFields.length > 0) {
          const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
          updateParams.push(userId);
          
          db.run(query, updateParams, function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: 'Error updating user' });
            }
            
            // Update roles if provided
            if (roles && Array.isArray(roles)) {
              // Delete existing roles
              db.run('DELETE FROM user_roles WHERE user_id = ?', [userId], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ success: false, message: 'Error updating roles' });
                }
                
                // Get role IDs for the requested roles
                const rolePromises = roles.map(role => {
                  return new Promise((resolve, reject) => {
                    db.get('SELECT id FROM roles WHERE name = ?', [role], (err, row) => {
                      if (err || !row) {
                        reject(new Error(`Role ${role} not found`));
                      } else {
                        resolve(row.id);
                      }
                    });
                  });
                });
                
                Promise.all(rolePromises)
                  .then(roleIds => {
                    // Insert user roles
                    const userRoleInserts = roleIds.map(roleId => {
                      return new Promise((resolve, reject) => {
                        db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                          [userId, roleId],
                          (err) => {
                            if (err) {
                              reject(err);
                            } else {
                              resolve();
                            }
                          });
                      });
                    });
                    
                    Promise.all(userRoleInserts)
                      .then(() => {
                        db.run('COMMIT');
                        res.json({
                          success: true,
                          message: 'User updated successfully'
                        });
                      })
                      .catch(err => {
                        db.run('ROLLBACK');
                        res.status(500).json({ success: false, message: 'Error assigning roles' });
                      });
                  })
                  .catch(err => {
                    db.run('ROLLBACK');
                    res.status(400).json({ success: false, message: err.message });
                  });
              });
            } else {
              db.run('COMMIT');
              res.json({
                success: true,
                message: 'User updated successfully'
              });
            }
          });
        } else if (roles && Array.isArray(roles)) {
          // Only update roles
          // Delete existing roles
          db.run('DELETE FROM user_roles WHERE user_id = ?', [userId], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: 'Error updating roles' });
            }
            
            // Get role IDs for the requested roles
            const rolePromises = roles.map(role => {
              return new Promise((resolve, reject) => {
                db.get('SELECT id FROM roles WHERE name = ?', [role], (err, row) => {
                  if (err || !row) {
                    reject(new Error(`Role ${role} not found`));
                  } else {
                    resolve(row.id);
                  }
                });
              });
            });
            
            Promise.all(rolePromises)
              .then(roleIds => {
                // Insert user roles
                const userRoleInserts = roleIds.map(roleId => {
                  return new Promise((resolve, reject) => {
                    db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                      [userId, roleId],
                      (err) => {
                        if (err) {
                          reject(err);
                        } else {
                          resolve();
                        }
                      });
                  });
                });
                
                Promise.all(userRoleInserts)
                  .then(() => {
                    db.run('COMMIT');
                    res.json({
                      success: true,
                      message: 'User roles updated successfully'
                    });
                  })
                  .catch(err => {
                    db.run('ROLLBACK');
                    res.status(500).json({ success: false, message: 'Error assigning roles' });
                  });
              })
              .catch(err => {
                db.run('ROLLBACK');
                res.status(400).json({ success: false, message: err.message });
              });
          });
        } else {
          db.run('COMMIT');
          res.json({
            success: true,
            message: 'No changes made to user'
          });
        }
      }
    });
  });
});

// Delete user (admin only)
router.delete('/:id', hasRole('admin'), (req, res) => {
  const userId = req.params.id;
  
  // Prevent deleting yourself
  if (userId === req.user.id.toString()) {
    return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
  }
  
  db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error deleting user' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  });
});

// Change password (user can change their own password)
router.post('/change-password', (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current password and new password required' });
  }
  
  // Get user's current password hash
  db.get('SELECT password_hash FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Error updating password' });
      }
      
      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    });
  });
});

module.exports = router;
