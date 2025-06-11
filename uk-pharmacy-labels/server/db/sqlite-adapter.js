/**
 * SQLite Database Adapter
 * For testing purposes only - not suitable for production
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Create SQLite database directory if it doesn't exist
const dbDir = path.join(__dirname, 'sqlite');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Database path
const dbPath = path.join(dbDir, 'pharmacy_system.db');

// Create a new database connection
const db = new sqlite3.Database(dbPath);

// Helper function to run queries as promises
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('Error running query:', err);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

// Helper function to get all rows
const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error executing query:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Helper function to get a single row
const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('Error executing query:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Initialize database schema
const initializeDatabase = async () => {
  console.log('Initializing SQLite database...');
  
  // Enable foreign keys
  await run('PRAGMA foreign_keys = ON');
  
  // Create users table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      access_levels TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      is_default INTEGER DEFAULT 0,
      last_login TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create login_attempts table
  await run(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      ip_address TEXT,
      success INTEGER,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create system_settings table
  await run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT,
      description TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      FOREIGN KEY(updated_by) REFERENCES users(id)
    )
  `);
  
  // Create audit_logs table
  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
  
  // Insert initial system settings if they don't exist
  const settings = await all('SELECT setting_key FROM system_settings');
  if (settings.length === 0) {
    const initialSettings = [
      ['session_timeout', '30', 'Session timeout in minutes'],
      ['password_expiry', '90', 'Password expiry in days'],
      ['system_name', 'NHS Pharmacy Label Generator', 'System name display text'],
      ['min_password_length', '8', 'Minimum password length'],
      ['password_requires_uppercase', 'true', 'Password must contain uppercase letters'],
      ['password_requires_number', 'true', 'Password must contain numbers'],
      ['password_requires_special', 'true', 'Password must contain special characters'],
      ['failed_login_lockout', '5', 'Account lockout after this many failed attempts']
    ];
    
    for (const [key, value, description] of initialSettings) {
      await run(
        'INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
        [key, value, description]
      );
    }
  }
  
  // Create default admin user if it doesn't exist
  const adminUser = await get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!adminUser) {
    // Hash the default password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash('admin', saltRounds);
    
    await run(
      `INSERT INTO users 
       (username, email, password_hash, access_levels, is_active, is_default) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'admin',
        'admin@hospital.nhs.uk',
        passwordHash,
        JSON.stringify(['ordering', 'pharmacy', 'admin']),
        1,
        1
      ]
    );
    
    console.log('Created default admin user');
    console.log('Username: admin');
    console.log('Password: admin');
    console.log('IMPORTANT: Change this password immediately after first login!');
  } else {
    console.log('Admin user already exists');
  }
  
  console.log('SQLite database initialized successfully');
};

// Adapter methods to match PostgreSQL client interface
const adapter = {
  query: async (text, params = []) => {
    // Convert PostgreSQL query format to SQLite format
    const sqliteText = text
      .replace(/\$(\d+)/g, '?')
      .replace(/RETURNING \*/g, '')
      .replace(/NOW\(\)/g, 'CURRENT_TIMESTAMP');
      
    console.log('[SQLITE] Running query:', sqliteText);
    console.log('[SQLITE] With params:', params);
      
    // Handle different query types
    if (text.trim().toUpperCase().startsWith('SELECT')) {
      const results = await all(sqliteText, params);
      
      // Process results to parse any JSON strings (especially access_levels)
      const processedRows = results.map(row => {
        const processedRow = {...row};
        // Parse access_levels JSON string to array
        if (processedRow.access_levels && typeof processedRow.access_levels === 'string') {
          try {
            processedRow.access_levels = JSON.parse(processedRow.access_levels);
          } catch (err) {
            console.error('[SQLITE] Error parsing JSON from access_levels', err);
          }
        }
        return processedRow;
      });
      
      console.log('[SQLITE] Query returning rows:', processedRows.length);
      return { rows: processedRows };
    } else if (text.trim().toUpperCase().startsWith('INSERT')) {
      const result = await run(sqliteText, params);
      
      // If this was an INSERT with RETURNING, get the inserted row
      if (text.includes('RETURNING')) {
        const table = text.match(/INTO\s+(\w+)/i)[1];
        const insertedRow = await get(`SELECT * FROM ${table} WHERE rowid = ?`, [result.id]);
        return { rows: [insertedRow] };
      }
      
      return { rows: [] };
    } else {
      await run(sqliteText, params);
      return { rows: [] };
    }
  },
  
  end: () => {
    return new Promise((resolve) => {
      db.close(() => {
        resolve();
      });
    });
  }
};

module.exports = {
  adapter,
  initializeDatabase
};
