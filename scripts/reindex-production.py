#!/usr/bin/env python3
"""
MANGWALE PRODUCTION REINDEXING - Correct Schema Version
Reindexes items, stores, and categories based on ACTUAL database structure
"""

import os
import sys
import ssl
import mysql.connector
import requests
import json
from decimal import Decimal
from datetime import datetime, date
from typing import Dict, List

# JSON encoder for MySQL types
class MySQLEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)

# SSL WORKAROUND for Python 3.12
def _create_unverified_context(cert_reqs=None, check_hostname=None, purpose=None, certfile=None, keyfile=None, cafile=None, capath=None, cadata=None):
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context

if not hasattr(ssl, 'wrap_socket'):
    ssl.wrap_socket = lambda sock, **kwargs: _create_unverified_context().wrap_socket(sock, server_hostname=kwargs.get('server_hostname'))

# Configuration
MYSQL_CONFIG = {
    'host': os.getenv('MYSQL_HOST', '103.86.176.59'),
    'port': int(os.getenv('MYSQL_PORT', 3306)),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', 'root_password'),
    'database': os.getenv('MYSQL_DATABASE', 'mangwale_db')
}

OPENSEARCH_URL = os.getenv('OPENSEARCH_URL', 'http://172.25.0.3:9200')

# Module IDs
MODULE_FOOD = 4
MODULE_ECOMMERCE = 5

# Index mappings
INDEX_MAPPING = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
            "analyzer": {
                "ngram_analyzer": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "ngram_filter"]
                }
            },
            "filter": {
                "ngram_filter": {
                    "type": "ngram",
                    "min_gram": 2,
                    "max_gram": 3
                }
            }
        }
    },
    "mappings": {
        "properties": {
            "id": {"type": "integer"},
            "name": {"type": "text", "analyzer": "ngram_analyzer", "fields": {"keyword": {"type": "keyword"}}},
            "description": {"type": "text"},
            "image": {"type": "keyword"},
            "price": {"type": "float"},
            "discount": {"type": "float"},
            "avg_rating": {"type": "float"},
            "rating_count": {"type": "integer"},
            "order_count": {"type": "integer"},
            "veg": {"type": "boolean"},
            "status": {"type": "boolean"},
            "is_approved": {"type": "boolean"},
            "store_id": {"type": "integer"},
            "category_id": {"type": "integer"},
            "module_id": {"type": "integer"},
            "category_name": {"type": "text"},
            "store_name": {"type": "text", "analyzer": "ngram_analyzer"},
            "store_status": {"type": "boolean"},
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"}
        }
    }
}

STORE_MAPPING = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
            "analyzer": {
                "ngram_analyzer": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "ngram_filter"]
                }
            },
            "filter": {
                "ngram_filter": {
                    "type": "ngram",
                    "min_gram": 2,
                    "max_gram": 3
                }
            }
        }
    },
    "mappings": {
        "properties": {
            "id": {"type": "integer"},
            "name": {"type": "text", "analyzer": "ngram_analyzer", "fields": {"keyword": {"type": "keyword"}}},
            "phone": {"type": "keyword"},
            "email": {"type": "keyword"},
            "logo": {"type": "keyword"},
            "address": {"type": "text"},
            "latitude": {"type": "keyword"},
            "longitude": {"type": "keyword"},
            "rating": {"type": "text"},
            "status": {"type": "boolean"},
            "active": {"type": "boolean"},
            "zone_id": {"type": "integer"},
            "module_id": {"type": "integer"},
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"}
        }
    }
}

CATEGORY_MAPPING = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0
    },
    "mappings": {
        "properties": {
            "id": {"type": "integer"},
            "name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
            "image": {"type": "keyword"},
            "parent_id": {"type": "integer"},
            "position": {"type": "integer"},
            "status": {"type": "boolean"},
            "module_id": {"type": "integer"},
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"}
        }
    }
}


