-- Wards table
CREATE TABLE IF NOT EXISTS hospitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Wards table
CREATE TABLE IF NOT EXISTS wards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    hospital_id INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL
);

-- Insert some default hospitals
INSERT OR IGNORE INTO hospitals (name, address) VALUES 
('Main Hospital', '123 Main Street, City'),
('Community Hospital', '456 Side Road, Town');

-- Insert some default wards
INSERT OR IGNORE INTO wards (name, description, hospital_id) VALUES 
('Ward A1', 'General Medicine', 1),
('Ward B2', 'Surgery', 1),
('Ward C3', 'Pediatrics', 1),
('Ward D1', 'Geriatrics', 2);
