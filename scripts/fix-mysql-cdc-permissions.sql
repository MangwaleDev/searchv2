-- Fix MySQL permissions for CDC - Grant from any host (%)
-- The Kafka Connect container connects from Docker network, not the server IP
-- Run this on your MySQL server

-- Grant permissions for connections from any host (%)
GRANT SELECT, RELOAD, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'search_43d2_ai_55a6'@'%';
FLUSH PRIVILEGES;

-- Also grant for specific IP (if needed)
GRANT SELECT, RELOAD, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'search_43d2_ai_55a6'@'103.160.107.41';
FLUSH PRIVILEGES;

-- Verify permissions
SHOW GRANTS FOR 'search_43d2_ai_55a6'@'%';
SHOW GRANTS FOR 'search_43d2_ai_55a6'@'103.160.107.41';

-- Expected output should show REPLICATION SLAVE and REPLICATION CLIENT for both
