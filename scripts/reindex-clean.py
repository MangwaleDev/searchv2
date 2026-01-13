#!/usr/bin/env python3
"""
Complete Clean Reindexing for Mangwale Search V2
This script performs a FULL reindex with:
1. Deduplication by ID (removes duplicate item/store/category entries)
2. Exact ID matching from database
3. Complete data freshness (no stale records)
4. Proper error handling and validation
"""

import mysql.connector
import requests
import json
import os
import time
import ssl
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Set
from decimal import Decimal

# Fix for Python 3.12 - ssl.wrap_socket is removed
if not hasattr(ssl, 'wrap_socket'):
    def _ssl_wrap_socket(sock, *args, **kwargs):
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        return context.wrap_socket(sock, server_hostname=None)
    ssl.wrap_socket = _ssl_wrap_socket

# Configuration
OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://172.25.0.6:9200")
EMBEDDING_SERVICE_URL = os.getenv("EMBEDDING_SERVICE_URL", "http://localhost:3101")

# MySQL configuration - Production
MYSQL_CONFIG = {
    'host': os.getenv("MYSQL_HOST", "103.86.176.59"),
    'user': os.getenv("MYSQL_USER", "root"),
    'password': os.getenv("MYSQL_PASSWORD", "root_password"),
    'database': os.getenv("MYSQL_DATABASE", "mangwale_db")
}

BATCH_SIZE = 100
MAX_EMBEDDING_BATCH = 50

