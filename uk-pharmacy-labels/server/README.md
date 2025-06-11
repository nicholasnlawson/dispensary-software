# NHS Pharmacy System Secure Database Server

This server provides a secure, scalable authentication system for the NHS Pharmacy Label Generator system, replacing the previous localStorage approach with a robust database solution.

## Features

- Secure user authentication with JWT tokens
- Role-based access control (ordering, pharmacy, admin)
- Password hashing with bcrypt
- PostgreSQL database for user management
- Audit logging for security monitoring
- Session management and token verification
- API endpoints for user management and system settings
- CORS protection for intranet deployment

## Requirements

- Node.js 14+ 
- PostgreSQL 12+
- Hospital intranet environment for production deployment

## Installation

1. Install PostgreSQL if not already installed
2. Create a new database:
   ```
   createdb pharmacy_system
   ```
3. Install dependencies:
   ```
   cd server
   npm install
   ```
4. Configure environment variables by editing the `.env` file
5. Initialize the database:
   ```
   node db/init.js
   ```
6. Start the server:
   ```
   npm start
   ```

## Initial Setup

After installation, a default admin user is created:
- Username: `admin`
- Password: `admin`

**IMPORTANT:** Change this password immediately after first login.

## Integration with Frontend

The frontend has been updated to use this secure authentication system:

1. `api-client.js` - Handles API communication
2. `secure-user-manager.js` - Manages authenticated user sessions
3. Updated HTML pages to use JWT authentication

## Deployment Considerations for NHS Environment

### Security

- Always run in production mode (`NODE_ENV=production`)
- Use HTTPS in production with valid certificates
- Store JWT secrets securely (consider using a key vault)
- Deploy database behind firewall with restricted access
- Follow NHS Digital Security Standards

### High Availability

- Consider deploying with PM2 or other process manager
- Implement database backups
- Consider database replication for high availability

### Network Configuration

- Configure CORS settings for NHS intranet domains
- Ensure proper network segmentation
- Review and configure firewall rules

### Integration Options

- Can be integrated with NHS Active Directory via custom middleware
- Supports smartcard authentication (requires additional middleware)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Authenticate user
- `GET /api/auth/verify` - Verify token
- `POST /api/auth/logout` - Logout user

### User Management
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID (admin only)
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)
- `PUT /api/users/:id/reset-password` - Reset user password (admin only)
- `PUT /api/users/change-password` - Change own password

### System
- `GET /api/system/settings` - Get system settings
- `PUT /api/system/settings/:key` - Update system setting
- `GET /api/system/audit-logs` - Get audit logs
- `GET /api/system/database-info` - Get database info
- `GET /api/system/login-stats` - Get login statistics

## Compliance

This implementation follows:
- NHS Digital Security Standards
- GDPR requirements for data protection
- UK healthcare information governance guidelines
