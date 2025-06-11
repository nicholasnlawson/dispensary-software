const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { db } = require('../db/init');
require('dotenv').config();

// Register a new user (admin only operation)
router.post('/register', async (req, res) => {
  const { username, email, password, roles } = req.body;
  
  // Validate input
  if (!username || !email || !password || !roles || !Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  
  try {
    // Check if user already exists
    db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      if (row) {
        return res.status(409).json({ success: false, message: 'Username or email already exists' });
      }
      
      // Hash the password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      // Insert new user
      db.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', 
        [username, email, passwordHash], 
        function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Error creating user' });
          }
          
          const userId = this.lastID;
          
          // Get role IDs for the requested roles
          const rolePromises = roles.map(role => {
            return new Promise((resolve, reject) => {
              db.get('SELECT id FROM roles WHERE name = ?', [role], (err, row) => {
                if (err || !row) {
                  reject(new Error(`Role ${role} not found`));
                } else {
                  resolve(row.id);
                }
              });
            });
          });
          
          Promise.all(rolePromises)
            .then(roleIds => {
              // Insert user roles
              const userRoleInserts = roleIds.map(roleId => {
                return new Promise((resolve, reject) => {
                  db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                    [userId, roleId],
                    (err) => {
                      if (err) {
                        reject(err);
                      } else {
                        resolve();
                      }
                    });
                });
              });
              
              Promise.all(userRoleInserts)
                .then(() => {
                  res.status(201).json({
                    success: true,
                    message: 'User registered successfully',
                    userId
                  });
                })
                .catch(err => {
                  res.status(500).json({ success: false, message: 'Error assigning roles' });
                });
            })
            .catch(err => {
              res.status(400).json({ success: false, message: err.message });
            });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login user
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Validate input
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }
  
  // Find user by username or email
  db.get(
    `SELECT u.id, u.username, u.email, u.password_hash
     FROM users u
     WHERE u.username = ? OR u.email = ?`,
    [username, username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid username or password' });
      }
      
      // Compare passwords
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid username or password' });
      }
      
      // Get user roles
      db.all(
        `SELECT r.name
         FROM roles r
         JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
        [user.id],
        (err, roles) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Error retrieving user roles' });
          }
          
          const userRoles = roles.map(role => role.name);
          
          // Create and sign JWT
          const payload = {
            id: user.id,
            username: user.username,
            email: user.email,
            roles: userRoles
          };
          
          jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.TOKEN_EXPIRY || '24h' },
            (err, token) => {
              if (err) {
                return res.status(500).json({ success: false, message: 'Error generating token' });
              }
              
              // Update last login time
              db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
              
              res.json({
                success: true,
                message: 'Login successful',
                token: `Bearer ${token}`,
                user: {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  roles: userRoles
                }
              });
            }
          );
        }
      );
    }
  );
});

// Get current user profile
router.get('/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user data from the database
    db.get(
      `SELECT u.id, u.username, u.email, u.created_at, u.last_login
       FROM users u
       WHERE u.id = ?`,
      [decoded.id],
      (err, user) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Get user roles
        db.all(
          `SELECT r.name
           FROM roles r
           JOIN user_roles ur ON r.id = ur.role_id
           WHERE ur.user_id = ?`,
          [decoded.id],
          (err, roles) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Error retrieving user roles' });
            }
            
            const userRoles = roles.map(role => role.name);
            
            res.json({
              success: true,
              user: {
                ...user,
                roles: userRoles
              }
            });
          }
        );
      }
    );
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

module.exports = router;
