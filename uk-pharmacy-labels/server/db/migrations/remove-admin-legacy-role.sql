-- Migration to remove the legacy 'admin' role
-- This migration removes the legacy 'admin' role from the database
-- All users with 'admin' role should have already been migrated to 'super-admin'

-- First, check if there are any users still with the 'admin' role
-- If there are, we'll migrate them to 'super-admin' for safety
INSERT INTO user_roles (user_id, role_id)
SELECT ur.user_id, (SELECT id FROM roles WHERE name = 'super-admin')
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'admin'
AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2
    JOIN roles r2 ON ur2.role_id = r2.id
    WHERE ur2.user_id = ur.user_id AND r2.name = 'super-admin'
);

-- Now delete the user_roles entries for 'admin'
DELETE FROM user_roles
WHERE role_id = (SELECT id FROM roles WHERE name = 'admin');

-- Finally, delete the 'admin' role itself
DELETE FROM roles
WHERE name = 'admin';
