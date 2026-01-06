#!/usr/bin/env python3
"""
Quick script to reindex images from MySQL to OpenSearch
Updates image URLs in OpenSearch based on current MySQL data
"""
import mysql.connector
import requests
import json
import os
import sys

# Configuration
MYSQL_CONFIG = {
    'host': os.getenv("MYSQL_HOST", "dashboard_mangwale_mysql"),
    'port': int(os.getenv("MYSQL_PORT", "3306")),
    'user': os.getenv("MYSQL_USER", "root"),
    'password': os.getenv("MYSQL_PASSWORD", "root_password"),
    'database': os.getenv("MYSQL_DATABASE", "mangwale_db")
}

OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://localhost:9200")
TARGET_INDEX = os.getenv("TARGET_INDEX", "food_items_v4")
BATCH_SIZE = 100

def build_image_urls(image_filename):
    """Build image URLs from filename"""
    if not image_filename or image_filename == '[]' or image_filename == 'null':
        return {
            'image': '',
            'image_full_url': '',
            'image_fallback_url': '',
            'image_cdn_url': ''
        }
    
    filename = str(image_filename).strip()
    return {
        'image': filename,
        'image_full_url': f"https://storage.mangwale.ai/mangwale/product/{filename}" if filename else "",
        'image_fallback_url': f"https://mangwale.s3.ap-south-1.amazonaws.com/product/{filename}" if filename else "",
        'image_cdn_url': f"https://cdn.mangwale.ai/product/{filename}" if filename else ""
    }

def parse_images_json(images_str):
    """Parse images JSON string"""
    if not images_str or images_str == '[]' or images_str == 'null':
        return []
    
    try:
        if isinstance(images_str, str):
            return json.loads(images_str)
        return images_str if isinstance(images_str, list) else []
    except:
        return []

def update_opensearch_bulk(updates):
    """Bulk update OpenSearch documents"""
    if not updates:
        return 0
    
    bulk_body = []
    for item_id, image_data in updates.items():
        bulk_body.append(json.dumps({"update": {"_index": TARGET_INDEX, "_id": str(item_id)}}))
        bulk_body.append(json.dumps({"doc": image_data}))
    
    bulk_data = "\n".join(bulk_body) + "\n"
    
    try:
        response = requests.post(
            f"{OPENSEARCH_URL}/_bulk",
            data=bulk_data,
            headers={"Content-Type": "application/x-ndjson"},
            timeout=30
        )
        
        if response.status_code in [200, 201]:
            result = response.json()
            # Count successful updates
            success = sum(1 for item in result.get('items', []) if item.get('update', {}).get('status') in [200, 201])
            return success
        else:
            print(f"   ⚠️  Bulk update error: {response.status_code} - {response.text[:200]}")
            return 0
    except Exception as e:
        print(f"   ⚠️  Bulk update exception: {str(e)}")
        return 0

def main():
    print("=" * 70)
    print("  Reindexing Images: MySQL → OpenSearch")
    print("=" * 70)
    print(f"📖 MySQL: {MYSQL_CONFIG['host']}:{MYSQL_CONFIG['port']}/{MYSQL_CONFIG['database']}")
    print(f"📝 OpenSearch: {OPENSEARCH_URL}")
    print(f"🎯 Target Index: {TARGET_INDEX}")
    print("=" * 70)
    
    # Connect to MySQL
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor(dictionary=True)
        print("✅ Connected to MySQL\n")
    except Exception as e:
        print(f"❌ MySQL connection failed: {e}")
        return
    
    # Fetch items with images
    query = """
        SELECT 
            i.id, i.image, i.images
        FROM items i
        WHERE i.module_id = 4 AND i.status = 1 AND i.is_approved = 1
        ORDER BY i.id
    """
    
    try:
        cursor.execute(query)
        items = cursor.fetchall()
        print(f"📊 Found {len(items):,} items to update\n")
    except Exception as e:
        print(f"❌ Query failed: {e}")
        cursor.close()
        conn.close()
        return
    
    if not items:
        print("⚠️  No items found")
        cursor.close()
        conn.close()
        return
    
    # Process in batches
    total_updated = 0
    batch_updates = {}
    
    for i, item in enumerate(items):
        item_id = item['id']
        image = item.get('image') or ''
        images_str = item.get('images') or '[]'
        
        # Build primary image URLs
        primary_urls = build_image_urls(image)
        
        # Parse additional images
        additional_images_list = parse_images_json(images_str)
        additional_images = []
        for img in additional_images_list:
            if img and img != 'null':
                additional_images.append({
                    'primary': f"https://storage.mangwale.ai/mangwale/product/{img}",
                    'fallback': f"https://mangwale.s3.ap-south-1.amazonaws.com/product/{img}",
                    'cdn': f"https://cdn.mangwale.ai/product/{img}",
                    'filename': img
                })
        
        # Prepare update document
        update_doc = {
            'image': primary_urls['image'],
            'image_full_url': primary_urls['image_full_url'],
            'image_fallback_url': primary_urls['image_fallback_url'],
            'image_cdn_url': primary_urls['image_cdn_url']
        }
        
        if additional_images:
            update_doc['additional_images'] = additional_images
            update_doc['total_images'] = 1 + len(additional_images) if image else len(additional_images)
        else:
            update_doc['total_images'] = 1 if image else 0
        
        batch_updates[item_id] = update_doc
        
        # Bulk update when batch is full
        if len(batch_updates) >= BATCH_SIZE:
            updated = update_opensearch_bulk(batch_updates)
            total_updated += updated
            print(f"   ✅ Updated batch: {updated}/{len(batch_updates)} items (Total: {total_updated:,}/{i+1:,})")
            batch_updates = {}
    
    # Update remaining items
    if batch_updates:
        updated = update_opensearch_bulk(batch_updates)
        total_updated += updated
        print(f"   ✅ Updated final batch: {updated}/{len(batch_updates)} items")
    
    print("\n" + "=" * 70)
    print(f"✅ Reindexing complete!")
    print(f"   Total items processed: {len(items):,}")
    print(f"   Successfully updated: {total_updated:,}")
    print("=" * 70)
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()

