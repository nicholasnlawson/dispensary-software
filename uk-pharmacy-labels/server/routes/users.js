/**
 * User management routes for NHS Pharmacy System
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Import middleware
const { validateToken, isAdmin, validateUser } = require('../middleware/validation');

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private/Admin
 */
router.get('/', validateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Get all users, excluding password hashes
    const result = await db.query(
      `SELECT id, username, email, access_levels, is_active, 
       is_default, last_login, created_at, updated_at 
       FROM users ORDER BY username`
    );
    
    res.json(result.rows);
    
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private/Admin
 */
router.get('/:id', validateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.params.id;
    
    // Get user by ID, excluding password hash
    const result = await db.query(
      `SELECT id, username, email, access_levels, is_active, 
       is_default, last_login, created_at, updated_at 
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
    
  } catch (err) {
    console.error(`Error fetching user ${req.params.id}:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Private/Admin
 */
router.post('/', validateToken, isAdmin, validateUser, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { username, email, password, access_levels, is_active } = req.body;
    
    // Check if username already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Insert new user
    const result = await db.query(
      `INSERT INTO users 
       (username, email, password_hash, access_levels, is_active) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, username, email, access_levels, is_active, created_at`,
      [username, email, passwordHash, JSON.stringify(access_levels), is_active]
    );
    
    // Create audit log entry
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        req.user.id, 
        'create', 
        'user', 
        result.rows[0].id, 
        JSON.stringify({ username, email, access_levels, is_active }), 
        req.ip
      ]
    );
    
    res.status(201).json(result.rows[0]);
    
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update a user
 * @access  Private/Admin
 */
router.put('/:id', validateToken, isAdmin, validateUser, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.params.id;
    const { username, email, access_levels, is_active } = req.body;
    
    // Check if user exists
    const userCheck = await db.query(
      'SELECT id, is_default FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if trying to deactivate a default admin user
    const user = userCheck.rows[0];
    if (user.is_default && !is_active) {
      return res.status(400).json({ error: 'Cannot deactivate default admin user' });
    }
    
    // Update user
    const result = await db.query(
      `UPDATE users 
       SET username = $1, email = $2, access_levels = $3, is_active = $4, updated_at = NOW() 
       WHERE id = $5 
       RETURNING id, username, email, access_levels, is_active, updated_at`,
      [username, email, JSON.stringify(access_levels), is_active, userId]
    );
    
    // Create audit log entry
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        req.user.id, 
        'update', 
        'user', 
        userId, 
        JSON.stringify({ username, email, access_levels, is_active }), 
        req.ip
      ]
    );
    
    res.json(result.rows[0]);
    
  } catch (err) {
    console.error(`Error updating user ${req.params.id}:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user
 * @access  Private/Admin
 */
router.delete('/:id', validateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.params.id;
    
    // Check if user exists and is not default admin
    const userCheck = await db.query(
      'SELECT id, is_default, username FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deletion of default admin user
    const user = userCheck.rows[0];
    if (user.is_default) {
      return res.status(400).json({ error: 'Cannot delete default admin user' });
    }
    
    // Prevent self-deletion
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Delete user
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    
    // Create audit log entry
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        req.user.id, 
        'delete', 
        'user', 
        userId, 
        JSON.stringify({ username: user.username }), 
        req.ip
      ]
    );
    
    res.json({ message: 'User deleted successfully' });
    
  } catch (err) {
    console.error(`Error deleting user ${req.params.id}:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   PUT /api/users/:id/reset-password
 * @desc    Reset a user's password (admin function)
 * @access  Private/Admin
 */
router.put('/:id/reset-password', validateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.params.id;
    const { password } = req.body;
    
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Check if user exists
    const userCheck = await db.query(
      'SELECT id, username FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );
    
    // Create audit log entry
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'reset_password', 'user', userId, req.ip]
    );
    
    res.json({ message: 'Password reset successfully' });
    
  } catch (err) {
    console.error(`Error resetting password for user ${req.params.id}:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   PUT /api/users/:id/change-password
 * @desc    Change own password (user function)
 * @access  Private
 */
router.put('/change-password', validateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    
    // Get current user with password hash
    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword, 
      userResult.rows[0].password_hash
    );
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );
    
    // Create audit log entry
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'change_password', 'user', userId, req.ip]
    );
    
    res.json({ message: 'Password changed successfully' });
    
  } catch (err) {
    console.error(`Error changing password:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
