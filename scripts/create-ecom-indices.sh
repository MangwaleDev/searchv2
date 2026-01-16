#!/bin/bash
# Create all e-commerce indices for OpenSearch
# This script creates: ecom_items, ecom_stores, ecom_categories

set -e

OPENSEARCH_URL=${OPENSEARCH_URL:-http://localhost:9210}

echo "🔧 Creating E-commerce Indices..."

# Create ecom_items
echo -n "Creating ecom_items... "
RESPONSE=$(curl -s -X PUT "${OPENSEARCH_URL}/ecom_items" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0
    },
    "mappings": {
      "properties": {
        "id": {"type": "long"},
        "name": {
          "type": "text",
          "fields": {
            "keyword": {"type": "keyword", "ignore_above": 256}
          }
        },
        "slug": {"type": "keyword"},
        "description": {"type": "text"},
        "image": {"type": "keyword"},
        "images": {"type": "keyword"},
        "price": {"type": "double"},
        "category_id": {"type": "long"},
        "category_name": {"type": "text"},
        "store_id": {"type": "long"},
        "store_name": {"type": "keyword"},
        "store_location": {"type": "geo_point"},
        "status": {"type": "integer"},
        "stock": {"type": "integer"},
        "module_id": {"type": "long"},
        "order_count": {"type": "integer"},
        "avg_rating": {"type": "double"},
        "rating_count": {"type": "integer"},
        "created_at": {"type": "date", "format": "strict_date_optional_time||epoch_millis"},
        "updated_at": {"type": "date", "format": "strict_date_optional_time||epoch_millis"}
      }
    }
  }')

if echo "$RESPONSE" | jq -e '.acknowledged == true' > /dev/null 2>&1; then
    echo "✅"
else
    if echo "$RESPONSE" | jq -e '.error.type == "resource_already_exists_exception"' > /dev/null 2>&1; then
        echo "⚠️  Already exists"
    else
        echo "❌ Failed"
        echo "$RESPONSE" | jq '.'
        exit 1
    fi
fi

# Create ecom_stores
echo -n "Creating ecom_stores... "
RESPONSE=$(curl -s -X PUT "${OPENSEARCH_URL}/ecom_stores" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0
    },
    "mappings": {
      "properties": {
        "id": {"type": "long"},
        "name": {
          "type": "text",
          "fields": {
            "keyword": {"type": "keyword", "ignore_above": 256}
          }
        },
        "slug": {"type": "keyword"},
        "phone": {"type": "keyword"},
        "email": {"type": "keyword"},
        "logo": {"type": "keyword"},
        "cover_photo": {"type": "keyword"},
        "address": {"type": "text"},
        "latitude": {"type": "keyword"},
        "longitude": {"type": "keyword"},
        "location": {"type": "geo_point"},
        "status": {"type": "integer"},
        "active": {"type": "integer"},
        "veg": {"type": "integer"},
        "non_veg": {"type": "integer"},
        "delivery": {"type": "integer"},
        "take_away": {"type": "integer"},
        "delivery_time": {"type": "keyword"},
        "zone_id": {"type": "long"},
        "module_id": {"type": "long"},
        "order_count": {"type": "integer"},
        "total_order": {"type": "integer"},
        "rating": {"type": "keyword"},
        "minimum_order": {"type": "double"},
        "created_at": {"type": "date", "format": "strict_date_optional_time||epoch_millis"},
        "updated_at": {"type": "date", "format": "strict_date_optional_time||epoch_millis"}
      }
    }
  }')

if echo "$RESPONSE" | jq -e '.acknowledged == true' > /dev/null 2>&1; then
    echo "✅"
else
    if echo "$RESPONSE" | jq -e '.error.type == "resource_already_exists_exception"' > /dev/null 2>&1; then
        echo "⚠️  Already exists"
    else
        echo "❌ Failed"
        echo "$RESPONSE" | jq '.'
        exit 1
    fi
fi

# Create ecom_categories
echo -n "Creating ecom_categories... "
RESPONSE=$(curl -s -X PUT "${OPENSEARCH_URL}/ecom_categories" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0
    },
    "mappings": {
      "properties": {
        "id": {"type": "long"},
        "name": {
          "type": "text",
          "fields": {
            "keyword": {"type": "keyword", "ignore_above": 256}
          }
        },
        "slug": {"type": "keyword"},
        "image": {"type": "keyword"},
        "parent_id": {"type": "integer"},
        "status": {"type": "boolean"},
        "featured": {"type": "integer"},
        "module_id": {"type": "long"},
        "created_at": {"type": "date", "format": "strict_date_optional_time||epoch_millis"},
        "updated_at": {"type": "date", "format": "strict_date_optional_time||epoch_millis"}
      }
    }
  }')

if echo "$RESPONSE" | jq -e '.acknowledged == true' > /dev/null 2>&1; then
    echo "✅"
else
    if echo "$RESPONSE" | jq -e '.error.type == "resource_already_exists_exception"' > /dev/null 2>&1; then
        echo "⚠️  Already exists"
    else
        echo "❌ Failed"
        echo "$RESPONSE" | jq '.'
        exit 1
    fi
fi

echo ""
echo "✅ All e-commerce indices created successfully!"
echo ""
echo "Indices:"
curl -s "${OPENSEARCH_URL}/_cat/indices?v" | grep ecom
