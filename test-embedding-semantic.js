#!/usr/bin/env node

const http = require('http');

async function testEmbedding(text, model = 'food') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ text, model });
    const options = {
      hostname: 'search-embedding-service',
      port: 3101,
      path: '/embed',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testSuggestion(query) {
  return new Promise((resolve, reject) => {
    const url = `http://search-api:3100/v2/search/suggest?q=${encodeURIComponent(query)}&module_id=4`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('🧪 Testing Embedding Service & Semantic Suggestion API\n');
  console.log('=' .repeat(70));
  
  // Test embedding service
  console.log('\n1️⃣ Testing Embedding Service:');
  try {
    const embResult = await testEmbedding('biryani', 'food');
    console.log('   ✅ Embedding generated');
    console.log('   📊 Vector length:', embResult.embedding?.length || 0);
    console.log('   🔢 First 5 values:', embResult.embedding?.slice(0, 5));
  } catch (err) {
    console.log('   ❌ Error:', err.message);
  }
  
  // Test suggestion API with various queries
  console.log('\n2️⃣ Testing Enhanced Suggestion API:\n');
  
  const testCases = [
    { name: 'Exact match', query: 'biryani', expectedItems: '>0' },
    { name: 'Typo (biriyani)', query: 'biriyani', expectedItems: '>0' },
    { name: 'Typo (briyani)', query: 'briyani', expectedItems: '>0' },
    { name: 'Partial (bir)', query: 'bir', expectedItems: '>0' },
    { name: 'Synonym (rice)', query: 'rice', expectedItems: '>0' },
    { name: 'Misspell (panir)', query: 'panir', expectedItems: '>0' }
  ];
  
  for (const test of testCases) {
    try {
      const result = await testSuggestion(test.query);
      const itemCount = result.items?.length || 0;
      const storeCount = result.stores?.length || 0;
      const hasResults = itemCount > 0 || storeCount > 0;
      
      console.log(`   ${hasResults ? '✅' : '⚠️ '} ${test.name.padEnd(20)} -> Items: ${itemCount}, Stores: ${storeCount}`);
      
      if (itemCount > 0) {
        const firstItem = result.items[0];
        console.log(`      First result: "${firstItem.name}"`);
      }
    } catch (err) {
      console.log(`   ❌ ${test.name}: ${err.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Testing Complete\n');
})();
