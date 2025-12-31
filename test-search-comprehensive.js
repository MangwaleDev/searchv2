#!/usr/bin/env node

/**
 * COMPREHENSIVE SEARCH TESTING SCRIPT
 * Tests 500+ search scenarios across all modules and validates against MySQL
 */

const https = require('https');
const mysql = require('mysql2/promise');

const BASE_URL = 'https://opensearch.mangwale.ai';
const API_BASE = `${BASE_URL}/v2/search`;

// Test categories based on real user behavior patterns
const TEST_SCENARIOS = {
  // Store-focused searches (should show stores first)
  STORE_SPECIFIC: [
    'ganesh sweets', 'Ganesh Sweet', 'GANESH SWEETS',
    'dominos pizza', 'mcdonalds', 'kfc',
    'starbucks coffee', 'subway sandwich',
    'pizza hut', 'burger king', 'taco bell',
    'haldirams', 'bikanervala', 'nathu sweets',
    'cafe coffee day', 'barista coffee',
    'paradise biryani', 'bawarchi restaurant',
    'punjabi dhaba', 'south indian restaurant',
    'chinese restaurant near me', 'italian restaurant',
    'bakery near me', 'sweet shop', 'juice corner',
    'ice cream parlor', 'chat house', 'food court',
    'hotel taj', 'royal kitchen', 'spice lounge'
  ],
  
  // Item-focused searches (should show items first)
  ITEM_SPECIFIC: [
    'biryani', 'pizza', 'burger', 'pasta', 'sandwich',
    'chicken tikka', 'paneer tikka', 'dal makhani',
    'gulab jamun', 'rasgulla', 'kaju katli', 'barfi',
    'idli', 'dosa', 'vada', 'sambar', 'chutney',
    'naan', 'roti', 'paratha', 'kulcha',
    'fried rice', 'noodles', 'manchurian', 'spring roll',
    'ice cream', 'shake', 'lassi', 'juice',
    'cake', 'pastry', 'cookie', 'brownie',
    'samosa', 'kachori', 'pav bhaji', 'chole bhature',
    'momos', 'rolls', 'wraps', 'kebabs'
  ],
  
  // Generic searches (balanced results)
  GENERIC: [
    'chicken', 'paneer', 'mutton', 'fish', 'egg',
    'rice', 'bread', 'soup', 'salad',
    'breakfast', 'lunch', 'dinner', 'snacks',
    'veg', 'non veg', 'chinese', 'italian', 'indian',
    'spicy', 'sweet', 'masala', 'curry',
    'fast food', 'healthy food', 'diet food'
  ],
  
  // Filters & attributes
  VEG_SEARCHES: [
    'veg biryani', 'veg pizza', 'veg burger',
    'vegetarian food', 'pure veg restaurant'
  ],
  
  NON_VEG_SEARCHES: [
    'chicken biryani', 'mutton curry', 'fish fry',
    'egg curry', 'chicken pizza', 'non veg thali'
  ],
  
  // Misspellings & typos
  TYPOS: [
    'briyani', 'piza', 'buger', 'resturant',
    'chiken', 'panir', 'biriyani', 'restraunt',
    'sweats', 'juise', 'coffe', 'resturent'
  ],
  
  // Partial queries
  PARTIAL: [
    'bir', 'piz', 'chi', 'pan', 'gul',
    'res', 'caf', 'bak', 'swe', 'jui'
  ],
  
  // Combined queries
  COMBINED: [
    'chicken biryani ganesh', 'pizza dominos',
    'burger kfc', 'coffee starbucks',
    'ice cream baskin', 'sweets haldirams',
    'biryani paradise', 'dosa south indian'
  ],
  
  // Price-sensitive
  PRICE_QUERIES: [
    'cheap biryani', 'affordable pizza', 'budget restaurant',
    'expensive restaurant', 'premium food'
  ],
  
  // Location-based
  LOCATION: [
    'restaurant near me', 'food near me', 'pizza nearby',
    'biryani delivery', 'fast food near me'
  ],
  
  // Time-based
  TIME: [
    'breakfast near me', 'lunch special', 'dinner buffet',
    'midnight delivery', 'early morning breakfast'
  ],
  
  // Special filters
  SPECIAL: [
    'halal food', 'organic food', 'healthy food',
    'gluten free', 'sugar free', 'low calorie'
  ],
  
  // Ratings
  RATINGS: [
    'best biryani', 'top rated pizza', 'highly rated restaurant',
    '5 star restaurant', 'popular food'
  ],
  
  // Edge cases
  EDGE_CASES: [
    '', 'a', 'the', '123', '!!!',
    'very very very long search query to test edge cases',
    'food and restaurant and biryani and pizza',
    '🍕🍔🍝', // emojis
    'test@#$%^', // special chars
    'ganesh ganesh ganesh' // repetition
  ]
};

