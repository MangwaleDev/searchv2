#!/bin/bash
# Clean up old indices and create proper aliases for the search system

set -e

echo "================================="
echo "OpenSearch Index Cleanup & Aliasing"
echo "================================="
echo ""

OPENSEARCH_URL="http://search-opensearch:9200"

# Function to create or update alias
create_alias() {
    local index=$1
    local alias=$2
    
    echo "📌 Setting alias: $alias -> $index"
    
    # Remove alias from all indices first
    curl -s -X POST "$OPENSEARCH_URL/_aliases" -H 'Content-Type: application/json' -d"
    {
      \"actions\": [
        { \"remove\": { \"index\": \"*\", \"alias\": \"$alias\" } }
      ]
    }" > /dev/null
    
    # Add alias to new index
    curl -s -X POST "$OPENSEARCH_URL/_aliases" -H 'Content-Type: application/json' -d"
    {
      \"actions\": [
        { \"add\": { \"index\": \"$index\", \"alias\": \"$alias\" } }
      ]
    }" > /dev/null
    
    echo "✅ Alias $alias now points to $index"
}

# Delete old food indices (keep only v4)
echo ""
echo "🗑️  Cleaning up old food item indices..."
curl -s -X DELETE "$OPENSEARCH_URL/food_items_v1766135099" || echo "Index not found or already deleted"
curl -s -X DELETE "$OPENSEARCH_URL/food_items_v3" || echo "Index not found or already deleted"
echo "✅ Old indices deleted"

# Create aliases for food module
echo ""
echo "🔗 Creating food module aliases..."
create_alias "food_items_v4" "food_items"
create_alias "food_stores_v1767189609" "food_stores"
create_alias "food_categories_v1766135100" "food_categories"

# Delete old store indices
echo ""
echo "🗑️  Cleaning up old food store indices..."
curl -s -X DELETE "$OPENSEARCH_URL/food_stores_v1766135100" || echo "Index not found or already deleted"
echo "✅ Old store indices deleted"

# Show final state
echo ""
echo "📊 Final Index State:"
echo "===================="
docker exec search-opensearch curl -s "$OPENSEARCH_URL/_cat/indices/*food*?v&h=index,docs.count,store.size&s=index"

echo ""
echo "📊 Final Alias State:"
echo "===================="
docker exec search-opensearch curl -s "$OPENSEARCH_URL/_cat/aliases/*food*?v"

echo ""
echo "✅ Cleanup and aliasing complete!"
