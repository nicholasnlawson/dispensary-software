# UK Pharmacy Label Generator and Ordering System

## User Authentication System

The system now includes a comprehensive user authentication and authorization system with role-based access control.

### Features

- **User Login**: Secure login with username/email and password
- **Role-Based Access Control**: Three access levels
  - Ordering: Access to ward ordering system
  - Pharmacy: Access to pharmacy supply management
  - Admin: Full system access and user management
- **Encrypted Local Storage**: User data is stored locally in an encrypted form
- **Admin Interface**: Manage users, reset passwords, and control system settings
- **Session Management**: Automatic redirection to login page for unauthenticated users

### Default Admin User

- Username: `admin`
- Password: `admin`

**Important**: Change the default admin password immediately after first login.

### Security Notes

- Password hashing uses a simple base64 encoding with salt (for demonstration purposes)
- User data is stored encrypted in localStorage to prevent casual inspection
- This implementation is suitable for demonstration but would need stronger cryptography for production use

### Pages with Authentication

- Main Label Generator (`/index.html`)
- Ward Ordering System (`/remote-ordering/ward/index.html`)
- Pharmacy Supply Management (`/remote-ordering/pharmacy/index.html`)
- Admin Dashboard (`/admin/index.html`)

### Navigation

The system dynamically shows navigation links based on user access levels:
- All authenticated users can access the Label Generator
- Users with ordering access can access the Ward Orders page
- Users with pharmacy access can access the Pharmacy Supply page
- Users with admin access can access the Admin Dashboard

### Future Enhancements

- Secure password reset flows
- Integration with backend authentication services
- Session timeout and auto-logout features
- Two-factor authentication
