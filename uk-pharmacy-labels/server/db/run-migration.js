/**
 * Database Migration Runner
 * 
 * This script runs SQL migration files to update the database schema.
 * It maintains a record of which migrations have been applied.
 */
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { db } = require('./init');
const logger = require('../utils/logger');

// Create migrations table if it doesn't exist
const createMigrationsTable = () => {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Check if a migration has been applied
const checkMigrationApplied = (migrationName) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM migrations WHERE name = ?', [migrationName], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(!!row);
      }
    });
  });
};

// Record that a migration has been applied
const recordMigration = (migrationName) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO migrations (name) VALUES (?)', [migrationName], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
};

// Run SQL from a file
const runSqlFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, sql) => {
      if (err) {
        reject(err);
        return;
      }

      // Execute the entire SQL file at once instead of splitting
      // This ensures proper execution of complex statements like triggers
      db.exec(sql, (err) => {
        if (err) {
          console.error('Error executing SQL:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

// Run all pending migrations
const runMigrations = async () => {
  try {
    await createMigrationsTable();
    
    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Run in alphabetical order
    
    // Track results
    const results = {
      applied: [],
      skipped: [],
      failed: []
    };
    
    // Run each migration that hasn't been applied yet
    for (const file of files) {
      const migrationName = file;
      const applied = await checkMigrationApplied(migrationName);
      
      if (applied) {
        results.skipped.push(migrationName);
        continue;
      }
      
      try {
        await runSqlFile(path.join(migrationsDir, file));
        await recordMigration(migrationName);
        results.applied.push(migrationName);
        console.log(`✓ Applied migration: ${migrationName}`);
      } catch (error) {
        results.failed.push({ name: migrationName, error: error.message });
        console.error(`✗ Failed to apply migration ${migrationName}:`, error.message);
        logger.logError('system', error, {
          action: 'DATABASE_MIGRATION',
          migration: migrationName
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Migration error:', error.message);
    logger.logError('system', error, { action: 'DATABASE_MIGRATION_SETUP' });
    throw error;
  }
};

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations()
    .then(results => {
      console.log('Migration Summary:');
      console.log(`- ${results.applied.length} migrations applied`);
      console.log(`- ${results.skipped.length} migrations skipped (already applied)`);
      console.log(`- ${results.failed.length} migrations failed`);
      
      if (results.failed.length > 0) {
        console.error('Failed migrations:', results.failed);
        process.exit(1);
      }
      
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration process failed:', err);
      process.exit(1);
    });
}

module.exports = {
  runMigrations
};
