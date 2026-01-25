#!/usr/bin/env node
/**
 * Diagnostic script to identify missing items between MySQL and OpenSearch
 * 
 * This script:
 * 1. Counts items in MySQL by status/approval
 * 2. Counts items in OpenSearch indices
 * 3. Identifies missing items and reasons
 * 4. Provides recommendations for fixing sync
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { Client } = require('@opensearch-project/opensearch');

const MODULES = {
  food: { id: 4, name: 'Food Delivery', index: 'food_items_v4' },
  ecom: { id: 5, name: 'E-commerce', index: 'ecom_items' },
};

class DiagnosticService {
  constructor() {
    this.mysqlPool = null;
    this.osClient = null;
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
    const osNode = process.env.OPENSEARCH_HOST || process.env.OPENSEARCH_URL || 'http://127.0.0.1:9210';
    const osUsername = process.env.OPENSEARCH_USERNAME;
    const osPassword = process.env.OPENSEARCH_PASSWORD;
    
    this.osClient = new Client({
      node: osNode,
      auth: osUsername && osPassword ? { username: osUsername, password: osPassword } : undefined,
      ssl: { rejectUnauthorized: false },
    });

    console.log('✅ Initialized connections');
  }

  async getMySQLItemStats(moduleId) {
    const queries = {
      total: 'SELECT COUNT(*) as count FROM items WHERE module_id = ?',
      active: 'SELECT COUNT(*) as count FROM items WHERE module_id = ? AND status = 1',
      approved: 'SELECT COUNT(*) as count FROM items WHERE module_id = ? AND is_approved = 1',
      activeAndApproved: 'SELECT COUNT(*) as count FROM items WHERE module_id = ? AND status = 1 AND is_approved = 1',
      withValidStore: `
        SELECT COUNT(*) as count 
        FROM items i
        INNER JOIN stores s ON i.store_id = s.id
        WHERE i.module_id = ? 
          AND i.status = 1 
          AND i.is_approved = 1
          AND s.status = 1
      `,
      missingStore: `
        SELECT COUNT(*) as count 
        FROM items i
        LEFT JOIN stores s ON i.store_id = s.id
        WHERE i.module_id = ? 
          AND i.status = 1 
          AND i.is_approved = 1
          AND (s.id IS NULL OR s.status != 1)
      `,
      isApprovedNull: 'SELECT COUNT(*) as count FROM items WHERE module_id = ? AND (is_approved IS NULL OR is_approved = 0) AND status = 1',
      isVisibleZero: 'SELECT COUNT(*) as count FROM items WHERE module_id = ? AND status = 1 AND is_approved = 1 AND is_visible = 0',
    };

    const stats = {};
    for (const [key, query] of Object.entries(queries)) {
      const [rows] = await this.mysqlPool.query(query, [moduleId]);
      stats[key] = rows[0].count;
    }

    return stats;
  }

  async getOpenSearchCount(indexName) {
    try {
      const response = await this.osClient.count({ index: indexName });
      return response.body.count;
    } catch (error) {
      if (error.meta?.body?.error?.type === 'index_not_found_exception') {
        return 0;
      }
      throw error;
    }
  }

  async getMissingItemIds(moduleId, indexName) {
    // Get all item IDs from MySQL that should be indexed
    const [mysqlItems] = await this.mysqlPool.query(
      `SELECT i.id 
       FROM items i
       INNER JOIN stores s ON i.store_id = s.id
       WHERE i.module_id = ? 
         AND i.status = 1 
         AND i.is_approved = 1
         AND s.status = 1
       ORDER BY i.id`,
      [moduleId]
    );

    const mysqlIds = new Set(mysqlItems.map(r => String(r.id)));

    // Get all item IDs from OpenSearch
    const osIds = new Set();
    try {
      const response = await this.osClient.search({
        index: indexName,
        body: {
          size: 10000,
          _source: ['id'],
          query: { match_all: {} },
        },
        scroll: '1m',
      });

      let scrollId = response.body._scroll_id;
      let hits = response.body.hits.hits;

      while (hits.length > 0) {
        hits.forEach(hit => {
          const id = hit._source?.id || hit._id;
          osIds.add(String(id));
        });

        if (scrollId) {
          const scrollResponse = await this.osClient.scroll({
            scrollId,
            scroll: '1m',
          });
          hits = scrollResponse.body.hits.hits;
          scrollId = scrollResponse.body._scroll_id;
        } else {
          break;
        }
      }
    } catch (error) {
      if (error.meta?.body?.error?.type !== 'index_not_found_exception') {
        console.warn(`⚠️  Could not fetch OpenSearch IDs: ${error.message}`);
      }
    }

    // Find missing IDs
    const missing = [];
    for (const id of mysqlIds) {
      if (!osIds.has(id)) {
        missing.push(Number(id));
      }
    }

    return missing;
  }

  async getItemDetails(itemIds) {
    if (itemIds.length === 0) return [];
    
    const placeholders = itemIds.map(() => '?').join(',');
    const [items] = await this.mysqlPool.query(
      `SELECT 
        i.id, i.name, i.status, i.is_approved, i.is_visible, i.store_id,
        s.name as store_name, s.status as store_status
       FROM items i
       LEFT JOIN stores s ON i.store_id = s.id
       WHERE i.id IN (${placeholders})
       LIMIT 100`,
      itemIds
    );
    return items;
  }

  async diagnoseModule(moduleType) {
    const module = MODULES[moduleType];
    if (!module) {
      throw new Error(`Unknown module: ${moduleType}`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 DIAGNOSING: ${module.name} (module_id: ${module.id})`);
    console.log('='.repeat(80));

    // Get MySQL stats
    console.log('\n📊 MySQL Database Statistics:');
    const mysqlStats = await this.getMySQLItemStats(module.id);
    console.log(`  Total items:                    ${mysqlStats.total}`);
    console.log(`  Active (status=1):              ${mysqlStats.active}`);
    console.log(`  Approved (is_approved=1):      ${mysqlStats.approved}`);
    console.log(`  Active + Approved:             ${mysqlStats.activeAndApproved}`);
    console.log(`  With valid active store:       ${mysqlStats.withValidStore}`);
    console.log(`  Missing/invalid store:         ${mysqlStats.missingStore}`);
    console.log(`  Active but not approved:       ${mysqlStats.isApprovedNull}`);
    console.log(`  Approved but is_visible=0:     ${mysqlStats.isVisibleZero}`);

    // Get OpenSearch count
    console.log(`\n🔍 OpenSearch Index Statistics:`);
    const osCount = await this.getOpenSearchCount(module.index);
    console.log(`  Indexed in ${module.index}:    ${osCount}`);

    // Calculate difference
    const expected = mysqlStats.withValidStore;
    const actual = osCount;
    const missing = expected - actual;

    console.log(`\n📈 Comparison:`);
    console.log(`  Expected (MySQL with valid store): ${expected}`);
    console.log(`  Actual (OpenSearch):              ${actual}`);
    console.log(`  Missing items:                    ${missing}`);

    if (missing > 0) {
      console.log(`\n🔎 Finding missing item IDs...`);
      const missingIds = await this.getMissingItemIds(module.id, module.index);
      console.log(`  Found ${missingIds.length} missing items`);

      if (missingIds.length > 0 && missingIds.length <= 100) {
        const details = await this.getItemDetails(missingIds);
        console.log(`\n  Sample missing items (first 10):`);
        details.slice(0, 10).forEach(item => {
          console.log(`    ID: ${item.id}, Name: ${item.name?.substring(0, 50)}`);
          console.log(`      Status: ${item.status}, Approved: ${item.is_approved}, Visible: ${item.is_visible}`);
          console.log(`      Store: ${item.store_name || 'N/A'} (ID: ${item.store_id}, Status: ${item.store_status})`);
        });
      }
    }

    return {
      module: moduleType,
      mysqlStats,
      osCount,
      expected,
      actual,
      missing,
    };
  }

  async run() {
    await this.init();

    const results = {};
    for (const moduleType of Object.keys(MODULES)) {
      results[moduleType] = await this.diagnoseModule(moduleType);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));

    for (const [moduleType, result] of Object.entries(results)) {
      console.log(`\n${MODULES[moduleType].name}:`);
      console.log(`  Expected: ${result.expected} | Actual: ${result.actual} | Missing: ${result.missing}`);
    }

    await this.mysqlPool.end();
  }
}

// Run
if (require.main === module) {
  const service = new DiagnosticService();
  service.run().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { DiagnosticService };
