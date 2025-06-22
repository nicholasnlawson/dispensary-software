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

// Middleware to check if user has specific role(s)
const hasRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    // Handle both single role string and array of roles
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    // Check if user has at least one of the required roles
    const hasRequiredRole = requiredRoles.some(role => req.user.roles.includes(role));
    
    if (!hasRequiredRole) {
      return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
    }
    
    next();
  };
};

// Middleware to check if user has any admin role (admin, user-admin, or super-admin)
const hasAdminAccess = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    const adminRoles = ['admin', 'user-admin', 'super-admin'];
    const hasAnyAdminRole = adminRoles.some(role => req.user.roles.includes(role));
    
    if (!hasAnyAdminRole) {
      return res.status(403).json({ success: false, message: 'Access denied: admin permissions required' });
    }
    
    next();
  };
};

// Middleware to check if user has full admin access (admin or super-admin)
const hasFullAdminAccess = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    const fullAdminRoles = ['admin', 'super-admin'];
    const hasFullAdmin = fullAdminRoles.some(role => req.user.roles.includes(role));
    
    if (!hasFullAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied: full admin permissions required' });
    }
    
    next();
  };
};

module.exports = { 
  verifyToken, 
  hasRole, 
  hasAdminAccess, 
  hasFullAdminAccess,
  requireRole: hasRole 
};
