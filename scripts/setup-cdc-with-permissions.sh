#!/bin/bash
# Complete CDC setup including MySQL permissions check
# This script helps you set up CDC by checking permissions and providing SQL commands

set -e

echo "🔧 CDC Setup with MySQL Permissions Check"
echo ""

# Load MySQL credentials
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | grep -E '^MYSQL_' | xargs)
fi

MYSQL_HOST=${MYSQL_HOST:-103.160.107.41}
MYSQL_USER=${MYSQL_USER:-search_43d2_ai_55a6}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-4854af0c-326d-4801-8b44-555c53eaec97}
MYSQL_DATABASE=${MYSQL_DATABASE:-migrated_db}

echo "📋 MySQL Configuration:"
echo "  Host: $MYSQL_HOST"
echo "  User: $MYSQL_USER"
echo "  Database: $MYSQL_DATABASE"
echo ""

echo "⚠️  IMPORTANT: Debezium requires REPLICATION permissions"
echo ""
echo "Before running CDC setup, you need to grant permissions on your MySQL server."
echo ""
echo "Run this SQL command on your MySQL server ($MYSQL_HOST):"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "GRANT SELECT, RELOAD, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO '$MYSQL_USER'@'%';"
echo "FLUSH PRIVILEGES;"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if user wants to proceed
read -p "Have you granted the permissions? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please grant the permissions first, then run this script again."
    echo ""
    echo "You can also use the SQL file:"
    echo "  mysql -h $MYSQL_HOST -u root -p < scripts/grant-mysql-cdc-permissions.sql"
    exit 1
fi

echo ""
echo "✅ Proceeding with CDC setup..."
echo ""

# Run the main setup script
./scripts/setup-cdc.sh
