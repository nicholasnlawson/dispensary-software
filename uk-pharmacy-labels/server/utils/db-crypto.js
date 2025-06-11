/**
 * Database Encryption Utility
 * 
 * This module provides encryption/decryption for database values
 * to enhance security for sensitive data, while working with
 * the standard sqlite3 library.
 */
const crypto = require('crypto');
require('dotenv').config();

// If no DATABASE_ENCRYPTION_KEY in .env, generate a warning
if (!process.env.DATABASE_ENCRYPTION_KEY) {
  console.warn('WARNING: DATABASE_ENCRYPTION_KEY not set in environment variables.');
  console.warn('Generate a secure key and add it to your .env file.');
  console.warn('Example: DATABASE_ENCRYPTION_KEY=32_character_random_string');
}

// Default key if not provided (NOT RECOMMENDED for production)
// The key needs to be exactly 32 bytes (256 bits) for AES-256-CBC
const rawKey = process.env.DATABASE_ENCRYPTION_KEY || 
  'default_key_please_change_in_production';

// Ensure the key is exactly 32 bytes by using a crypto hash if needed
const ENCRYPTION_KEY = (() => {
  if (rawKey.length === 32) {
    return rawKey; // Key is already correct length
  } else {
    // Use crypto to derive a 32-byte key using SHA-256
    return crypto.createHash('sha256').update(String(rawKey)).digest();
  }
})();

// Initialization Vector length
const IV_LENGTH = 16;

/**
 * Encrypt a string or object value
 * @param {string|object} text - The value to encrypt
 * @returns {string} - Encrypted value as hex string with IV
 */
function encrypt(text) {
  if (!text) return null;
  
  // Convert objects to strings
  const textToEncrypt = typeof text === 'object' ? JSON.stringify(text) : String(text);
  
  // Generate a random initialization vector
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher using AES-256-CBC
  const cipher = crypto.createCipheriv(
    'aes-256-cbc', 
    Buffer.from(ENCRYPTION_KEY), 
    iv
  );
  
  // Encrypt the data
  let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV and encrypted data as a single string
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt an encrypted string value
 * @param {string} encryptedText - The encrypted value with IV
 * @returns {string|object} - Decrypted value, parsed as object if possible
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    // Split the IV and encrypted data
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedData = textParts.join(':');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc', 
      Buffer.from(ENCRYPTION_KEY), 
      iv
    );
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Try to parse as JSON if it looks like an object
    try {
      if (decrypted.startsWith('{') || decrypted.startsWith('[')) {
        return JSON.parse(decrypted);
      }
    } catch (e) {
      // If parsing fails, return as string
    }
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
}

/**
 * Create an encrypted database row from an object
 * @param {object} data - Object containing data to encrypt
 * @param {array} fieldsToEncrypt - Array of field names to encrypt
 * @returns {object} - Object with specified fields encrypted
 */
function encryptRow(data, fieldsToEncrypt) {
  if (!data || typeof data !== 'object') return data;
  
  const result = { ...data };
  
  for (const field of fieldsToEncrypt) {
    if (result[field] !== undefined) {
      result[field] = encrypt(result[field]);
    }
  }
  
  return result;
}

/**
 * Decrypt fields in a database row
 * @param {object} data - Object containing encrypted data
 * @param {array} fieldsToDecrypt - Array of field names to decrypt
 * @returns {object} - Object with specified fields decrypted
 */
function decryptRow(data, fieldsToDecrypt) {
  if (!data || typeof data !== 'object') return data;
  
  const result = { ...data };
  
  for (const field of fieldsToDecrypt) {
    if (result[field]) {
      result[field] = decrypt(result[field]);
    }
  }
  
  return result;
}

module.exports = {
  encrypt,
  decrypt,
  encryptRow,
  decryptRow
};
