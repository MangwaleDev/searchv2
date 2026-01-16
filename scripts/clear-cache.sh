#!/bin/bash
# Clear all search API caches (Redis L2 and local L1)

set -e

echo "🧹 Clearing all search API caches..."

# Clear Redis cache
if docker ps | grep -q search-redis; then
    echo "Clearing Redis cache (L2)..."
    docker exec search-redis redis-cli FLUSHALL
    docker exec search-redis redis-cli FLUSHDB
    echo "✅ Redis cache cleared"
else
    echo "⚠️  search-redis container not running"
fi

# Note: Local in-memory cache (L1) will expire automatically (100ms TTL)
# or will be cleared when the API container restarts

echo ""
echo "✅ All caches cleared!"
echo ""
echo "Note: Local in-memory cache (L1) has 100ms TTL and will expire automatically."
echo "      To clear L1 cache, restart the search-api container:"
echo "      docker-compose -f docker-compose.production.yml restart search-api"
