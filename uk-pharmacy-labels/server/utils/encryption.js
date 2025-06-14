/**
 * Encryption utilities for sensitive data
 * This module handles encryption and decryption of sensitive patient and order data
 */

const crypto = require('crypto');
// Use simple console logging to avoid dependencies
const logger = {
  warn: console.warn,
  error: console.error,
  info: console.info
};

// Environment variables should be used for production keys
// For development, we use these defaults if env vars aren't set
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'pharmacy-secret-key-32-chars-dev00';
const ENCRYPTION_IV = process.env.ENCRYPTION_IV || 'pharmacy-iv-16chrs';
const ALGORITHM = 'aes-256-cbc';

// Ensure key and IV are the correct length
if (ENCRYPTION_KEY.length !== 32) {
  logger.warn('Encryption key should be 32 characters. Using insecure default for development.');
}

if (ENCRYPTION_IV.length !== 16) {
  logger.warn('Encryption IV should be 16 characters. Using insecure default for development.');
}

/**
 * Encrypt sensitive data
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted text as base64 string
 */
function encrypt(text) {
  if (!text) return null;
  
  try {
    const iv = Buffer.from(ENCRYPTION_IV, 'utf8');
    const key = Buffer.from(ENCRYPTION_KEY, 'utf8');
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return encrypted;
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text (base64)
 * @returns {string} - Decrypted text
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    const iv = Buffer.from(ENCRYPTION_IV, 'utf8');
    const key = Buffer.from(ENCRYPTION_KEY, 'utf8');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Process an object to encrypt specified fields
 * @param {Object} data - Data object
 * @param {Array<string>} fields - Array of field names to encrypt
 * @returns {Object} - Object with encrypted fields
 */
function encryptFields(data, fields) {
  if (!data || typeof data !== 'object') return data;
  
  const result = { ...data };
  
  fields.forEach(field => {
    if (result[field]) {
      result[field] = encrypt(result[field].toString());
    }
  });
  
  return result;
}

/**
 * Process an object to decrypt specified fields
 * @param {Object} data - Data object with encrypted fields
 * @param {Array<string>} fields - Array of field names to decrypt
 * @returns {Object} - Object with decrypted fields
 */
function decryptFields(data, fields) {
  if (!data || typeof data !== 'object') return data;
  
  const result = { ...data };
  
  fields.forEach(field => {
    if (result[field]) {
      try {
        result[field] = decrypt(result[field]);
      } catch (error) {
        // If decryption fails, leave as is (might not be encrypted)
        logger.warn(`Failed to decrypt field ${field}, might not be encrypted`);
      }
    }
  });
  
  return result;
}

/**
 * Check if the encryption module is properly configured
 * @returns {boolean} - True if encryption is properly configured
 */
function isEncryptionConfigured() {
  return ENCRYPTION_KEY && ENCRYPTION_KEY.length === 32 && 
         ENCRYPTION_IV && ENCRYPTION_IV.length === 16;
}

module.exports = {
  encrypt,
  decrypt,
  encryptFields,
  decryptFields,
  isEncryptionConfigured
};
