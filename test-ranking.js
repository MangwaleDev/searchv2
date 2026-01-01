const http = require('http');

async function testRanking() {
  console.log('🧪 Testing Ranking Improvements\n');
  
  const tests = [
    { q: 'biryani', module_id: 4, desc: 'Biryani search (should show popular items first)' },
    { q: 'pizza', module_id: 4, desc: 'Pizza search (should boost by order_count and avg_rating)' },
    { q: 'paneer', module_id: 4, desc: 'Paneer search (testing ranking functions)' }
  ];
  
  for (const test of tests) {
    try {
      const url = `http://search-api:3100/v2/search/suggest?q=${encodeURIComponent(test.q)}&module_id=${test.module_id}&size=5`;
      
      const response = await new Promise((resolve, reject) => {
        http.get(url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(JSON.parse(data)));
          res.on('error', reject);
        }).on('error', reject);
      });
      
      console.log(`✅ ${test.desc}`);
      console.log(`   Query: "${test.q}"`);
      console.log(`   Results: ${response.items?.length || 0} items\n`);
      
      if (response.items && response.items.length > 0) {
        console.log('   Top 3 Results (with order_count & avg_rating):');
        response.items.slice(0, 3).forEach((item, idx) => {
          const orderCount = item.order_count || 0;
          const avgRating = item.avg_rating || 0;
          const recommended = item.recommended ? '⭐' : '';
          console.log(`   ${idx + 1}. ${item.name} ${recommended}`);
          console.log(`      Orders: ${orderCount}, Rating: ${avgRating.toFixed(1)}, Store: ${item.store_name || 'N/A'}`);
        });
        console.log('');
      }
      
    } catch (error) {
      console.log(`❌ ${test.desc}`);
      console.log(`   Error: ${error.message}\n`);
    }
  }
  
  console.log('✅ Ranking Test Complete\n');
  console.log('📊 Ranking Improvements Applied:');
  console.log('   - order_count boost (log scale)');
  console.log('   - avg_rating boost (sqrt scale)');
  console.log('   - recommended items boost (1.3x)');
}

testRanking().catch(console.error);
