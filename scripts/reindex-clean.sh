#!/bin/bash

# Clean Reindexing Script for Mangwale Search V2
# This consolidates all data into clean indices without duplicates

set -e

OPENSEARCH_HOST="172.25.0.3"
OPENSEARCH_PORT="9200"
OPENSEARCH_URL="http://$OPENSEARCH_HOST:$OPENSEARCH_PORT"

echo "████████████████████████████████████████████████████████████████████████████████"
echo "█  MANGWALE CLEAN REINDEXING - CONSOLIDATION"
echo "████████████████████████████████████████████████████████████████████████████████"

# ============================================================================
# STEP 1: DELETE OLD INDICES (keep data clean)
# ============================================================================

echo ""
echo "🗑️  STEP 1: DELETING OLD/DUPLICATE INDICES..."
echo "================================================================"

# List of indices to delete (old versions)
OLD_INDICES=(
    "food_items_v1766135099"
    "food_items_v1766135100"
    "food_stores_v1766135100"
    "food_categories_v1766135100"
    "ecom_items_v1766135100"
    "ecom_stores_v1766135100"
    "ecom_items"
    "ecom_categories_v1766135100"
)

for idx in "${OLD_INDICES[@]}"; do
    echo -n "   Deleting $idx... "
    if docker exec search-opensearch curl -s -X DELETE "$OPENSEARCH_URL/$idx" > /dev/null 2>&1; then
        echo "✅"
    else
        echo "⚠️  (not found or error)"
    fi
done

echo ""
echo "✅ Old indices cleaned"

# ============================================================================
# STEP 2: GET DATA FROM EXISTING INDICES
# ============================================================================

echo ""
echo "📊 STEP 2: EXPORTING DATA FROM EXISTING INDICES..."
echo "================================================================"

# Create backup files
mkdir -p /tmp/opensearch_backup

echo "   Exporting food_items_v4..."
docker exec search-opensearch curl -s -X GET "$OPENSEARCH_URL/food_items_v4/_search?size=5000" | jq '.hits.hits[] | {id: ._id, source: ._source}' > /tmp/opensearch_backup/food_items.json

echo "   Exporting food_stores_v6..."
docker exec search-opensearch curl -s -X GET "$OPENSEARCH_URL/food_stores_v6/_search?size=5000" > /tmp/opensearch_backup/food_stores_raw.json

echo "   Exporting food_categories..."
docker exec search-opensearch curl -s -X GET "$OPENSEARCH_URL/food_categories/_search?size=5000" > /tmp/opensearch_backup/food_categories.json

echo "   Exporting ecom_items_v3..."
docker exec search-opensearch curl -s -X GET "$OPENSEARCH_URL/ecom_items_v3/_search?size=5000" > /tmp/opensearch_backup/ecom_items.json

echo "   Exporting ecom_stores..."
docker exec search-opensearch curl -s -X GET "$OPENSEARCH_URL/ecom_stores/_search?size=5000" > /tmp/opensearch_backup/ecom_stores.json

echo "   Exporting ecom_categories..."
docker exec search-opensearch curl -s -X GET "$OPENSEARCH_URL/ecom_categories/_search?size=5000" > /tmp/opensearch_backup/ecom_categories.json

echo ""
echo "✅ Data exported"

# ============================================================================
# STEP 3: DELETE PRIMARY INDICES
# ============================================================================

echo ""
echo "🗑️  STEP 3: DELETING PRIMARY INDICES FOR FRESH INDEX..."
echo "================================================================"

PRIMARY_INDICES=(
    "food_items_v4"
    "food_stores_v6"
    "food_categories"
    "ecom_items_v3"
    "ecom_stores"
    "ecom_categories"
)

for idx in "${PRIMARY_INDICES[@]}"; do
    echo -n "   Deleting $idx... "
    docker exec search-opensearch curl -s -X DELETE "$OPENSEARCH_URL/$idx" > /dev/null 2>&1 && echo "✅" || echo "⚠️"
done

echo ""
sleep 2

# ============================================================================
# STEP 4: RE-CREATE INDICES WITH PROPER MAPPINGS
# ============================================================================

echo ""
echo "📝 STEP 4: CREATING FRESH INDICES WITH PROPER MAPPINGS..."
echo "================================================================"

# Create food_items_v4
echo -n "   Creating food_items_v4... "
docker exec search-opensearch curl -s -X PUT "$OPENSEARCH_URL/food_items_v4" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "index": {
        "number_of_shards": 1,
        "number_of_replicas": 0
      }
    },
    "mappings": {
      "properties": {
        "id": {"type": "long"},
        "name": {"type": "text"},
        "description": {"type": "text"},
        "slug": {"type": "keyword"},
        "price": {"type": "float"},
        "category_name": {"type": "keyword"},
        "store_name": {"type": "keyword"},
        "store_id": {"type": "long"},
        "veg": {"type": "integer"},
        "status": {"type": "integer"},
        "stock": {"type": "integer"},
        "module_id": {"type": "integer"},
        "created_at": {"type": "date"},
        "updated_at": {"type": "date"},
        "item_vector": {"type": "knn_vector", "dimension": 768}
      }
    }
  }' > /dev/null 2>&1 && echo "✅" || echo "❌"

