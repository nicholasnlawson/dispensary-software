-- User authentication and authorization schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT TRUE
);

-- Roles table (ordering, pharmacy, admin)
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

-- User roles table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER,
    role_id INTEGER,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Insert default roles
INSERT OR IGNORE INTO roles (name) VALUES ('ordering');
INSERT OR IGNORE INTO roles (name) VALUES ('pharmacy');
INSERT OR IGNORE INTO roles (name) VALUES ('admin');

-- Insert default admin user (password will be hashed in initialization code)
-- Default username: admin, password: change_me_immediately