class CleanReindexer:
    def __init__(self):
        self.processed_count = 0
        self.error_count = 0
        self.duplicate_count = 0
        self.start_time = time.time()
        self.conn = None
        self.seen_ids = {}  # Track seen IDs to prevent duplicates
        
    def connect_mysql(self):
        """Connect to MySQL database"""
        try:
            self.conn = mysql.connector.connect(**MYSQL_CONFIG)
            print(f"✅ Connected to MySQL: {MYSQL_CONFIG['host']}/{MYSQL_CONFIG['database']}")
            return True
        except mysql.connector.Error as e:
            print(f"❌ MySQL connection error: {e}")
            return False
    
    def check_opensearch(self):
        """Check OpenSearch connection"""
        try:
            response = requests.get(f"{OPENSEARCH_URL}/_cluster/health", timeout=5)
            if response.status_code == 200:
                health = response.json()
                status = health.get("status", "unknown")
                shards = health.get("active_shards", 0)
                print(f"✅ OpenSearch OK (status: {status}, shards: {shards})")
                return True
            return False
        except Exception as e:
            print(f"❌ OpenSearch error: {e}")
            return False
    
    def convert_value(self, val: Any) -> Any:
        """Convert MySQL values to JSON-safe types"""
        if val is None:
            return None
        if isinstance(val, Decimal):
            return float(val)
        if isinstance(val, datetime):
            return val.isoformat()
        if isinstance(val, timedelta):
            total_seconds = int(val.total_seconds())
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            seconds = total_seconds % 60
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        if isinstance(val, bytes):
            return val.decode('utf-8', errors='ignore')
        return val
    
    # ==================== FOOD ITEMS REINDEX ====================
    
    def reindex_food_items(self):
        """Reindex food items with deduplication"""
        print("\n" + "="*80)
        print("🔄 REINDEXING FOOD ITEMS (food_items_v4)")
        print("="*80)
        
        # Fetch from database
        cursor = self.conn.cursor(dictionary=True)
        
        # Query to get UNIQUE items by ID (latest version only)
        query = """
        SELECT 
            i.id,
            i.name,
            i.description,
            i.slug,
            i.price,
            i.tax,
            i.tax_type,
            i.discount,
            i.discount_type,
            i.veg,
            i.status,
            i.stock,
            i.module_id,
            i.recommended,
            i.organic,
            i.is_halal,
            i.is_approved,
            i.is_visible,
            i.maximum_cart_quantity,
            i.minimum_cart_quantity,
            i.created_at,
            i.updated_at,
            i.category_id,
            i.store_id,
            c.name as category_name,
            c.slug as category_slug,
            s.name as store_name,
            s.slug as store_slug,
            s.status as store_status,
            s.active as store_active,
            s.logo as store_logo,
            s.zone_id,
            s.rating as store_rating
        FROM food_items i
        LEFT JOIN food_categories c ON i.category_id = c.id
        LEFT JOIN food_stores s ON i.store_id = s.id
        WHERE i.module_id = 4
        ORDER BY i.id, i.updated_at DESC
        """
        
        cursor.execute(query)
        all_items = cursor.fetchall()
        cursor.close()
        
        # Deduplicate by ID - keep only the latest version
        unique_items = {}
        for item in all_items:
            item_id = item['id']
            if item_id not in unique_items:
                unique_items[item_id] = item
        
        items = list(unique_items.values())
        print(f"📊 Fetched {len(items):,} UNIQUE food items (from {len(all_items)} total records)")
        if len(all_items) > len(items):
            print(f"   🧹 Removed {len(all_items) - len(items)} duplicate/old versions")
        
        if not items:
            print("⚠️  No items found")
            return False
        
        # Delete old index
        print("\n🗑️  Deleting old food_items_v4 index...")
        try:
            requests.delete(f"{OPENSEARCH_URL}/food_items_v4", timeout=10)
            print("   ✅ Deleted")
        except:
            print("   ⚠️  Index didn't exist (OK)")
        
        # Create fresh index
        if not self._create_food_index():
            return False
        
        # Process and index
        print(f"\n📤 Indexing {len(items):,} items in batches of {BATCH_SIZE}...")
        self.seen_ids = set()
        
        for i in range(0, len(items), BATCH_SIZE):
            batch = items[i:i + BATCH_SIZE]
            
            # Deduplicate within batch
            unique_batch = {}
            for item in batch:
                item_id = item['id']
                if item_id not in self.seen_ids:
                    unique_batch[item_id] = item
                    self.seen_ids.add(item_id)
                else:
                    self.duplicate_count += 1
            
            if not unique_batch:
                continue
            
            # Transform documents
            docs = [self._transform_food_item(item) for item in unique_batch.values()]
            
            # Index
            self._bulk_index("food_items_v4", docs)
            
            elapsed = time.time() - self.start_time
            rate = self.processed_count / max(elapsed, 0.1)
            print(f"   [{i + len(batch):,}/{len(items):,}] {rate:.1f} docs/sec")
        
        print(f"\n✅ Food items indexed: {self.processed_count:,} (Errors: {self.error_count}, Duplicates removed: {self.duplicate_count})")
        return True
    
    def _create_food_index(self) -> bool:
        """Create food items index"""
        mapping = {
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
                    "updated_at": {"type": "date"}
                }
            }
        }
        
        try:
            response = requests.put(
                f"{OPENSEARCH_URL}/food_items_v4",
                json=mapping,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            if response.status_code in [200, 201]:
                print("   ✅ Index created: food_items_v4")
                return True
            else:
                print(f"   ❌ Failed: {response.text}")
                return False
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return False
    
    def _transform_food_item(self, item: Dict) -> Dict:
        """Transform food item to document"""
        return {
            "id": int(item['id']),
            "name": self.convert_value(item.get('name')) or "Unnamed",
            "description": self.convert_value(item.get('description')) or "",
            "slug": self.convert_value(item.get('slug')),
            "price": float(item.get('price') or 0),
            "tax": float(item.get('tax') or 0),
            "discount": float(item.get('discount') or 0),
            "veg": int(item.get('veg') or 0),
            "status": int(item.get('status') or 0),
            "stock": int(item.get('stock') or 0),
            "module_id": int(item.get('module_id') or 0),
            "recommended": int(item.get('recommended') or 0),
            "category_id": int(item.get('category_id') or 0) if item.get('category_id') else None,
            "category_name": self.convert_value(item.get('category_name')),
            "store_id": int(item.get('store_id') or 0),
            "store_name": self.convert_value(item.get('store_name')),
            "store_status": int(item.get('store_status') or 1),
            "store_active": int(item.get('store_active') or 1),
            "created_at": self.convert_value(item.get('created_at')),
            "updated_at": self.convert_value(item.get('updated_at'))
        }
    
    # ==================== STORES REINDEX ====================
    
    def reindex_stores(self):
        """Reindex stores with deduplication"""
        print("\n" + "="*80)
        print("🔄 REINDEXING STORES (food_stores_v6)")
        print("="*80)
        
        cursor = self.conn.cursor(dictionary=True)
        
        # Query UNIQUE stores
        query = """
        SELECT 
            id,
            name,
            slug,
            status,
            active,
            logo,
            phone,
            email,
            address,
            zone_id,
            rating,
            module_id
        FROM food_stores
        WHERE module_id = 4
        GROUP BY id
        """
        
        cursor.execute(query)
        items = cursor.fetchall()
        cursor.close()
        
        print(f"📊 Fetched {len(items):,} UNIQUE stores")
        
        if not items:
            print("⚠️  No stores found")
            return False
        
        # Delete old index
        print("\n🗑️  Deleting old food_stores_v6 index...")
        try:
            requests.delete(f"{OPENSEARCH_URL}/food_stores_v6", timeout=10)
            print("   ✅ Deleted")
        except:
            print("   ⚠️  Index didn't exist (OK)")
        
        # Create fresh index
        if not self._create_stores_index():
            return False
        
        # Index stores
        print(f"\n📤 Indexing {len(items):,} stores...")
        docs = [self._transform_store(item) for item in items]
        self._bulk_index("food_stores_v6", docs)
        
        print(f"\n✅ Stores indexed: {len(items):,}")
        return True
    
    def _create_stores_index(self) -> bool:
        """Create stores index"""
        mapping = {
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
        }
        
        try:
            response = requests.put(
                f"{OPENSEARCH_URL}/food_stores_v6",
                json=mapping,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            if response.status_code in [200, 201]:
                print("   ✅ Index created: food_stores_v6")
                return True
            else:
                print(f"   ❌ Failed: {response.text}")
                return False
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return False
    
    def _transform_store(self, item: Dict) -> Dict:
        """Transform store to document"""
        return {
            "id": int(item['id']),
            "name": self.convert_value(item.get('name')) or "Unnamed Store",
            "slug": self.convert_value(item.get('slug')),
            "status": int(item.get('status') or 0),
            "active": int(item.get('active') or 0),
            "logo": self.convert_value(item.get('logo')),
            "zone_id": int(item.get('zone_id') or 0) if item.get('zone_id') else None,
            "rating": float(item.get('rating') or 0)
        }
    
    # ==================== CATEGORIES REINDEX ====================
    
    def reindex_categories(self):
        """Reindex categories with deduplication"""
        print("\n" + "="*80)
        print("🔄 REINDEXING CATEGORIES")
        print("="*80)
        
        cursor = self.conn.cursor(dictionary=True)
        
        # Get food categories
        query_food = """
        SELECT id, name, slug, parent_id, featured, module_id
        FROM food_categories
        WHERE module_id = 4
        GROUP BY id
        """
        
        cursor.execute(query_food)
        food_cats = cursor.fetchall()
        
        # Get ecom categories
        query_ecom = """
        SELECT id, name, slug, parent_id, featured, module_id
        FROM food_categories
        WHERE module_id = 5
        GROUP BY id
        """
        
        cursor.execute(query_ecom)
        ecom_cats = cursor.fetchall()
        cursor.close()
        
        print(f"📊 Fetched {len(food_cats):,} food categories + {len(ecom_cats):,} ecom categories")
        
        # Index food categories
        if food_cats:
            print("\n🗑️  Deleting old food_categories index...")
            try:
                requests.delete(f"{OPENSEARCH_URL}/food_categories", timeout=10)
                print("   ✅ Deleted")
            except:
                pass
            
            if self._create_categories_index("food_categories"):
                docs = [self._transform_category(item) for item in food_cats]
                self._bulk_index("food_categories", docs)
                print(f"✅ Food categories indexed: {len(food_cats):,}")
        
        # Index ecom categories
        if ecom_cats:
            print("\n🗑️  Deleting old ecom_categories index...")
            try:
                requests.delete(f"{OPENSEARCH_URL}/ecom_categories", timeout=10)
                print("   ✅ Deleted")
            except:
                pass
            
            if self._create_categories_index("ecom_categories"):
                docs = [self._transform_category(item) for item in ecom_cats]
                self._bulk_index("ecom_categories", docs)
                print(f"✅ Ecom categories indexed: {len(ecom_cats):,}")
        
        return True
    
    def _create_categories_index(self, index_name: str) -> bool:
        """Create categories index"""
        mapping = {
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
        }
        
        try:
            response = requests.put(
                f"{OPENSEARCH_URL}/{index_name}",
                json=mapping,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            if response.status_code in [200, 201]:
                print(f"   ✅ Index created: {index_name}")
                return True
            else:
                print(f"   ❌ Failed: {response.text}")
                return False
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return False
    
    def _transform_category(self, item: Dict) -> Dict:
        """Transform category to document"""
        return {
            "id": int(item['id']),
            "name": self.convert_value(item.get('name')) or "Unnamed",
            "slug": self.convert_value(item.get('slug')),
            "parent_id": int(item.get('parent_id') or 0) if item.get('parent_id') else None,
            "featured": int(item.get('featured') or 0)
        }
    
    # ==================== BULK INDEX ====================
    
    def _bulk_index(self, index_name: str, docs: List[Dict]):
        """Bulk index documents"""
        if not docs:
            return
        
        bulk_data = ""
        for doc in docs:
            doc_id = doc.get('id')
            bulk_data += json.dumps({"index": {"_index": index_name, "_id": doc_id}}) + "\n"
            bulk_data += json.dumps(doc) + "\n"
        
        try:
            response = requests.post(
                f"{OPENSEARCH_URL}/_bulk",
                data=bulk_data,
                headers={"Content-Type": "application/x-ndjson"},
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                self.processed_count += len(docs)
                if result.get("errors"):
                    errors = [item for item in result.get("items", [])
                             if item.get("index", {}).get("error")]
                    self.error_count += len(errors)
                    if errors:
                        print(f"   ⚠️  Errors: {errors[0]['index']['error']['reason']}")
            else:
                self.error_count += len(docs)
                print(f"   ❌ HTTP {response.status_code}")
        except Exception as e:
            self.error_count += len(docs)
            print(f"   ❌ Error: {e}")
    
    # ==================== MAIN ====================
    
    def run(self):
        """Execute full reindex"""
        print("\n" + "█"*80)
        print("█  MANGWALE CLEAN REINDEXING - PRODUCTION")
        print("█"*80)
        
        if not self.connect_mysql():
            return False
        
        if not self.check_opensearch():
            return False
        
        # Reindex all data
        success = True
        success = self.reindex_food_items() and success
        success = self.reindex_stores() and success
        success = self.reindex_categories() and success
        
        # Summary
        print("\n" + "="*80)
        print("📊 REINDEXING SUMMARY")
        print("="*80)
        elapsed = time.time() - self.start_time
        print(f"⏱️  Time elapsed: {elapsed:.1f}s")
        print(f"📤 Documents processed: {self.processed_count:,}")
        print(f"⚠️  Errors: {self.error_count}")
        print(f"🧹 Duplicates removed: {self.duplicate_count}")
        print(f"✅ Status: {'SUCCESS' if success else 'FAILED'}")
        print("="*80 + "\n")
        
        self.conn.close()
        return success


if __name__ == "__main__":
    reindexer = CleanReindexer()
    success = reindexer.run()
    exit(0 if success else 1)
