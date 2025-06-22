-- Add new admin role types: user-admin and super-admin
-- user-admin: access to user management only
-- super-admin: access to both user management and location management

-- Add the new roles
INSERT OR IGNORE INTO roles (name) VALUES ('user-admin');
INSERT OR IGNORE INTO roles (name) VALUES ('super-admin');

-- Migrate existing admins to super-admin role
INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT ur.user_id, r_super.id as role_id
FROM user_roles ur
JOIN roles r_admin ON ur.role_id = r_admin.id AND r_admin.name = 'admin'
JOIN roles r_super ON r_super.name = 'super-admin'
WHERE NOT EXISTS (
    SELECT 1 FROM user_roles ur2 
    WHERE ur2.user_id = ur.user_id AND ur2.role_id = r_super.id
);
