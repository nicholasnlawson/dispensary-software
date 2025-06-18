const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Ensure SQLite directory exists
const dbDir = path.join(__dirname, 'sqlite');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Database path - allow override via environment variable
let dbPath;
if (process.env.DATABASE_PATH) {
    dbPath = process.env.DATABASE_PATH;
    console.log(`Using database from environment variable: ${dbPath}`);
} else {
    dbPath = path.join(dbDir, 'pharmacy_system.db');
    console.log(`Using default database path: ${dbPath}`);
}

// Create or open the database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        // Only initialize automatically if not in explicit initialization mode
        if (!process.env.EXPLICIT_DB_INIT) {
            initializeDatabase();
        }
    }
});

// Initialize the database with schema and default data
function initializeDatabase() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    // Load migration SQL files
    const migrationFiles = [
        'migrations/add-name-fields.sql',
        'migrations/add-wards-table.sql',
        'migrations/patients-table.sql',
        'migrations/add-hospital-fields.sql',
        'migrations/rename-telephone-column.sql',
        'migrations/add-orders-table.sql',
        'migrations/add-order-history.sql',
        'migrations/add-patient-indexes.sql',
        'migrations/add-dose-to-medications.sql',
        'migrations/add-dose-to-order-medications.sql',
        'migrations/add-cancellation-fields.sql'
    ];
    
    const migrations = migrationFiles.map(file => {
        try {
            return fs.readFileSync(path.join(__dirname, file), 'utf8');
        } catch (error) {
            console.warn(`Migration file ${file} not found or could not be read:`, error.message);
            return '';
        }
    }).filter(content => content.trim() !== '');
    
    // Run schema in a transaction
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON');
        
        // Execute schema statements
        db.exec(schema, async (err) => {
            if (err) {
                console.error('Error creating schema:', err.message);
            } else {
                console.log('Database schema created successfully');
                
                // Execute migrations
                for (const migration of migrations) {
                    try {
                        await new Promise((resolve, reject) => {
                            db.exec(migration, (err) => {
                                if (err) {
                                    // Check for specific errors we can safely ignore
                                    if (err.message.includes('duplicate column name') || 
                                        err.message.includes('near "user_version"')) {
                                        console.log('Ignoring expected migration issue:', err.message);
                                        resolve(); // Continue despite the error
                                    } else {
                                        console.error('Error applying migration:', err.message);
                                        reject(err);
                                    }
                                } else {
                                    console.log('Migration applied successfully');
                                    resolve();
                                }
                            });
                        });
                    } catch (error) {
                        console.error('Migration failed:', error);
                        // Continue with other migrations even if one fails
                    }
                }
                
                // Create default admin user if not exists
                const saltRounds = 10;
                const defaultPassword = 'change_me_immediately';
                
                try {
                    const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
                    
                    // Check if admin user already exists
                    db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
                        if (err) {
                            console.error('Error checking for admin user:', err.message);
                        } else if (!row) {
                            // Insert admin user if doesn't exist
                            db.run(
                                'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                                ['admin', 'admin@localhost', passwordHash],
                                function(err) {
                                    if (err) {
                                        console.error('Error creating admin user:', err.message);
                                    } else {
                                        const adminId = this.lastID;
                                        
                                        // Get admin role ID
                                        db.get('SELECT id FROM roles WHERE name = ?', ['admin'], (err, row) => {
                                            if (err || !row) {
                                                console.error('Error getting admin role:', err?.message);
                                            } else {
                                                // Assign admin role to user
                                                db.run(
                                                    'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                                                    [adminId, row.id],
                                                    (err) => {
                                                        if (err) {
                                                            console.error('Error assigning admin role:', err.message);
                                                        } else {
                                                            console.log('Default admin user created with all privileges');
                                                        }
                                                    }
                                                );
                                            }
                                        });
                                    }
                                }
                            );
                        } else {
                            console.log('Admin user already exists');
                        }
                    });
                } catch (error) {
                    console.error('Error hashing password:', error.message);
                }
            }
        });
    });
}

/**
 * Explicitly initialize the database
 * @returns {Promise} Resolves when initialization is complete
 */
function initialize() {
    return new Promise((resolve, reject) => {
        // Set flag to prevent automatic initialization
        process.env.EXPLICIT_DB_INIT = 'true';
        
        console.log('Starting explicit database initialization...');
        
        // Run initialization
        db.serialize(() => {
            db.run('PRAGMA foreign_keys = ON');
            
            const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
            
            // Execute schema
            db.exec(schema, async (err) => {
                if (err) {
                    console.error('Error creating schema:', err.message);
                    reject(err);
                    return;
                }
                
                console.log('Database schema created successfully');
                
                try {
                    // Create default roles and admin user
                    await createDefaultAdmin();
                    
                    // Migrate hardcoded hospitals
                    console.log('Migrating hardcoded hospitals to database...');
                    const { migrateHospitals } = require('../utils/migrate-hardcoded-hospitals');
                    await migrateHospitals(db);
                    
                    console.log('Database initialization completed successfully');
                    resolve();
                } catch (error) {
                    console.error('Error during initialization:', error);
                    reject(error);
                }
            });
        });
    });
}

/**
 * Create default admin user with roles
 * @returns {Promise} Resolves when admin creation is complete
 */
function createDefaultAdmin() {
    return new Promise(async (resolve, reject) => {
        const saltRounds = 10;
        const defaultPassword = 'change_me_immediately';
        
        try {
            const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
            
            // Check if admin user already exists
            db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
                if (err) {
                    console.error('Error checking for admin user:', err.message);
                    reject(err);
                    return;
                }
                
                if (!row) {
                    // Insert admin user if doesn't exist
                    db.run(
                        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                        ['admin', 'admin@localhost', passwordHash],
                        function(err) {
                            if (err) {
                                console.error('Error creating admin user:', err.message);
                                reject(err);
                                return;
                            }
                            
                            const adminId = this.lastID;
                            
                            // Get admin role ID
                            db.get('SELECT id FROM roles WHERE name = ?', ['admin'], (err, row) => {
                                if (err || !row) {
                                    console.error('Error getting admin role:', err?.message);
                                    reject(err || new Error('Admin role not found'));
                                    return;
                                }
                                
                                // Assign admin role to user
                                db.run(
                                    'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                                    [adminId, row.id],
                                    (err) => {
                                        if (err) {
                                            console.error('Error assigning admin role:', err.message);
                                            reject(err);
                                            return;
                                        }
                                        
                                        console.log('Default admin user created with all privileges');
                                        resolve();
                                    }
                                );
                            });
                        }
                    );
                } else {
                    console.log('Admin user already exists');
                    resolve();
                }
            });
        } catch (error) {
            console.error('Error hashing password:', error.message);
            reject(error);
        }
    });
}

module.exports = {
    db,
    initialize,
    initializeDatabase
};
