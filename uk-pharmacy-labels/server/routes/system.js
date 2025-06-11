/**
 * System settings routes for NHS Pharmacy System
 */

const express = require('express');
const router = express.Router();

// Import middleware
const { validateToken, isAdmin } = require('../middleware/validation');

/**
 * @route   GET /api/system/settings
 * @desc    Get all system settings
 * @access  Private/Admin
 */
router.get('/settings', validateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      'SELECT * FROM system_settings ORDER BY setting_key'
    );
    
    res.json(result.rows);
    
  } catch (err) {
    console.error('Error fetching system settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   PUT /api/system/settings/:key
 * @desc    Update a system setting
 * @access  Private/Admin
 */
router.put('/settings/:key', validateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { value } = req.body;
    const key = req.params.key;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Setting value is required' });
    }
    
    // Check if setting exists
    const settingCheck = await db.query(
      'SELECT setting_key FROM system_settings WHERE setting_key = $1',
      [key]
    );
    
    if (settingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    // Update setting
    const result = await db.query(
      `UPDATE system_settings 
       SET setting_value = $1, updated_at = NOW(), updated_by = $2 
       WHERE setting_key = $3 
       RETURNING *`,
      [value, req.user.id, key]
    );
    
    // Create audit log entry
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        req.user.id, 
        'update', 
        'system_setting', 
        key, 
        JSON.stringify({ key, value }), 
        req.ip
      ]
    );
    
    res.json(result.rows[0]);
    
  } catch (err) {
    console.error(`Error updating system setting ${req.params.key}:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/system/audit-logs
 * @desc    Get audit logs with pagination
 * @access  Private/Admin
 */
router.get('/audit-logs', validateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    // Get audit logs with user info
    const result = await db.query(
      `SELECT al.*, u.username 
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.timestamp DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    // Get total count for pagination
    const countResult = await db.query('SELECT COUNT(*) FROM audit_logs');
    const totalCount = parseInt(countResult.rows[0].count);
    
    res.json({
      logs: result.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
    
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/system/database-info
 * @desc    Get database information for monitoring
 * @access  Private/Admin
 */
router.get('/database-info', validateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Get table sizes and counts
    const dbStats = await db.query(`
      SELECT
        table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size,
        (SELECT reltuples FROM pg_class WHERE relname = table_name) as rows
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
    `);
    
    // Get database version
    const versionInfo = await db.query('SELECT version()');
    
    res.json({
      tables: dbStats.rows,
      version: versionInfo.rows[0].version
    });
    
  } catch (err) {
    console.error('Error fetching database info:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/system/login-stats
 * @desc    Get login statistics
 * @access  Private/Admin
 */
router.get('/login-stats', validateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Get login attempts in the last 24 hours
    const recentLogins = await db.query(`
      SELECT 
        success, 
        COUNT(*) as count,
        date_trunc('hour', timestamp) as hour
      FROM login_attempts
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY hour, success
      ORDER BY hour, success
    `);
    
    // Get overall success/failure counts
    const overallStats = await db.query(`
      SELECT 
        success, 
        COUNT(*) as count
      FROM login_attempts
      GROUP BY success
    `);
    
    // Get top failed login usernames
    const topFailures = await db.query(`
      SELECT 
        username, 
        COUNT(*) as count
      FROM login_attempts
      WHERE success = false
      GROUP BY username
      ORDER BY count DESC
      LIMIT 10
    `);
    
    res.json({
      recent: recentLogins.rows,
      overall: overallStats.rows,
      topFailures: topFailures.rows
    });
    
  } catch (err) {
    console.error('Error fetching login stats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