def create_index(index_name: str, mapping: dict):
    """Create OpenSearch index with mapping"""
    try:
        # Delete if exists
        requests.delete(f"{OPENSEARCH_URL}/{index_name}", timeout=10)
        print(f"   🗑️  Deleted old {index_name}")
    except:
        pass
    
    response = requests.put(
        f"{OPENSEARCH_URL}/{index_name}",
        headers={"Content-Type": "application/json"},
        data=json.dumps(mapping),
        timeout=30
    )
    
    if response.status_code in [200, 201]:
        print(f"   ✅ Created {index_name}")
        return True
    else:
        print(f"   ❌ Failed to create {index_name}: {response.text}")
        return False


def bulk_index(index_name: str, documents: List[Dict], id_field: str = 'id'):
    """Bulk index documents to OpenSearch"""
    if not documents:
        return 0
    
    # Boolean fields that come as integers from MySQL
    bool_fields = {'veg', 'status', 'active', 'store_status', 'store_active', 'category_status', 'is_approved'}
    
    bulk_data = []
    for doc in documents:
        doc_id = doc.get(id_field)
        
        # Convert integer booleans to actual booleans
        clean_doc = {}
        for key, value in doc.items():
            if key in bool_fields and isinstance(value, int):
                clean_doc[key] = bool(value)
            else:
                clean_doc[key] = value
        
        bulk_data.append(json.dumps({"index": {"_index": index_name, "_id": str(doc_id)}}))
        bulk_data.append(json.dumps(clean_doc, cls=MySQLEncoder))
    
    bulk_body = "\n".join(bulk_data) + "\n"
    
    response = requests.post(
        f"{OPENSEARCH_URL}/_bulk",
        headers={"Content-Type": "application/x-ndjson"},
        data=bulk_body,
        timeout=60
    )
    
    if response.status_code == 200:
        result = response.json()
        items = result.get('items', [])
        errors = sum(1 for item in items if item.get('index', {}).get('error'))
        success_count = len(items) - errors
        if errors > 0:
            # Print first few errors for debugging
            print(f"   ⚠️  {errors} documents failed to index")
            for idx, item in enumerate(items[:3]):
                if item.get('index', {}).get('error'):
                    print(f"      Error sample {idx+1}: {item['index']['error']}")
        return success_count
    else:
        print(f"   ❌ Bulk index failed: {response.text}")
        return 0


def reindex_items(cursor, module_id: int, index_name: str, module_name: str):
    """Reindex items for a specific module"""
    print(f"\n{'='*80}")
    print(f"🔄 REINDEXING {module_name.upper()} ITEMS ({index_name})")
    print(f"{'='*80}")
    
    # Create index
    create_index(index_name, INDEX_MAPPING)
    
    # Fetch items
    query = """
    SELECT 
        i.id,
        i.name,
        i.description,
        i.image,
        i.price,
        i.discount,
        i.discount_type,
        i.avg_rating,
        i.rating_count,
        i.order_count,
        i.veg,
        i.status,
        i.is_approved,
        i.store_id,
        i.category_id,
        i.module_id,
        i.created_at,
        i.updated_at,
        c.name as category_name,
        s.name as store_name,
        s.status as store_status
    FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN stores s ON i.store_id = s.id
    WHERE i.module_id = %s
    ORDER BY i.id
    """
    
    cursor.execute(query, (module_id,))
    items = cursor.fetchall()
    
    print(f"📊 Fetched {len(items):,} items from database")
    
    if items:
        indexed = bulk_index(index_name, items)
        print(f"✅ Indexed {indexed:,} documents")
        return True
    else:
        print("⚠️  No items found")
        return False


