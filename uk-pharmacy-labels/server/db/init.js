/**
 * Database initialization script for NHS Pharmacy System
 * Creates tables and default admin user if they don't exist
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Create database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function initializeDatabase() {
  console.log('Starting database initialization...');
  
  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    console.log('Creating database schema...');
    await pool.query(schema);
    
    // Check if admin user exists
    const adminCheck = await pool.query(
      "SELECT id FROM users WHERE username = 'admin'"
    );
    
    // Create default admin user if none exists
    if (adminCheck.rows.length === 0) {
      console.log('Creating default admin user...');
      
      // Hash default password
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash('admin', saltRounds);
      
      // Insert admin user
      await pool.query(
        `INSERT INTO users 
         (username, email, password_hash, access_levels, is_active, is_default) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'admin',
          'admin@hospital.nhs.uk',
          passwordHash,
          JSON.stringify(['ordering', 'pharmacy', 'admin']),
          true,
          true
        ]
      );
      
      console.log('Default admin user created successfully');
      console.log('Username: admin');
      console.log('Password: admin');
      console.log('IMPORTANT: Change this password immediately after first login!');
    } else {
      console.log('Admin user already exists, skipping creation');
    }
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    // Close pool
    await pool.end();
  }
}

// Run initialization
initializeDatabase();
