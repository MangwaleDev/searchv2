#!/usr/bin/env python3
"""
Sync products (items) from MySQL to OpenSearch (READ-ONLY from MySQL).
This script indexes food_items and ecom_items.
"""

import mysql.connector
import requests
import json
import os
import sys

# Configuration - Using production MySQL (READ-ONLY) and OpenSearch
OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://localhost:9200")
MYSQL_CONFIG = {
    'host': os.getenv("MYSQL_HOST", "103.86.176.59"),
    'port': int(os.getenv("MYSQL_PORT", 3306)),
    'user': os.getenv("MYSQL_USER", "root"),
    'password': os.getenv("MYSQL_PASSWORD", "root_password"),
    'database': os.getenv("MYSQL_DATABASE", "mangwale_db"),
    'ssl_disabled': True  # Disable SSL to avoid Python 3.12+ compatibility issues
}

def get_actual_index_name(alias_name):
    """Get the actual index name from an alias"""
    try:
        response = requests.get(f"{OPENSEARCH_URL}/_alias/{alias_name}", timeout=10)
        if response.status_code == 200:
            aliases = response.json()
            # Get the first index that has this alias
            for index_name in aliases.keys():
                return index_name
        return None
    except:
        return None

def bulk_index_documents(index_name, documents, batch_size=500):
    """Bulk index documents to OpenSearch"""
    if not documents:
        print(f"⚠️  No documents to index for {index_name}")
        return 0
    
    total = len(documents)
    indexed = 0
    
    for i in range(0, total, batch_size):
        batch = documents[i:i+batch_size]
        bulk_data = []
        for doc in batch:
            bulk_data.append(json.dumps({"index": {"_index": index_name, "_id": str(doc['id'])}}))
            bulk_data.append(json.dumps(doc))
        
        bulk_body = "\n".join(bulk_data) + "\n"
        
        response = requests.post(
            f"{OPENSEARCH_URL}/_bulk",
            data=bulk_body,
            headers={"Content-Type": "application/x-ndjson"},
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("errors"):
                error_count = sum(1 for item in result.get("items", []) if "error" in item.get("index", {}))
                successful = len(batch) - error_count
                indexed += successful
                if error_count > 0:
                    print(f"   ⚠️  Batch {i//batch_size + 1}: {successful}/{len(batch)} indexed ({error_count} errors)")
                else:
                    print(f"   ✅ Batch {i//batch_size + 1}/{(total + batch_size - 1)//batch_size}: {len(batch)} items")
            else:
                indexed += len(batch)
                print(f"   ✅ Batch {i//batch_size + 1}/{(total + batch_size - 1)//batch_size}: {len(batch)} items")
        else:
            print(f"   ❌ Bulk indexing failed for batch {i//batch_size + 1}: {response.status_code}")
    
    return indexed

def sync_items(module_id, index_name):
    """Sync items from MySQL to OpenSearch"""
    print(f"\n📦 Syncing items for module_id={module_id} to {index_name}...")
    
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        query = """
        SELECT 
            i.id, i.name, i.description, i.image, i.images, i.slug,
            i.category_id, i.category_ids, i.price, i.tax, i.discount,
            i.veg, i.status, i.store_id, i.module_id,
            i.order_count, i.avg_rating, i.rating_count, i.rating,
            i.stock, i.available_time_starts, i.available_time_ends,
            i.created_at, i.updated_at,
            s.name as store_name, s.latitude, s.longitude, s.delivery_time,
            c.name as category_name
        FROM items i
        LEFT JOIN stores s ON i.store_id = s.id
        LEFT JOIN categories c ON i.category_id = c.id
        WHERE i.status = 1 AND i.module_id = %s
        """
        
        cursor.execute(query, (module_id,))
        items = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        print(f"📊 Fetched {len(items)} items from MySQL")
        
        if not items:
            return 0
        
        # Transform items for OpenSearch
        documents = []
        for item in items:
            # Helper function to safely convert values
            def safe_str(val):
                if val is None:
                    return None
                if isinstance(val, bytes):
                    return val.decode('utf-8', errors='ignore')
                return str(val)
            
            def safe_float(val):
                if val is None:
                    return 0.0
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return 0.0
            
            def safe_int(val):
                if val is None:
                    return 0
                try:
                    return int(val)
                except (ValueError, TypeError):
                    return 0
            
            doc = {
                "id": item['id'],
                "name": safe_str(item['name']) or "",
                "description": safe_str(item['description']) or "",
                "image": safe_str(item['image']) or "",
                "images": safe_str(item['images']) or "",
                "slug": safe_str(item['slug']) or "",
                "category_id": safe_int(item['category_id']) if item['category_id'] else None,
                "category_ids": safe_str(item['category_ids']) or "",
                "price": safe_float(item['price']),
                "tax": safe_float(item.get('tax')),
                "discount": safe_float(item.get('discount')),
                "veg": safe_int(item['veg']) if item['veg'] is not None else 0,
                "status": safe_int(item['status']),
                "store_id": safe_int(item['store_id']) if item['store_id'] else None,
                "store_name": safe_str(item['store_name']) or "",
                "module_id": safe_int(item['module_id']) if item['module_id'] else module_id,
                "order_count": safe_int(item['order_count']),
                "avg_rating": safe_float(item['avg_rating']),
                "rating_count": safe_int(item['rating_count']),
                "rating": safe_str(item['rating']) if item['rating'] else None,  # Keep as JSON string or None
                "stock": safe_int(item.get('stock')),
                "available_time_starts": safe_str(item['available_time_starts']) if item['available_time_starts'] else None,
                "available_time_ends": safe_str(item['available_time_ends']) if item['available_time_ends'] else None,
                "category_name": safe_str(item['category_name']) or "",
                "delivery_time": safe_str(item['delivery_time']) or "30-40 min",
            }
            
            # Add geo_point if coordinates available
            if item.get('latitude') and item.get('longitude'):
                doc["store_location"] = {
                    "lat": float(item['latitude']),
                    "lon": float(item['longitude'])
                }
            
            if item.get('created_at'):
                doc["created_at"] = item['created_at'].isoformat() if hasattr(item['created_at'], 'isoformat') else str(item['created_at'])
            if item.get('updated_at'):
                doc["updated_at"] = item['updated_at'].isoformat() if hasattr(item['updated_at'], 'isoformat') else str(item['updated_at'])
            
            documents.append(doc)
        
        # Check if index is an alias
        actual_index = get_actual_index_name(index_name)
        if actual_index:
            print(f"ℹ️  {index_name} is an alias pointing to {actual_index}, will use bulk indexing")
        
        # Bulk index
        return bulk_index_documents(index_name, documents)
        
    except Exception as e:
        print(f"❌ Error syncing items: {e}")
        import traceback
        traceback.print_exc()
        return 0

if __name__ == "__main__":
    print("=" * 70)
    print("  MySQL → OpenSearch Products/Items Sync (READ-ONLY)")
    print("=" * 70)
    print(f"📖 MySQL Source: {MYSQL_CONFIG['host']}:{MYSQL_CONFIG['port']}/{MYSQL_CONFIG['database']} (READ-ONLY)")
    print(f"📝 OpenSearch Target: {OPENSEARCH_URL}")
    print("⚠️  IMPORTANT: This script ONLY READS from MySQL. No changes to MySQL database.")
    print("=" * 70)
    
    # Verify OpenSearch is accessible
    try:
        response = requests.get(f"{OPENSEARCH_URL}/_cluster/health", timeout=5)
        if response.status_code == 200:
            health = response.json()
            print(f"✅ OpenSearch is accessible (status: {health.get('status', 'unknown')})")
        else:
            print(f"❌ OpenSearch returned status {response.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Cannot connect to OpenSearch at {OPENSEARCH_URL}: {e}")
        sys.exit(1)
    
    # Sync Food module (module_id=4)
    print("\n" + "=" * 70)
    print("  FOOD MODULE (module_id=4)")
    print("=" * 70)
    food_items = sync_items(4, "food_items")
    
    # Sync E-commerce module (module_id=5)
    print("\n" + "=" * 70)
    print("  E-COMMERCE MODULE (module_id=5)")
    print("=" * 70)
    ecom_items = sync_items(5, "ecom_items")
    
    # Summary
    print("\n" + "=" * 70)
    print("  SYNC SUMMARY")
    print("=" * 70)
    print(f"✅ Food items: {food_items} documents")
    print(f"✅ E-commerce items: {ecom_items} documents")
    print("\n✅ Sync complete! (MySQL database was NOT modified)")
    print("=" * 70)

