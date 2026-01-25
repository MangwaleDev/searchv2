#!/usr/bin/env node
/**
 * Complete Reindexing Script for MySQL to OpenSearch
 * 
 * This script properly indexes items, stores, and categories from MySQL to OpenSearch
 * with correct ID mappings, price calculations, discounts, and relationships.
 * 
 * Features:
 * - Proper category_id to category_name mapping
 * - Correct discount calculation (percentage and amount)
 * - Store location mapping (lat/lon to geo_point)
 * - Category_ids extraction from JSON format
 * - Image URL transformations
 * - Zone-aware indexing
 * 
 * Usage:
 *   node scripts/reindex-mysql-to-opensearch.js --module food
 *   node scripts/reindex-mysql-to-opensearch.js --module ecom
 *   node scripts/reindex-mysql-to-opensearch.js --module all
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { Client } = require('@opensearch-project/opensearch');

const CHUNK_SIZE = 500;

// Module mappings
const MODULES = {
  food: { id: 4, name: 'Food Delivery' },
  ecom: { id: 5, name: 'E-commerce' }, // Updated to 5 to match API expectations
};

class ReindexService {
  constructor() {
    this.mysqlPool = null;
    this.osClient = null;
    this.logger = {
      log: (msg) => console.log(`[${new Date().toISOString()}] ${msg}`),
      warn: (msg) => console.warn(`[${new Date().toISOString()}] ⚠️  ${msg}`),
      error: (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
      success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
    };
  }

  async init() {
    // Initialize MySQL connection
    this.mysqlPool = await mysql.createPool({
      host: process.env.MYSQL_HOST || '103.160.107.41',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'search_43d2_ai_55a6',
      password: process.env.MYSQL_PASSWORD || '4854af0c-326d-4801-8b44-555c53eaec97',
      database: process.env.MYSQL_DATABASE || 'migrated_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      decimalNumbers: true,
    });

    // Initialize OpenSearch client
    // Default to production port 9210 if running outside Docker
    const osNode = process.env.OPENSEARCH_HOST || process.env.OPENSEARCH_URL || 'http://127.0.0.1:9210';
    const osUsername = process.env.OPENSEARCH_USERNAME;
    const osPassword = process.env.OPENSEARCH_PASSWORD;
    
    this.osClient = new Client({
      node: osNode,
      auth: osUsername && osPassword ? { username: osUsername, password: osPassword } : undefined,
      ssl: { rejectUnauthorized: false },
    });

    this.logger.log('Initialized MySQL and OpenSearch connections');
  }

  /**
   * Parse category_ids JSON to extract IDs
   */
  parseCategoryIds(categoryIdsStr) {
    if (!categoryIdsStr || categoryIdsStr === 'null' || categoryIdsStr === '[]') {
      return [];
    }

    try {
      // Try parsing as JSON
      const parsed = JSON.parse(categoryIdsStr);
      if (Array.isArray(parsed)) {
        return parsed.map(item => {
          // Handle both {"id": "288", "position": 1} and simple "288" formats
          if (item && typeof item === 'object' && item.id) {
            return String(item.id);
          }
          return String(item);
        }).filter(Boolean);
      }
      return [];
    } catch (e) {
      // Fallback: extract IDs using regex
      const matches = categoryIdsStr.match(/"id"\s*:\s*"?(\d+)"?/g);
      if (matches) {
        return matches.map(m => m.match(/(\d+)/)[1]);
      }
      return [];
    }
  }

  /**
   * Calculate final price after discount
   */
  calculateFinalPrice(price, discount, discountType) {
    const priceNum = parseFloat(price) || 0;
    const discountNum = parseFloat(discount) || 0;

    if (discountNum === 0) {
      return priceNum;
    }

    if (discountType === 'percent' || discountType === 'percentage') {
      return priceNum - (priceNum * discountNum / 100);
    } else {
      // amount discount
      return Math.max(0, priceNum - discountNum);
    }
  }

  /**
   * Load all stores into memory for fast lookup
   */
  async loadStores(moduleId) {
    const [stores] = await this.mysqlPool.query(
      'SELECT id, name, latitude, longitude, delivery_time, zone_id FROM stores WHERE module_id = ? AND status = 1',
      [moduleId]
    );

    const storeMap = new Map();
    for (const store of stores) {
      storeMap.set(Number(store.id), {
        name: store.name,
        latitude: store.latitude,
        longitude: store.longitude,
        delivery_time: store.delivery_time || '30-40 min',
        zone_id: store.zone_id,
      });
    }

    this.logger.log(`Loaded ${storeMap.size} stores for module ${moduleId}`);
    return storeMap;
  }

  /**
   * Load all categories into memory for fast lookup
   */
  async loadCategories(moduleId) {
    const [categories] = await this.mysqlPool.query(
      'SELECT id, name, parent_id FROM categories WHERE module_id = ? AND status = 1',
      [moduleId]
    );

    const categoryMap = new Map();
    for (const cat of categories) {
      categoryMap.set(Number(cat.id), {
        name: cat.name,
        parent_id: cat.parent_id,
      });
    }

    this.logger.log(`Loaded ${categoryMap.size} categories for module ${moduleId}`);
    return categoryMap;
  }

  /**
   * Fetch items from MySQL (only items with valid active stores)
   */
  async fetchItems(moduleId, offset, limit) {
    const [items] = await this.mysqlPool.query(
      `SELECT 
        i.id, i.name, i.description, i.image, i.images,
        i.category_id, i.category_ids,
        i.variations, i.add_ons, i.attributes, i.choice_options,
        i.price, i.tax, i.tax_type, i.tax_included,
        i.discount, i.discount_type,
        i.available_time_starts, i.available_time_ends,
        i.veg, i.status, i.store_id,
        i.created_at, i.updated_at,
        i.order_count, i.avg_rating, i.rating_count, i.rating,
        i.module_id, i.stock, i.unit_id,
        i.food_variations, i.slug, i.recommended, i.organic,
        i.maximum_cart_quantity, i.is_approved, i.is_halal, i.is_visible
      FROM items i
      INNER JOIN stores s ON i.store_id = s.id
      WHERE i.module_id = ? 
        AND i.status = 1 
        AND i.is_approved = 1
        AND s.status = 1
      ORDER BY i.id ASC
      LIMIT ? OFFSET ?`,
      [moduleId, limit, offset]
    );

    return items;
  }

  /**
   * Transform item for OpenSearch indexing
   */
  transformItem(item, storeMap, categoryMap) {
    const store = storeMap.get(Number(item.store_id));
    const category = categoryMap.get(Number(item.category_id));

    // Parse category_ids
    const categoryIds = this.parseCategoryIds(item.category_ids);

    // Calculate final price
    const finalPrice = this.calculateFinalPrice(item.price, item.discount, item.discount_type);

    // Build geo_point for store location
    let storeLocation = null;
    if (store && store.latitude && store.longitude) {
      const lat = parseFloat(store.latitude);
      const lon = parseFloat(store.longitude);
      if (!isNaN(lat) && !isNaN(lon)) {
        storeLocation = { lat, lon };
      }
    }

    // Parse images array
    let images = [];
    if (item.images) {
      try {
        const parsed = JSON.parse(item.images);
        if (Array.isArray(parsed)) {
          images = parsed.map(img => {
            if (typeof img === 'object' && img.img) return img.img;
            if (typeof img === 'object' && img.image) return img.image;
            return String(img);
          });
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Keep JSON fields as strings (don't parse)
    const keepAsString = ['variations', 'add_ons', 'attributes', 'choice_options', 'food_variations', 'rating'];
    const transformed = {
      id: Number(item.id),
      name: item.name,
      description: item.description,
      image: item.image,
      images: images,
      category_id: Number(item.category_id),
      category_name: category ? category.name : null,
      category_ids: categoryIds,
      price: parseFloat(item.price) || 0,
      final_price: finalPrice,
      tax: parseFloat(item.tax) || 0,
      tax_type: item.tax_type,
      tax_included: item.tax_included ? 1 : 0,
      discount: parseFloat(item.discount) || 0,
      discount_type: item.discount_type,
      discount_amount: item.discount_type === 'amount' ? parseFloat(item.discount) || 0 : (parseFloat(item.price) || 0) * (parseFloat(item.discount) || 0) / 100,
      veg: (item.veg && item.veg !== 0 && item.veg !== '0' && item.veg !== false) ? 1 : 0,
      status: (item.status && item.status !== 0 && item.status !== '0' && item.status !== false) ? 1 : 0,
      store_id: Number(item.store_id),
      store_name: store ? store.name : null,
      store_location: storeLocation,
      delivery_time: store ? store.delivery_time : null,
      zone_id: store ? store.zone_id : null,
      module_id: Number(item.module_id),
      order_count: Number(item.order_count) || 0,
      avg_rating: parseFloat(item.avg_rating) || 0,
      rating_count: Number(item.rating_count) || 0,
      stock: Number(item.stock) || 0,
      slug: item.slug,
      recommended: (item.recommended && item.recommended !== 0 && item.recommended !== '0' && item.recommended !== false) ? 1 : 0,
      organic: (item.organic && item.organic !== 0 && item.organic !== '0' && item.organic !== false) ? 1 : 0,
      is_approved: (item.is_approved && item.is_approved !== 0 && item.is_approved !== '0' && item.is_approved !== false) ? 1 : 0,
      is_halal: (item.is_halal && item.is_halal !== 0 && item.is_halal !== '0' && item.is_halal !== false) ? 1 : 0,
      is_visible: (item.is_visible && item.is_visible !== 0 && item.is_visible !== '0' && item.is_visible !== false) ? 1 : 0,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };

    // Add string fields (keep as JSON strings)
    keepAsString.forEach(field => {
      if (item[field] !== null && item[field] !== undefined) {
        transformed[field] = String(item[field]);
      }
    });

    // Add available time
    if (item.available_time_starts !== null) {
      transformed.available_time_starts = Number(item.available_time_starts);
    }
    if (item.available_time_ends !== null) {
      transformed.available_time_ends = Number(item.available_time_ends);
    }

    return transformed;
  }

  /**
   * Bulk index items to OpenSearch
   */
  async bulkIndexItems(items, indexName) {
    if (items.length === 0) return { indexed: 0, failed: 0 };

    const bulkBody = [];
    for (const item of items) {
      bulkBody.push({
        index: {
          _index: indexName,
          _id: String(item.id),
        },
      });
      bulkBody.push(item);
    }

    try {
      const response = await this.osClient.bulk({
        body: bulkBody,
        refresh: true,
      });

      if (response.body.errors) {
        const errors = response.body.items.filter(i => i.index?.error);
        const failed = errors.length;
        const indexed = items.length - failed;
        
        // Log first few errors
        errors.slice(0, 3).forEach(err => {
          this.logger.error(`Index error for ID ${err.index._id}: ${err.index.error.reason}`);
        });

        return { indexed, failed };
      }

      return { indexed: items.length, failed: 0 };
    } catch (error) {
      this.logger.error(`Bulk index error: ${error.message}`);
      return { indexed: 0, failed: items.length };
    }
  }

  /**
   * Reindex items for a specific module
   */
  async reindexItems(moduleType) {
    const module = MODULES[moduleType];
    if (!module) {
      throw new Error(`Unknown module type: ${moduleType}`);
    }

    // Use correct index names: food_items_v4 for food, ecom_items for ecom
    const indexName = moduleType === 'food' ? 'food_items_v4' : 'ecom_items';
    this.logger.log(`Starting reindex for ${module.name} (module_id: ${module.id}) to index ${indexName}`);

    // Load stores and categories
    const storeMap = await this.loadStores(module.id);
    const categoryMap = await this.loadCategories(module.id);

    // Count total items (only with valid active stores)
    const [countResult] = await this.mysqlPool.query(
      `SELECT COUNT(*) as total 
       FROM items i
       INNER JOIN stores s ON i.store_id = s.id
       WHERE i.module_id = ? 
         AND i.status = 1 
         AND i.is_approved = 1
         AND s.status = 1`,
      [module.id]
    );
    const totalItems = countResult[0].total;
    this.logger.log(`Total items to index (with valid stores): ${totalItems}`);

    let offset = 0;
    let totalIndexed = 0;
    let totalFailed = 0;

    while (offset < totalItems) {
      // Fetch chunk
      const items = await this.fetchItems(module.id, offset, CHUNK_SIZE);
      if (items.length === 0) break;

      // Transform items
      const transformed = items.map(item => 
        this.transformItem(item, storeMap, categoryMap)
      ).filter(item => {
        // Filter out items without valid store
        if (!item.store_name) {
          this.logger.warn(`Skipping item ${item.id} - no valid store found for store_id ${item.store_id}`);
          return false;
        }
        return true;
      });

      // Bulk index
      const result = await this.bulkIndexItems(transformed, indexName);
      totalIndexed += result.indexed;
      totalFailed += result.failed;

      offset += CHUNK_SIZE;
      const progress = Math.min(offset, totalItems);
      this.logger.log(`Progress: ${progress}/${totalItems} (${((progress/totalItems)*100).toFixed(1)}%) - Indexed: ${totalIndexed}, Failed: ${totalFailed}`);
    }

    this.logger.success(`Completed ${module.name} reindex: ${totalIndexed} indexed, ${totalFailed} failed`);
    return { indexed: totalIndexed, failed: totalFailed };
  }

  /**
   * Reindex stores
   */
  async reindexStores(moduleType) {
    const module = MODULES[moduleType];
    if (!module) {
      throw new Error(`Unknown module type: ${moduleType}`);
    }

    // Use correct index names: food_stores_v6 for food, ecom_stores for ecom
    const indexName = moduleType === 'food' ? 'food_stores_v6' : 'ecom_stores';
    this.logger.log(`Starting store reindex for ${module.name} to index ${indexName}`);

    const [stores] = await this.mysqlPool.query(
      `SELECT 
        id, name, phone, email, logo, cover_photo,
        latitude, longitude, address,
        minimum_order, delivery_time, zone_id,
        status, active, veg, non_veg,
        delivery, take_away,
        rating, order_count, total_order,
        module_id, slug,
        created_at, updated_at
      FROM stores 
      WHERE module_id = ? AND status = 1`,
      [module.id]
    );

    const transformed = stores.map(store => {
      let location = null;
      if (store.latitude && store.longitude) {
        const lat = parseFloat(store.latitude);
        const lon = parseFloat(store.longitude);
        if (!isNaN(lat) && !isNaN(lon)) {
          location = { lat, lon };
        }
      }

      return {
        id: Number(store.id),
        name: store.name,
        phone: store.phone,
        email: store.email,
        logo: store.logo,
        cover_photo: store.cover_photo,
        latitude: store.latitude,
        longitude: store.longitude,
        location: location,
        address: store.address,
        minimum_order: parseFloat(store.minimum_order) || 0,
        delivery_time: store.delivery_time,
        zone_id: store.zone_id,
        status: (store.status && store.status !== 0 && store.status !== '0' && store.status !== false) ? 1 : 0,
        active: (store.active && store.active !== 0 && store.active !== '0' && store.active !== false) ? 1 : 0,
        veg: (store.veg && store.veg !== 0 && store.veg !== '0' && store.veg !== false) ? 1 : 0,
        non_veg: (store.non_veg && store.non_veg !== 0 && store.non_veg !== '0' && store.non_veg !== false) ? 1 : 0,
        delivery: (store.delivery && store.delivery !== 0 && store.delivery !== '0' && store.delivery !== false) ? 1 : 0,
        take_away: (store.take_away && store.take_away !== 0 && store.take_away !== '0' && store.take_away !== false) ? 1 : 0,
        rating: store.rating,
        order_count: Number(store.order_count) || 0,
        total_order: Number(store.total_order) || 0,
        module_id: Number(store.module_id),
        slug: store.slug,
        created_at: store.created_at,
        updated_at: store.updated_at,
      };
    });

    const result = await this.bulkIndexItems(transformed, indexName);
    this.logger.success(`Completed ${module.name} store reindex: ${result.indexed} indexed, ${result.failed} failed`);
    return result;
  }

  /**
   * Reindex categories
   */
  async reindexCategories(moduleType) {
    const module = MODULES[moduleType];
    if (!module) {
      throw new Error(`Unknown module type: ${moduleType}`);
    }

    const indexName = `${moduleType}_categories`;
    this.logger.log(`Starting category reindex for ${module.name} to index ${indexName}`);

    const [categories] = await this.mysqlPool.query(
      `SELECT 
        id, name, image, parent_id, position, status,
        priority, module_id, slug, featured,
        created_at, updated_at
      FROM categories 
      WHERE module_id = ? AND status = 1`,
      [module.id]
    );

    const transformed = categories.map(cat => ({
      id: Number(cat.id),
      name: cat.name,
      image: cat.image,
      parent_id: Number(cat.parent_id),
      position: Number(cat.position),
      status: Boolean(cat.status && cat.status !== 0 && cat.status !== '0'),
      priority: Number(cat.priority) || 0,
      module_id: Number(cat.module_id),
      slug: cat.slug,
      featured: cat.featured ? 1 : 0,
      created_at: cat.created_at,
      updated_at: cat.updated_at,
    }));

    const result = await this.bulkIndexItems(transformed, indexName);
    this.logger.success(`Completed ${module.name} category reindex: ${result.indexed} indexed, ${result.failed} failed`);
    return result;
  }

  /**
   * Main reindex function
   */
  async reindex(moduleType = 'all') {
    await this.init();

    const modules = moduleType === 'all' ? Object.keys(MODULES) : [moduleType];

    this.logger.log(`🚀 Starting complete reindex for modules: ${modules.join(', ')}`);

    const results = {};

    for (const mod of modules) {
      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`Processing module: ${mod.toUpperCase()}`);
      this.logger.log('='.repeat(80));

      try {
        results[mod] = {
          categories: await this.reindexCategories(mod),
          stores: await this.reindexStores(mod),
          items: await this.reindexItems(mod),
        };
      } catch (error) {
        this.logger.error(`Error reindexing ${mod}: ${error.message}`);
        results[mod] = { error: error.message };
      }
    }

    this.logger.log(`\n${'='.repeat(80)}`);
    this.logger.success('REINDEX COMPLETE!');
    this.logger.log('='.repeat(80));
    console.log(JSON.stringify(results, null, 2));

    await this.mysqlPool.end();
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  let moduleType = 'all';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--module' && args[i + 1]) {
      moduleType = args[i + 1];
    }
  }

  const service = new ReindexService();
  await service.reindex(moduleType);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { ReindexService };
