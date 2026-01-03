#!/bin/bash
# Stats API Test Commands
# Run these to verify the Stats API is working correctly

echo "========================================"
echo "📊 Stats API Test Commands"
echo "========================================"
echo ""

echo "1. Get System Statistics"
echo "   Returns all stats from OpenSearch and MySQL"
echo ""
echo "   Command:"
echo "   docker exec search-api wget -O- -q \"localhost:3100/stats/system\" | jq '.'"
echo ""

echo "2. Check Health Status"
echo "   Returns health of OpenSearch and MySQL connections"
echo ""
echo "   Command:"
echo "   docker exec search-api wget -O- -q \"localhost:3100/stats/health\" | jq '.'"
echo ""

echo "3. Get Only Item Count"
echo "   Quick check of total items"
echo ""
echo "   Command:"
echo "   docker exec search-api wget -O- -q \"localhost:3100/stats/system\" | jq '.opensearch.items_total'"
echo ""

echo "4. Get Store Count"
echo "   Quick check of total stores"
echo ""
echo "   Command:"
echo "   docker exec search-api wget -O- -q \"localhost:3100/stats/system\" | jq '.opensearch.stores_total'"
echo ""

echo "5. Get Veg/Non-Veg Breakdown"
echo "   See vegetarian vs non-vegetarian distribution"
echo ""
echo "   Command:"
echo "   docker exec search-api wget -O- -q \"localhost:3100/stats/system\" | jq '{veg: .opensearch.items_veg, non_veg: .opensearch.items_non_veg}'"
echo ""

echo "6. Get Performance Metrics"
echo "   See response time and search volume"
echo ""
echo "   Command:"
echo "   docker exec search-api wget -O- -q \"localhost:3100/stats/system\" | jq '.performance'"
echo ""

echo "7. Check if Stats Endpoints are Listed"
echo "   Verify stats endpoints appear in root API response"
echo ""
echo "   Command:"
echo "   docker exec search-api wget -O- -q \"localhost:3100/\" | jq '.endpoints | {stats, statsHealth}'"
echo ""

echo "8. Get Full Response Pretty-Printed"
echo "   Complete stats in readable format"
echo ""
echo "   Command:"
echo "   docker exec search-api wget -O- -q \"localhost:3100/stats/system\" 2>/dev/null | jq ."
echo ""

echo "========================================"
echo "💡 Integration Examples"
echo "========================================"
echo ""

echo "JavaScript/Frontend:"
echo "-------------------"
cat << 'JSEOF'
async function loadStats() {
  const response = await fetch('http://localhost:3100/stats/system');
  const stats = await response.json();
  
  console.log('Items:', stats.opensearch.items_total);
  console.log('Stores:', stats.opensearch.stores_total);
  console.log('Veg:', stats.opensearch.items_veg);
}
JSEOF
echo ""

echo "cURL from Host:"
echo "---------------"
echo "curl -s http://localhost:3100/stats/system | jq '.'"
echo ""

echo "Python:"
echo "-------"
cat << 'PYEOF'
import requests

response = requests.get('http://localhost:3100/stats/system')
stats = response.json()

print(f"Items: {stats['opensearch']['items_total']}")
print(f"Stores: {stats['opensearch']['stores_total']}")
PYEOF
echo ""

echo "========================================"
echo "📁 View Dashboard"
echo "========================================"
echo ""
echo "Option 1: Open HTML file directly"
echo "  file:///home/ubuntu/Devs/Search/admin-dashboard.html"
echo ""
echo "Option 2: Serve with Python HTTP server"
echo "  cd /home/ubuntu/Devs/Search"
echo "  python3 -m http.server 8888"
echo "  Then open: http://localhost:8888/admin-dashboard.html"
echo ""

echo "========================================"
echo "✅ Environment Variables Used"
echo "========================================"
echo ""
echo "All configuration from .env file:"
echo "  • OPENSEARCH_HOST"
echo "  • OPENSEARCH_USERNAME"
echo "  • OPENSEARCH_PASSWORD"
echo "  • MYSQL_HOST"
echo "  • MYSQL_PORT"
echo "  • MYSQL_USER"
echo "  • MYSQL_PASSWORD"
echo "  • MYSQL_DATABASE"
echo "  • CLICKHOUSE_URL"
echo ""
echo "NO HARDCODED VALUES!"
echo ""
