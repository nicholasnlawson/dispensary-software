CREATE TABLE IF NOT EXISTS dispensaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    hospital_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL
);

CREATE TRIGGER IF NOT EXISTS update_dispensaries_updated_at
AFTER UPDATE ON dispensaries
FOR EACH ROW
BEGIN
    UPDATE dispensaries SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