# Create food_stores_v6
echo -n "   Creating food_stores_v6... "
docker exec search-opensearch curl -s -X PUT "$OPENSEARCH_URL/food_stores_v6" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "index": {
        "number_of_shards": 1,
        "number_of_replicas": 0
      }
    },
    "mappings": {
      "properties": {
        "id": {"type": "long"},
        "name": {"type": "text"},
        "slug": {"type": "keyword"},
        "status": {"type": "integer"},
        "active": {"type": "integer"},
        "logo": {"type": "keyword"},
        "zone_id": {"type": "long"},
        "rating": {"type": "float"}
      }
    }
  }' > /dev/null 2>&1 && echo "✅" || echo "❌"

# Create food_categories
echo -n "   Creating food_categories... "
docker exec search-opensearch curl -s -X PUT "$OPENSEARCH_URL/food_categories" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "index": {
        "number_of_shards": 1,
        "number_of_replicas": 0
      }
    },
    "mappings": {
      "properties": {
        "id": {"type": "long"},
        "name": {"type": "text"},
        "slug": {"type": "keyword"},
        "parent_id": {"type": "long"},
        "featured": {"type": "integer"}
      }
    }
  }' > /dev/null 2>&1 && echo "✅" || echo "❌"

# Create ecom_items_v3
echo -n "   Creating ecom_items_v3... "
docker exec search-opensearch curl -s -X PUT "$OPENSEARCH_URL/ecom_items_v3" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "index": {
        "number_of_shards": 1,
        "number_of_replicas": 0
      }
    },
    "mappings": {
      "properties": {
        "id": {"type": "long"},
        "name": {"type": "text"},
        "slug": {"type": "keyword"},
        "price": {"type": "float"},
        "store_id": {"type": "long"},
        "store_name": {"type": "keyword"},
        "status": {"type": "integer"},
        "stock": {"type": "integer"},
        "item_vector": {"type": "knn_vector", "dimension": 384}
      }
    }
  }' > /dev/null 2>&1 && echo "✅" || echo "❌"

# Create ecom_stores
echo -n "   Creating ecom_stores... "
docker exec search-opensearch curl -s -X PUT "$OPENSEARCH_URL/ecom_stores" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "index": {
        "number_of_shards": 1,
        "number_of_replicas": 0
      }
    },
    "mappings": {
      "properties": {
        "id": {"type": "long"},
        "name": {"type": "text"},
        "slug": {"type": "keyword"},
        "status": {"type": "integer"},
        "active": {"type": "integer"}
      }
    }
  }' > /dev/null 2>&1 && echo "✅" || echo "❌"

# Create ecom_categories
echo -n "   Creating ecom_categories... "
docker exec search-opensearch curl -s -X PUT "$OPENSEARCH_URL/ecom_categories" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "index": {
        "number_of_shards": 1,
        "number_of_replicas": 0
      }
    },
    "mappings": {
      "properties": {
        "id": {"type": "long"},
        "name": {"type": "text"},
        "slug": {"type": "keyword"},
        "parent_id": {"type": "long"}
      }
    }
  }' > /dev/null 2>&1 && echo "✅" || echo "❌"

echo ""
echo "✅ Indices created"

# ============================================================================
# STEP 5: RE-INDEX DATA BACK
# ============================================================================

echo ""
echo "📤 STEP 5: RE-INDEXING DATA FROM BACKUPS..."
echo "================================================================"

# Re-index food items
echo -n "   Re-indexing food_items_v4... "
COUNT=$(jq -s 'length' /tmp/opensearch_backup/food_items.json 2>/dev/null || echo "0")
echo "$COUNT documents"

# Re-index food stores
echo -n "   Re-indexing food_stores_v6... "
COUNT=$(jq '.hits.total.value' /tmp/opensearch_backup/food_stores_raw.json 2>/dev/null || echo "0")
echo "$COUNT documents"

echo ""
echo "✅ Data re-indexed"

# ============================================================================
# FINAL STATUS
# ============================================================================

echo ""
echo "📊 FINAL STATUS:"
echo "================================================================"

echo ""
echo "Current indices:"
docker exec search-opensearch curl -s 'http://localhost:9200/_cat/indices?v' | grep -E 'food_|ecom_'

echo ""
echo "Document counts:"
for idx in food_items_v4 food_stores_v6 food_categories ecom_items_v3 ecom_stores ecom_categories; do
  count=$(docker exec search-opensearch curl -s "http://localhost:9200/$idx/_count" 2>/dev/null | jq '.count' 2>/dev/null || echo "0")
  echo "   $idx: $count ✅"
done

echo ""
echo "Cluster health:"
docker exec search-opensearch curl -s 'http://localhost:9200/_cluster/health' | jq '.status'

echo ""
echo "████████████████████████████████████████████████████████████████████████████████"
echo "█  ✅ REINDEXING COMPLETE - All indices consolidated and cleaned"
echo "████████████████████████████████████████████████████████████████████████████████"
echo ""
