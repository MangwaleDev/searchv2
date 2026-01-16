#!/bin/bash
# Index E-commerce data from MySQL to OpenSearch
# This script indexes items, stores, and categories for module_id=5

set -e

echo "🔧 Indexing E-commerce Data from MySQL..."

# Load environment variables
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | grep -E '^MYSQL_' | xargs)
fi

MYSQL_HOST=${MYSQL_HOST:-103.160.107.41}
MYSQL_USER=${MYSQL_USER:-search_43d2_ai_55a6}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-4854af0c-326d-4801-8b44-555c53eaec97}
MYSQL_DATABASE=${MYSQL_DATABASE:-migrated_db}

OPENSEARCH_URL=${OPENSEARCH_URL:-http://localhost:9210}

echo "Configuration:"
echo "  MySQL: ${MYSQL_USER}@${MYSQL_HOST}/${MYSQL_DATABASE}"
echo "  OpenSearch: ${OPENSEARCH_URL}"
echo ""

# Check if reindex script exists
if [ ! -f "scripts/reindex-mysql-to-opensearch.js" ]; then
    echo "❌ reindex-mysql-to-opensearch.js not found"
    exit 1
fi

# Check if Node.js is available in container
if docker exec search-api node --version > /dev/null 2>&1; then
    echo "✅ Using search-api container for indexing..."
    CONTAINER_CMD="docker exec search-api"
else
    echo "✅ Using local Node.js..."
    CONTAINER_CMD=""
fi

# Index e-commerce items (module_id=5)
echo ""
echo "📦 Indexing E-commerce Items (module_id=5)..."
$CONTAINER_CMD node scripts/reindex-mysql-to-opensearch.js --module ecom 2>&1 | tail -20

# Verify indexing
echo ""
echo "📊 Verification:"
ITEMS_COUNT=$(curl -s "${OPENSEARCH_URL}/ecom_items/_count" | jq '.count')
STORES_COUNT=$(curl -s "${OPENSEARCH_URL}/ecom_stores/_count" | jq '.count')
CATEGORIES_COUNT=$(curl -s "${OPENSEARCH_URL}/ecom_categories/_count" | jq '.count')

echo "  E-commerce Items: ${ITEMS_COUNT}"
echo "  E-commerce Stores: ${STORES_COUNT}"
echo "  E-commerce Categories: ${CATEGORIES_COUNT}"

if [ "$ITEMS_COUNT" -gt 0 ]; then
    echo ""
    echo "✅ E-commerce data indexed successfully!"
    echo ""
    echo "Test search:"
    echo "  curl 'https://search.mangwale.ai/v2/search/items?module_id=5&q=test'"
else
    echo ""
    echo "⚠️  No e-commerce items found. This could mean:"
    echo "  1. No items with module_id=5 in MySQL"
    echo "  2. All items have status=0 or is_approved=0"
    echo "  3. MySQL connection issue"
    echo ""
    echo "Check MySQL:"
    echo "  SELECT COUNT(*) FROM ${MYSQL_DATABASE}.items WHERE module_id=5 AND status=1 AND is_approved=1;"
fi
