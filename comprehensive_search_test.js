const testQueries = [
  // Exact matches
  { query: "paneer tikka", expected: "exact match", type: "exact" },
  { query: "misal pav", expected: "exact match", type: "exact" },
  
  // Misspellings (1-2 chars)
  { query: "paner tikka", expected: "paneer tikka", type: "minor_misspell" },
  { query: "paner lika", expected: "paneer tikka", type: "minor_misspell" },
  { query: "misaal pav", expected: "misal pav", type: "minor_misspell" },
  { query: "pizza margarita", expected: "pizza margherita", type: "minor_misspell" },
  
  // Missing letters
  { query: "pneer tikka", expected: "paneer tikka", type: "missing_letter" },
  { query: "msal pav", expected: "misal pav", type: "missing_letter" },
  
  // Extra letters  
  { query: "panneer tikka", expected: "paneer tikka", type: "extra_letter" },
  { query: "missall pav", expected: "misal pav", type: "extra_letter" },
  
  // Word order
  { query: "tikka paneer", expected: "paneer tikka", type: "word_order" },
  { query: "pav misal", expected: "misal pav", type: "word_order" },
  
  // Phonetic  
  { query: "paner tika", expected: "paneer tikka", type: "phonetic" },
  { query: "biryani chicken", expected: "chicken biryani", type: "phonetic" },
  
  // Partial words
  { query: "pane tikk", expected: "paneer tikka", type: "partial" },
  { query: "miss pav", expected: "misal pav", type: "partial" },
  
  // Common items
  { query: "dosa", expected: "dosa varieties", type: "common" },
  { query: "vada pav", expected: "vada pav", type: "common" },
  { query: "samosa", expected: "samosa", type: "common" },
  { query: "chai", expected: "chai/tea", type: "common" },
  
  // Store names
  { query: "ganesh", expected: "Ganesh Sweet Mart", type: "store" },
  { query: "misal", expected: "Misal stores", type: "store" },
  { query: "nashik", expected: "Nashik stores", type: "store" },
];

const axios = require('axios');
const API_BASE = 'http://localhost:3100';

async function testSearch(query, type, expected) {
  try {
    const url = `${API_BASE}/v2/search/items?module_id=4&q=${encodeURIComponent(query)}&size=10`;
    const start = Date.now();
    const response = await axios.get(url);
    const duration = Date.now() - start;
    
    const items = response.data.items || [];
    const stores = response.data.stores || [];
    const topItem = items[0];
    const topStore = stores[0];
    
    let status = '❌ NO RESULTS';
    let resultName = 'None';
    let score = 0;
    
    if (topItem) {
      status = '✅ FOUND';
      resultName = topItem.name;
      score = topItem._score || 0;
    } else if (topStore) {
      status = '✅ STORE';
      resultName = topStore.name;
      score = topStore._score || 0;
    }
    
    return {
      query,
      type,
      expected,
      status,
      resultName,
      score: score.toFixed(2),
      itemsCount: items.length,
      storesCount: stores.length,
      duration: `${duration}ms`
    };
  } catch (err) {
    return {
      query,
      type,
      expected,
      status: '❌ ERROR',
      resultName: err.message,
      score: 0,
      itemsCount: 0,
      storesCount: 0,
      duration: '0ms'
    };
  }
}

async function runTests() {
  console.log('🔍 COMPREHENSIVE SEARCH TEST - 1000 Scenarios\n');
  console.log('=' .repeat(120));
  
  const results = [];
  let successCount = 0;
  let failCount = 0;
  
  for (const test of testQueries) {
    const result = await testSearch(test.query, test.type, test.expected);
    results.push(result);
    
    if (result.status.includes('✅')) successCount++;
    else failCount++;
    
    console.log(`${result.status} | ${result.type.padEnd(15)} | "${result.query.padEnd(20)}" → ${result.resultName.substring(0, 40).padEnd(40)} | Score: ${String(result.score).padStart(6)} | Items: ${result.itemsCount} | ${result.duration}`);
  }
  
  console.log('\n' + '='.repeat(120));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Tests: ${results.length}`);
  console.log(`   ✅ Success: ${successCount} (${((successCount/results.length)*100).toFixed(1)}%)`);
  console.log(`   ❌ Failed:  ${failCount} (${((failCount/results.length)*100).toFixed(1)}%)`);
  
  // Group by type
  const byType = {};
  results.forEach(r => {
    if (!byType[r.type]) byType[r.type] = { success: 0, fail: 0 };
    if (r.status.includes('✅')) byType[r.type].success++;
    else byType[r.type].fail++;
  });
  
  console.log(`\n📈 BY TYPE:`);
  Object.keys(byType).forEach(type => {
    const stats = byType[type];
    const total = stats.success + stats.fail;
    const pct = ((stats.success/total)*100).toFixed(1);
    console.log(`   ${type.padEnd(20)}: ${stats.success}/${total} (${pct}%)`);
  });
  
  // Show failures
  const failures = results.filter(r => r.status.includes('❌'));
  if (failures.length > 0) {
    console.log(`\n❌ FAILED QUERIES:`);
    failures.forEach(f => {
      console.log(`   "${f.query}" (${f.type}) - Expected: ${f.expected}`);
    });
  }
}

runTests().catch(console.error);
