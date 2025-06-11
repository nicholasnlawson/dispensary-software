const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
require('dotenv').config();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!token) {
    logger.logSecurityEvent('ANONYMOUS', 'MISSING_TOKEN', { 
      path: req.path, 
      method: req.method 
    }, ip);
    return res.status(401).json({ error: 'Access denied' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    
    // Log successful authentication
    logger.logAuth(verified.id, 'TOKEN_VERIFY', true, {
      userId: verified.id,
      username: verified.username,
      roles: verified.roles,
      path: req.path
    }, ip);
    
    next();
  } catch (error) {
    logger.logSecurityEvent('ANONYMOUS', 'INVALID_TOKEN', {
      path: req.path, 
      method: req.method,
      error: error.message
    }, ip);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to check if user has specific role
const hasRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    if (!req.user.roles.includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
    }
    
    next();
  };
};

module.exports = { verifyToken, hasRole };
