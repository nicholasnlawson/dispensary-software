/**
 * Validation middleware for NHS Pharmacy System
 */

const jwt = require('jsonwebtoken');

/**
 * Validate login request
 */
exports.validateLogin = (req, res, next) => {
  console.log('[VALIDATION] validateLogin middleware called with body:', req.body);
  const { username, password } = req.body;
  
  if (!username || !password) {
    console.log('[VALIDATION] Missing username or password');
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  console.log('[VALIDATION] Login validation passed');
  next();
};

/**
 * Validate token and set req.user
 */
exports.validateToken = (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token');
  
  // Check if no token
  if (!token) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Set user in request
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

/**
 * Check if user has admin access
 */
exports.isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  // Check if user has admin access
  const access = req.user.access;
  if (!access || !access.includes('admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

/**
 * Validate user creation/update data
 */
exports.validateUser = (req, res, next) => {
  const { username, email, access_levels } = req.body;
  
  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  // Check username format
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
    return res.status(400).json({ 
      error: 'Username must be 3-30 characters and contain only letters, numbers, underscore, period, or hyphen' 
    });
  }
  
  // Check email format if provided
  if (email && email.trim() !== '') {
    if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
  }
  
  // Validate access levels
  if (!access_levels || !Array.isArray(access_levels) || access_levels.length === 0) {
    return res.status(400).json({ error: 'At least one access level is required' });
  }
  
  const validAccessLevels = ['ordering', 'pharmacy', 'admin'];
  for (const level of access_levels) {
    if (!validAccessLevels.includes(level)) {
      return res.status(400).json({ 
        error: `Invalid access level: ${level}. Valid values are: ${validAccessLevels.join(', ')}` 
      });
    }
  }
  
  next();
};

/**
 * Validate system setting update
 */
exports.validateSetting = (req, res, next) => {
  const { value } = req.body;
  
  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'Setting value is required' });
  }
  
  next();
};
