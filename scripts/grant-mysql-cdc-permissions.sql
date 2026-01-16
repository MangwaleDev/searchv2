-- Grant required permissions for Debezium CDC connector
-- Run this on your MySQL server as a user with GRANT privileges (e.g., root)

-- Replace with your actual MySQL user from .env.production
-- Current user: search_43d2_ai_55a6

-- Grant required permissions
GRANT SELECT, RELOAD, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'search_43d2_ai_55a6'@'%';
FLUSH PRIVILEGES;

-- Verify permissions
SHOW GRANTS FOR 'search_43d2_ai_55a6'@'%';

-- Expected output should include:
-- GRANT SELECT, RELOAD, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO `search_43d2_ai_55a6`@`%`
