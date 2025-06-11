/**
 * GDPR-compliant Audit Logger
 * 
 * This module provides comprehensive audit logging for all actions
 * related to patient data and system access, as required for both GDPR
 * compliance and NHS Digital security standards.
 */
const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define custom format for audit logs
const auditFormat = winston.format.printf(({ level, message, timestamp, userId, action, resource, ip, success, details }) => {
  return JSON.stringify({
    timestamp,
    level,
    userId: userId || 'ANONYMOUS',
    action,
    resource,
    ip,
    success: success !== undefined ? success : true,
    details: details || {},
    message
  });
});

// Create logger for specific data access and modification events
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    auditFormat
  ),
  defaultMeta: { service: 'pharmacy-system' },
  transports: [
    // Write all logs to audit.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'audit.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    // Write errors to error.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});

// Add console output during development
if (process.env.NODE_ENV !== 'production') {
  auditLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Log user authentication events
 */
const logAuth = (userId, action, success, details, ip) => {
  auditLogger.info(`Authentication ${action} for user ${userId} from ${ip}`, {
    userId,
    action: `AUTH_${action.toUpperCase()}`,
    resource: 'auth',
    ip,
    success,
    details
  });
};

/**
 * Log data access events (reading patient data)
 */
const logDataAccess = (userId, dataType, recordId, details, ip) => {
  auditLogger.info(`User ${userId} accessed ${dataType} record ${recordId}`, {
    userId,
    action: 'DATA_ACCESS',
    resource: `${dataType}/${recordId}`,
    ip,
    details
  });
};

/**
 * Log data modification events (creating/updating patient data)
 */
const logDataModification = (userId, dataType, recordId, action, details, ip) => {
  auditLogger.info(`User ${userId} ${action} ${dataType} record ${recordId}`, {
    userId,
    action: `DATA_${action.toUpperCase()}`,
    resource: `${dataType}/${recordId}`,
    ip,
    details
  });
};

/**
 * Log administrative actions
 */
const logAdminAction = (userId, action, details, ip) => {
  auditLogger.info(`Admin action: ${action} by user ${userId}`, {
    userId,
    action: `ADMIN_${action.toUpperCase()}`,
    resource: 'admin',
    ip,
    details
  });
};

/**
 * Log security-related events (e.g. failed logins, permission denials)
 */
const logSecurityEvent = (userId, action, details, ip) => {
  auditLogger.warn(`Security event: ${action} for user ${userId}`, {
    userId,
    action: `SECURITY_${action.toUpperCase()}`,
    resource: 'security',
    ip,
    details
  });
};

/**
 * Log error events
 */
const logError = (userId, error, details, ip) => {
  auditLogger.error(`Error: ${error.message}`, {
    userId: userId || 'SYSTEM',
    action: 'ERROR',
    resource: 'system',
    ip: ip || 'internal',
    details: {
      ...details,
      stack: error.stack
    }
  });
};

module.exports = {
  logAuth,
  logDataAccess,
  logDataModification,
  logAdminAction,
  logSecurityEvent,
  logError
};