def reindex_stores(cursor, module_id: int, index_name: str, module_name: str):
    """Reindex stores for a specific module"""
    print(f"\n{'='*80}")
    print(f"🔄 REINDEXING {module_name.upper()} STORES ({index_name})")
    print(f"{'='*80}")
    
    # Create index
    create_index(index_name, STORE_MAPPING)
    
    # Fetch stores
    query = """
    SELECT 
        id,
        name,
        phone,
        email,
        logo,
        address,
        latitude,
        longitude,
        rating,
        status,
        active,
        zone_id,
        module_id,
        created_at,
        updated_at
    FROM stores
    WHERE module_id = %s
    ORDER BY id
    """
    
    cursor.execute(query, (module_id,))
    stores = cursor.fetchall()
    
    print(f"📊 Fetched {len(stores):,} stores from database")
    
    if stores:
        indexed = bulk_index(index_name, stores)
        print(f"✅ Indexed {indexed:,} documents")
        return True
    else:
        print("⚠️  No stores found")
        return False


def reindex_categories(cursor, module_id: int, index_name: str, module_name: str):
    """Reindex categories for a specific module"""
    print(f"\n{'='*80}")
    print(f"🔄 REINDEXING {module_name.upper()} CATEGORIES ({index_name})")
    print(f"{'='*80}")
    
    # Create index
    create_index(index_name, CATEGORY_MAPPING)
    
    # Fetch categories
    query = """
    SELECT 
        id,
        name,
        image,
        parent_id,
        position,
        status,
        module_id,
        created_at,
        updated_at
    FROM categories
    WHERE module_id = %s
    ORDER BY id
    """
    
    cursor.execute(query, (module_id,))
    categories = cursor.fetchall()
    
    print(f"📊 Fetched {len(categories):,} categories from database")
    
    if categories:
        indexed = bulk_index(index_name, categories)
        print(f"✅ Indexed {indexed:,} documents")
        return True
    else:
        print("⚠️  No categories found")
        return False


def main():
    """Main reindexing process"""
    print("█" * 80)
    print("█  MANGWALE PRODUCTION REINDEXING - CORRECT SCHEMA")
    print("█" * 80)
    
    # Connect to MySQL
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor(dictionary=True)
        print(f"✅ Connected to MySQL: {MYSQL_CONFIG['host']}/{MYSQL_CONFIG['database']}")
    except Exception as e:
        print(f"❌ MySQL connection failed: {e}")
        return False
    
    # Check OpenSearch
    try:
        response = requests.get(f"{OPENSEARCH_URL}/_cluster/health", timeout=10)
        health = response.json()
        print(f"✅ OpenSearch OK (status: {health['status']}, nodes: {health['number_of_nodes']})")
    except Exception as e:
        print(f"❌ OpenSearch connection failed: {e}")
        return False
    
    success = True
    
    # Reindex Food
    success = reindex_items(cursor, MODULE_FOOD, 'food_items_v4', 'FOOD') and success
    success = reindex_stores(cursor, MODULE_FOOD, 'food_stores_v6', 'FOOD') and success
    success = reindex_categories(cursor, MODULE_FOOD, 'food_categories', 'FOOD') and success
    
    # Reindex Ecommerce
    success = reindex_items(cursor, MODULE_ECOMMERCE, 'ecom_items_v3', 'ECOMMERCE') and success
    success = reindex_stores(cursor, MODULE_ECOMMERCE, 'ecom_stores', 'ECOMMERCE') and success
    success = reindex_categories(cursor, MODULE_ECOMMERCE, 'ecom_categories', 'ECOMMERCE') and success
    
    cursor.close()
    conn.close()
    
    # Final summary
    print("\n" + "█" * 80)
    print("█  REINDEXING COMPLETE")
    print("█" * 80)
    
    # Get final counts
    for index in ['food_items_v4', 'food_stores_v6', 'food_categories', 'ecom_items_v3', 'ecom_stores', 'ecom_categories']:
        try:
            response = requests.get(f"{OPENSEARCH_URL}/{index}/_count", timeout=10)
            count = response.json().get('count', 0)
            print(f"   {index}: {count:,} documents")
        except:
            print(f"   {index}: ❌ Failed to get count")
    
    return success


if __name__ == '__main__':
    sys.exit(0 if main() else 1)
