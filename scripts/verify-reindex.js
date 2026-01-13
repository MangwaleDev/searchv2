#!/usr/bin/env node
/**
 * Verify Reindexing Results
 * 
 * This script verifies that the reindexing was successful by checking:
 * - Item counts in MySQL vs OpenSearch
 * - Category mappings are correct
 * - Store mappings are correct
 * - Price calculations are correct
 * - Sample data integrity
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { Client } = require('@opensearch-project/opensearch');

async function main() {
  // Initialize MySQL
  const mysqlPool = await mysql.createPool({
    host: process.env.MYSQL_HOST || 'dashboard_mangwale_mysql',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root_password',
    database: process.env.MYSQL_DATABASE || 'mangwale_db',
    decimalNumbers: true,
  });

  // Initialize OpenSearch
  const osClient = new Client({
    node: process.env.OPENSEARCH_HOST || 'http://search-opensearch:9200',
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n' + '='.repeat(80));
  console.log('REINDEXING VERIFICATION REPORT');
  console.log('='.repeat(80) + '\n');

  // Check Food module
  console.log('📊 FOOD MODULE (module_id: 4)\n');
  
  const [foodItems] = await mysqlPool.query(
    'SELECT COUNT(*) as total FROM items WHERE module_id = 4 AND status = 1 AND is_approved = 1'
  );
  
  const osFood = await osClient.count({ index: 'food_items_v4' });
  
  console.log(`MySQL Items (active, approved): ${foodItems[0].total}`);
  console.log(`OpenSearch Items:               ${osFood.body.count}`);
  console.log(`Match: ${foodItems[0].total === osFood.body.count ? '✅ YES' : '❌ NO'}\n`);

  // Check sample item
  const [sampleItem] = await mysqlPool.query(
    `SELECT i.id, i.name, i.category_id, i.category_ids, i.store_id, i.price, i.discount, i.discount_type,
            c.name as category_name, s.name as store_name
     FROM items i
     LEFT JOIN categories c ON i.category_id = c.id
     LEFT JOIN stores s ON i.store_id = s.id
     WHERE i.module_id = 4 AND i.status = 1 AND i.is_approved = 1
     ORDER BY i.id ASC
     LIMIT 1`
  );

  if (sampleItem.length > 0) {
    const item = sampleItem[0];
    console.log('🔍 Sample Item Verification:\n');
    console.log(`Item ID: ${item.id}`);
    console.log(`Name: ${item.name}`);
    console.log(`Category ID: ${item.category_id}`);
    console.log(`Category IDs JSON: ${item.category_ids}`);
    console.log(`Category Name (MySQL): ${item.category_name}`);
    console.log(`Store ID: ${item.store_id}`);
    console.log(`Store Name (MySQL): ${item.store_name}`);
    console.log(`Price: ${item.price}`);
    console.log(`Discount: ${item.discount} (${item.discount_type})`);
    
    // Calculate expected final price
    let finalPrice = parseFloat(item.price);
    if (item.discount > 0) {
      if (item.discount_type === 'percent') {
        finalPrice = finalPrice - (finalPrice * item.discount / 100);
      } else {
        finalPrice = finalPrice - item.discount;
      }
    }
    console.log(`Expected Final Price: ${finalPrice.toFixed(2)}\n`);

    // Check in OpenSearch
    try {
      const osItem = await osClient.get({
        index: 'food_items_v4',
        id: String(item.id),
      });

      const source = osItem.body._source;
      console.log('OpenSearch Data:');
      console.log(`  Category ID: ${source.category_id}`);
      console.log(`  Category Name: ${source.category_name} ${source.category_name === item.category_name ? '✅' : '❌'}`);
      console.log(`  Category IDs: ${JSON.stringify(source.category_ids)}`);
      console.log(`  Store ID: ${source.store_id}`);
      console.log(`  Store Name: ${source.store_name} ${source.store_name === item.store_name ? '✅' : '❌'}`);
      console.log(`  Price: ${source.price}`);
      console.log(`  Final Price: ${source.final_price} ${Math.abs(source.final_price - finalPrice) < 0.01 ? '✅' : '❌'}`);
      console.log(`  Discount: ${source.discount} (${source.discount_type})`);
      console.log(`  Store Location: ${source.store_location ? JSON.stringify(source.store_location) : 'null'}`);
      console.log(`  Zone ID: ${source.zone_id}\n`);
    } catch (error) {
      console.error(`❌ Item ${item.id} not found in OpenSearch: ${error.message}\n`);
    }
  }

  // Check Ecom module
  console.log('\n📊 ECOM MODULE (module_id: 2)\n');
  
  const [ecomItems] = await mysqlPool.query(
    'SELECT COUNT(*) as total FROM items WHERE module_id = 2 AND status = 1 AND is_approved = 1'
  );
  
  const osEcom = await osClient.count({ index: 'ecom_items_v4' }).catch(() => ({ body: { count: 0 } }));
  
  console.log(`MySQL Items (active, approved): ${ecomItems[0].total}`);
  console.log(`OpenSearch Items:               ${osEcom.body.count}`);
  console.log(`Match: ${ecomItems[0].total === osEcom.body.count ? '✅ YES' : '❌ NO'}\n`);

  // Check stores
  console.log('\n🏪 STORES VERIFICATION\n');
  
  const [foodStores] = await mysqlPool.query(
    'SELECT COUNT(*) as total FROM stores WHERE module_id = 4 AND status = 1'
  );
  const osFoodStores = await osClient.count({ index: 'food_stores_v6' }).catch(() => ({ body: { count: 0 } }));
  
  console.log(`Food Stores (MySQL):      ${foodStores[0].total}`);
  console.log(`Food Stores (OpenSearch): ${osFoodStores.body.count}`);
  console.log(`Match: ${foodStores[0].total === osFoodStores.body.count ? '✅ YES' : '❌ NO'}\n`);

  // Check categories
  console.log('\n📁 CATEGORIES VERIFICATION\n');
  
  const [foodCats] = await mysqlPool.query(
    'SELECT COUNT(*) as total FROM categories WHERE module_id = 4 AND status = 1'
  );
  const osFoodCats = await osClient.count({ index: 'food_categories' }).catch(() => ({ body: { count: 0 } }));
  
  console.log(`Food Categories (MySQL):      ${foodCats[0].total}`);
  console.log(`Food Categories (OpenSearch): ${osFoodCats.body.count}`);
  console.log(`Match: ${foodCats[0].total === osFoodCats.body.count ? '✅ YES' : '❌ NO'}\n`);

  // Check for orphaned items (items without valid stores)
  console.log('\n🔍 ORPHANED ITEMS CHECK\n');
  
  const [orphanedItems] = await mysqlPool.query(
    `SELECT COUNT(*) as total 
     FROM items i 
     LEFT JOIN stores s ON i.store_id = s.id 
     WHERE i.module_id = 4 
       AND i.status = 1 
       AND i.is_approved = 1
       AND (s.id IS NULL OR s.status = 0)`
  );
  
  console.log(`Items with missing/inactive stores: ${orphanedItems[0].total}`);
  if (orphanedItems[0].total > 0) {
    console.log('⚠️  Warning: These items will be excluded from indexing\n');
  } else {
    console.log('✅ All items have valid stores\n');
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80) + '\n');
  
  const allMatch = 
    foodItems[0].total === osFood.body.count &&
    ecomItems[0].total === osEcom.body.count &&
    foodStores[0].total === osFoodStores.body.count &&
    foodCats[0].total === osFoodCats.body.count;
  
  if (allMatch) {
    console.log('✅ All counts match! Reindexing successful.\n');
  } else {
    console.log('❌ Some counts do not match. Please review the report above.\n');
  }

  await mysqlPool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
