# Security and GDPR Compliance for Pharmacy System

This document outlines the security and GDPR compliance features implemented in the pharmacy system, as well as guidelines for further development.

## Phase 1 Security Enhancements (Implemented)

### 1. Database Encryption
- Field-level encryption for all sensitive patient data (NHS Number, Name, DOB, Address, etc.)
- AES-256-CBC encryption with unique IV per field
- Secure key derivation and management
- Transparent encryption/decryption via database adapter
- Encryption verified via automated test suite

### 2. Comprehensive Audit Logging
- All user actions, data access, and system events are logged using winston
- Logs include user ID, IP address, action type, timestamp, and affected resources
- GDPR-compliant logging with sensitive data redaction ([REDACTED] markers)
- Separate log files for general auditing and security events
- Log rotation implemented to manage file sizes and retention periods
- Track data access, modification, deletion to support GDPR compliance

### 3. Authentication and Authorization
- Role-based access control (Admin, Pharmacy, Ordering roles)
- Secure password storage using bcrypt with appropriate cost factor
- JWT-based authentication with appropriate expiry
- Session management with secure token storage
- Access controls enforced on both client and server

### 4. Security Headers and Content Security Policy
- Helmet.js implements security headers to prevent common web vulnerabilities
- Content Security Policy configured to restrict resource loading
- HTTP Strict Transport Security (HSTS) enabled
- XSS Protection and other security headers configured
- Clickjacking protection via X-Frame-Options

### 5. Rate Limiting and DoS Protection
- API rate limiting prevents abuse and brute force attacks
- Express rate limit middleware with IP-based tracking
- Graduated response to potential attacks

### 6. Input Validation and Sanitization
- Server-side validation of all user inputs
- Data sanitization to prevent injection attacks
- Parameterized queries for database operations

## Phase 2 Security Enhancements (Planned)

### 1. Enhanced TLS Implementation
- Force HTTPS throughout the application
- TLS 1.3 with strong cipher suite configuration
- Automatic certificate renewal
- HTTP-to-HTTPS redirection

### 2. Two-Factor Authentication (2FA)
- Optional 2FA for admin and pharmacy staff
- Time-based one-time password (TOTP) implementation
- Recovery codes for emergency access

### 3. Advanced Encryption Features
- Database-level encryption at rest
- End-to-end encryption for specific data flows
- Key rotation and management procedures

### 4. API Security Enhancements
- API keys for external system integration
- OAuth 2.0 implementation for partner access
- Improved request validation and throttling

### 5. Automated Security Testing
- Integration with security scanning tools
- Regular vulnerability assessment
- Dependency checking for security issues

## GDPR Compliance Guidelines

### Data Minimization
- Only collect patient data necessary for pharmacy operations
- Define and enforce retention periods for different data types
- Implement automated data purging after retention period expiry

### Data Subject Rights
- Procedure for handling Subject Access Requests (SAR)
- Data export functionality in portable formats
- Right to erasure ('right to be forgotten') implementation
- Data correction mechanisms

### Breach Management
- Automated breach detection capabilities
- Notification procedures for data protection authorities
- Documentation and timeline tracking for incidents
- Contact templates for affected data subjects

### Data Protection Impact Assessment
- Regular DPIAs for system changes
- Documentation templates and procedures
- Risk assessment framework

### NHS Data Security and Protection Toolkit Compliance
- Regular toolkit submissions
- Evidence collection and documentation
- Staff training on data security protocols

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
