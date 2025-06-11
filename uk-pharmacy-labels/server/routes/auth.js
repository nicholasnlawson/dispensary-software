/**
 * Authentication routes for NHS Pharmacy System
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Import middleware
const { validateLogin, validateToken } = require('../middleware/validation');

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post('/login', validateLogin, async (req, res) => {
  console.log('[AUTH] Login attempt received', req.body);
  const { username, password } = req.body;
  const db = req.app.locals.db;
  console.log('[AUTH] Database connection:', db ? 'Available' : 'Not available');
  
  try {
    console.log('[AUTH] Looking up user:', username);
    // Get user from database
    const userResult = await db.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    console.log('[AUTH] User query result:', userResult ? `Found ${userResult.rows?.length} users` : 'No results');
    
    const user = userResult.rows[0];
    
    // Log login attempt (regardless of success)
    await db.query(
      'INSERT INTO login_attempts (username, ip_address, success) VALUES ($1, $2, $3)',
      [username, req.ip, false] // Default to false, update if successful
    );
    
    // Check if user exists
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if account is active
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is disabled' });
    }
    
    // Check for account lockout
    const lockoutResult = await db.query(
      `SELECT COUNT(*) FROM login_attempts 
       WHERE username = $1 AND success = false AND 
       timestamp > NOW() - INTERVAL '30 minutes'`,
      [username]
    );
    
    // Get lockout threshold from system settings
    const settingsResult = await db.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'failed_login_lockout'"
    );
    const lockoutThreshold = parseInt(settingsResult.rows[0]?.setting_value || '5');
    
    if (parseInt(lockoutResult.rows[0].count) >= lockoutThreshold) {
      return res.status(401).json({ 
        error: 'Account temporarily locked due to multiple failed login attempts' 
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update login success
    await db.query(
      'UPDATE login_attempts SET success = true WHERE username = $1 AND ip_address = $2 ORDER BY timestamp DESC LIMIT 1',
      [username, req.ip]
    );
    
    // Update last login time
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    // Create audit log entry
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [user.id, 'login', 'user', user.id, req.ip]
    );
    
    // Create payload for JWT
    const payload = {
      user: {
        id: user.id,
        username: user.username,
        access: user.access_levels
      }
    };
    
    // Generate JWT token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
      (err, token) => {
        if (err) throw err;
        
        // Return user data (without sensitive info) and token
        const safeUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          access_levels: user.access_levels,
          is_default: user.is_default,
          last_login: user.last_login
        };
        
        res.json({ token, user: safeUser });
      }
    );
    
  } catch (err) {
    console.error('[AUTH] Login error details:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token and return user data
 * @access  Private
 */
router.get('/verify', validateToken, async (req, res) => {
  try {
    // User data is already in req.user from the validateToken middleware
    const db = req.app.locals.db;
    
    // Get fresh user data from database
    const result = await db.query(
      'SELECT id, username, email, access_levels, is_default, last_login, is_active FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const user = result.rows[0];
    
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    
    res.json({ user });
    
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Log user out and invalidate token (client-side)
 * @access  Private
 */
router.post('/logout', validateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Create audit log entry
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'logout', 'user', req.user.id, req.ip]
    );
    
    // Note: JWT cannot be invalidated server-side without a blacklist/database
    // The client should remove the token from storage
    
    res.json({ message: 'Logout successful' });
    
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