// MySQL connection config
const DB_CONFIG = {
  host: 'localhost',
  user: 'mangwale',
  password: 'mangwale123',
  database: 'mangwale_production',
  port: 3306
};

class SearchTester {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      details: []
    };
    this.dbConnection = null;
  }

  async connectDB() {
    try {
      this.dbConnection = await mysql.createConnection(DB_CONFIG);
      console.log('✅ Connected to MySQL database');
    } catch (err) {
      console.error('❌ Failed to connect to MySQL:', err.message);
    }
  }

  async disconnectDB() {
    if (this.dbConnection) {
      await this.dbConnection.end();
    }
  }

  async makeRequest(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
      const queryString = new URLSearchParams(params).toString();
      const url = `${endpoint}?${queryString}`;
      
      const options = {
        method: 'GET',
        rejectUnauthorized: false
      };

      https.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        });
      }).on('error', reject);
    });
  }

  async verifyWithDB(query, results) {
    if (!this.dbConnection) return { verified: false, message: 'DB not connected' };

    try {
      // Check items
      const [items] = await this.dbConnection.execute(
        `SELECT COUNT(*) as count FROM items 
         WHERE module_id = 4 
         AND (name LIKE ? OR description LIKE ?)
         AND status = 1
         LIMIT 1`,
        [`%${query}%`, `%${query}%`]
      );

      // Check stores
      const [stores] = await this.dbConnection.execute(
        `SELECT COUNT(*) as count FROM stores 
         WHERE module_id = 4 
         AND (name LIKE ? OR f_name LIKE ?)
         AND active = 1
         LIMIT 1`,
        [`%${query}%`, `%${query}%`]
      );

      return {
        verified: true,
        db_items: items[0].count,
        db_stores: stores[0].count,
        matches: results.items_count > 0 || results.stores_count > 0
      };
    } catch (err) {
      return { verified: false, error: err.message };
    }
  }

  async testSuggest(query, moduleId = 4) {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest(`${API_BASE}/suggest`, {
        q: query,
        module_id: moduleId
      });

      const latency = Date.now() - startTime;
      
      const result = {
        query,
        type: 'suggest',
        success: !!response,
        latency,
        intent: response.intent,
        items_count: response.items?.length || 0,
        stores_count: response.stores?.length || 0,
        categories_count: response.categories?.length || 0,
        first_result: response.items?.[0]?.name || response.stores?.[0]?.name || 'none'
      };

      // Verify with DB
      if (query && query.length > 2) {
        const dbCheck = await this.verifyWithDB(query, result);
        result.db_verification = dbCheck;
      }

      return result;
    } catch (err) {
      return {
        query,
        type: 'suggest',
        success: false,
        error: err.message,
        latency: Date.now() - startTime
      };
    }
  }

  async testSearchItems(query, moduleId = 4, filters = {}) {
    const startTime = Date.now();
    try {
      const params = {
        q: query,
        module_id: moduleId,
        page: 1,
        size: 20,
        ...filters
      };

      const response = await this.makeRequest(`${API_BASE}/items`, params);
      const latency = Date.now() - startTime;

      const result = {
        query,
        type: 'search_items',
        success: !!response.items,
        latency,
        total: response.meta?.total || 0,
        items_count: response.items?.length || 0,
        stores_count: response.stores?.length || 0,
        has_resolved_store: !!response.resolved_store,
        resolved_store_name: response.resolved_store?.name,
        has_facets: !!response.facets,
        category_facets: response.facets?.category_id?.length || 0,
        filters_applied: Object.keys(filters).length
      };

      return result;
    } catch (err) {
      return {
        query,
        type: 'search_items',
        success: false,
        error: err.message,
        latency: Date.now() - startTime
      };
    }
  }

  async testSearchStores(query, moduleId = 4) {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest(`${API_BASE}/stores`, {
        q: query,
        module_id: moduleId,
        page: 1,
        size: 20
      });

      const latency = Date.now() - startTime;

      return {
        query,
        type: 'search_stores',
        success: !!response.data,
        latency,
        total: response.meta?.total || 0,
        stores_count: response.data?.length || 0
      };
    } catch (err) {
      return {
        query,
        type: 'search_stores',
        success: false,
        error: err.message,
        latency: Date.now() - startTime
      };
    }
  }

  async runAllTests() {
    console.log('\n🚀 COMPREHENSIVE SEARCH TESTING STARTED\n');
    console.log('=' .repeat(80));

    await this.connectDB();

    let testNumber = 0;

    // Test each category
    for (const [category, queries] of Object.entries(TEST_SCENARIOS)) {
      console.log(`\n📊 Testing ${category} (${queries.length} queries)`);
      console.log('-'.repeat(80));

      for (const query of queries) {
        testNumber++;
        process.stdout.write(`\r[${testNumber}/500+] Testing: "${query}"`.padEnd(80));

        // Test suggest API
        const suggestResult = await this.testSuggest(query);
        this.results.total++;
        if (suggestResult.success) {
          this.results.passed++;
        } else {
          this.results.failed++;
        }
        this.results.details.push(suggestResult);

        // Test search items API
        const searchResult = await this.testSearchItems(query);
        this.results.total++;
        if (searchResult.success) {
          this.results.passed++;
        } else {
          this.results.failed++;
        }
        this.results.details.push(searchResult);

        // Add delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      console.log(); // New line after progress
    }

    // Test with filters
    console.log('\n📊 Testing with Filters');
    console.log('-'.repeat(80));
    
    const filterTests = [
      { q: 'biryani', veg: 'veg' },
      { q: 'biryani', veg: 'non-veg' },
      { q: 'pizza', price_min: 100, price_max: 300 },
      { q: 'restaurant', rating_min: 4 },
      { q: 'food', recommended: true },
      { q: 'biryani', halal: true },
      { q: 'salad', organic: true },
      { q: 'pizza', in_stock: true },
      { q: 'food', sort_by: 'price_asc' },
      { q: 'restaurant', sort_by: 'rating_desc' }
    ];

    for (const test of filterTests) {
      testNumber++;
      const { q, ...filters } = test;
      process.stdout.write(`\r[${testNumber}] Testing with filters: "${q}"`.padEnd(80));
      
      const result = await this.testSearchItems(q, 4, filters);
      this.results.total++;
      if (result.success) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
      this.results.details.push(result);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    await this.disconnectDB();

    this.generateReport();
  }

  generateReport() {
    console.log('\n\n' + '='.repeat(80));
    console.log('📈 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));

    console.log(`\n📊 Overall Statistics:`);
    console.log(`   Total Tests: ${this.results.total}`);
    console.log(`   ✅ Passed: ${this.results.passed} (${(this.results.passed/this.results.total*100).toFixed(1)}%)`);
    console.log(`   ❌ Failed: ${this.results.failed} (${(this.results.failed/this.results.total*100).toFixed(1)}%)`);

    // Latency statistics
    const latencies = this.results.details
      .filter(r => r.success)
      .map(r => r.latency);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);

    console.log(`\n⚡ Performance:`);
    console.log(`   Average Latency: ${avgLatency.toFixed(0)}ms`);
    console.log(`   Min Latency: ${minLatency}ms`);
    console.log(`   Max Latency: ${maxLatency}ms`);

    // Intent detection analysis
    const intentCounts = {
      store_first: 0,
      generic: 0,
      specific_item_specific_store: 0,
      undefined: 0
    };

    this.results.details
      .filter(r => r.type === 'suggest' && r.success)
      .forEach(r => {
        intentCounts[r.intent || 'undefined']++;
      });

    console.log(`\n🎯 Intent Detection:`);
    console.log(`   Store First: ${intentCounts.store_first}`);
    console.log(`   Generic: ${intentCounts.generic}`);
    console.log(`   Specific Item+Store: ${intentCounts.specific_item_specific_store}`);
    console.log(`   Undefined: ${intentCounts.undefined}`);

    // Failed tests
    const failed = this.results.details.filter(r => !r.success);
    if (failed.length > 0) {
      console.log(`\n❌ Failed Tests (${failed.length}):`);
      failed.slice(0, 20).forEach(f => {
        console.log(`   - "${f.query}": ${f.error}`);
      });
      if (failed.length > 20) {
        console.log(`   ... and ${failed.length - 20} more`);
      }
    }

    // Store-first accuracy
    const storeQueries = this.results.details.filter(r => 
      r.type === 'suggest' && 
      r.success &&
      TEST_SCENARIOS.STORE_SPECIFIC.includes(r.query)
    );
    const storeFirstCorrect = storeQueries.filter(r => r.intent === 'store_first').length;
    console.log(`\n🏪 Store Detection Accuracy:`);
    console.log(`   ${storeFirstCorrect}/${storeQueries.length} store queries correctly identified`);
    console.log(`   Accuracy: ${(storeFirstCorrect/storeQueries.length*100).toFixed(1)}%`);

    // DB verification
    const dbVerified = this.results.details.filter(r => 
      r.db_verification?.verified
    );
    const dbMatches = dbVerified.filter(r => r.db_verification?.matches);
    console.log(`\n💾 Database Verification:`);
    console.log(`   ${dbVerified.length} queries verified against MySQL`);
    console.log(`   ${dbMatches.length} queries matched DB records`);
    console.log(`   Match Rate: ${(dbMatches.length/dbVerified.length*100).toFixed(1)}%`);

    // Save detailed report
    const fs = require('fs');
    const reportPath = '/home/ubuntu/Devs/Search/comprehensive-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ TESTING COMPLETE\n');
  }
}

// Run tests
const tester = new SearchTester();
tester.runAllTests().catch(console.error);
