# Security and GDPR Compliance for Pharmacy System

This document outlines the security and GDPR compliance features implemented in the pharmacy system, as well as guidelines for further development.

## Phase 1 Security Enhancements (Implemented)

### 1. Comprehensive Audit Logging
- All user actions, data access, and system events are logged using winston
- Logs include user ID, IP address, action type, timestamp, and affected resources
- Separate log files for general auditing and error tracking
- Log rotation implemented to manage file sizes

### 2. Security Headers and Content Security Policy
- Helmet.js implements security headers to prevent common web vulnerabilities
- Content Security Policy configured to restrict resource loading
- HTTP Strict Transport Security (HSTS) enabled
- XSS Protection and other security headers configured

### 3. Rate Limiting and DoS Protection
- API rate limiting prevents abuse and brute force attacks
- Stricter limits on authentication endpoints
- Configurable time windows and request limits

### 4. Database Security
- Field-level encryption for sensitive patient data
- AES-256-CBC encryption with unique IVs for each field
- Encryption key stored in environment variables, not in code

## Setting Up Security Features

### Environment Variables
The following environment variables must be properly configured:

```
JWT_SECRET=<strong_random_string_at_least_32_chars>
TOKEN_EXPIRY=24h
PORT=3001
DATABASE_ENCRYPTION_KEY=<strong_random_string_exactly_32_chars>
NODE_ENV=production
```

For production use:
1. Generate truly random strings for JWT_SECRET and DATABASE_ENCRYPTION_KEY
2. Set NODE_ENV to "production"
3. Ensure all .env files are excluded from version control
4. Secure the .env file with appropriate file permissions

### Applying Database Encryption
When storing sensitive patient data, use the db-crypto.js utility:

```javascript
const dbCrypto = require('./utils/db-crypto');

// Define fields that contain sensitive data
const sensitiveFields = ['nhsNumber', 'dateOfBirth', 'address', 'medicalDetails'];

// Encrypt sensitive fields before storing
const patientToSave = dbCrypto.encryptRow(patientData, sensitiveFields);

// Decrypt fields after retrieval
const decryptedPatient = dbCrypto.decryptRow(patientFromDb, sensitiveFields);
```

## NHS Compliance Recommendations

For full NHS Digital compliance, additional measures are recommended:

### Phase 2 (Authentication & Access)
- Implement Two-Factor Authentication (2FA) for staff accounts
- Enhance password policies (complexity, history, expiration)
- Implement fine-grained role-based access controls

### Phase 3 (Patient Rights)
- Add data export functionality for GDPR right to access
- Implement data retention policies and automated purging
- Create consent management features

## Security Best Practices

1. **Regular Auditing**: Review logs weekly to identify potential security issues
2. **Security Updates**: Keep all dependencies updated to patch security vulnerabilities
3. **Penetration Testing**: Conduct regular security testing before deployment in NHS environment
4. **Data Protection Impact Assessment**: Complete a DPIA before processing patient data
5. **Least Privilege**: Ensure users only have access to data they absolutely need

## Emergency Contacts

In case of security incidents or data breaches:
- Immediately notify the Data Protection Officer
- Document the incident details and affected data
- Follow the NHS Digital incident reporting procedure
