#!/bin/bash
# Comprehensive Search Testing Script
# Tests various search patterns to validate store/item detection

API_URL="http://localhost:3100"
echo "🧪 Testing Mangwale Search System"
echo "=================================="
echo ""

# Test 1: Store name search
echo "1️⃣ Store Name Detection:"
echo "Query: 'ganesh sweets'"
curl -s "${API_URL}/v2/search/items?q=ganesh%20sweets&size=1" | jq -c '{intent: "store_first", resolved: (.resolved_store != null), store: .resolved_store.name, items: (.items | length)}'
echo ""

# Test 2: Single word store
echo "2️⃣ Single Word Store:"
echo "Query: 'ganesh'"
curl -s "${API_URL}/v2/search/items?q=ganesh&size=1" | jq -c '{intent: "store_first", resolved: (.resolved_store != null), store: .resolved_store.name}'
echo ""

# Test 3: Generic item search
echo "3️⃣ Generic Item Search:"
echo "Query: 'paneer'"
curl -s "${API_URL}/v2/search/items?q=paneer&size=2" | jq -c '{intent: "generic", resolved: (.resolved_store != null), items: [.items[].name]}'
echo ""

# Test 4: Specific item from store
echo "4️⃣ Specific Item from Store:"
echo "Query: 'paneer from ganesh'"
curl -s "${API_URL}/v2/search/items?q=paneer%20from%20ganesh&size=2" | jq -c '{intent: "specific_item_specific_store", store_filter: .filters.store_id, items: [.items[].name]}'
echo ""

# Test 5: Store with keyword
echo "5️⃣ Store with Keyword:"
echo "Query: 'sweet shop'"
curl -s "${API_URL}/v2/search/items?q=sweet%20shop&size=1" | jq -c '{intent: "store_first", resolved: (.resolved_store != null), query: .q}'
echo ""

# Test 6: Title Case Detection
echo "6️⃣ Title Case (Brand Name):"
echo "Query: 'Bhagat Tarachand'"
curl -s "${API_URL}/v2/search/items?q=Bhagat%20Tarachand&size=1" | jq -c '{intent: "store_first", resolved: (.resolved_store != null), store: .resolved_store.name}'
echo ""

# Test 7: Long descriptive query
echo "7️⃣ Long Descriptive Query:"
echo "Query: 'spicy chicken biryani with raita'"
curl -s "${API_URL}/v2/search/items?q=spicy%20chicken%20biryani%20with%20raita&size=1" | jq -c '{intent: "generic", items: [.items[].name]}'
echo ""

# Test 8: Store menu query
echo "8️⃣ Store Menu Query:"
echo "Query: 'ganesh restaurant menu'"
curl -s "${API_URL}/v2/search/items?q=ganesh%20restaurant%20menu&size=1" | jq -c '{intent: "store_first", resolved: (.resolved_store != null), store: .resolved_store.name}'
echo ""

# Test 9: Image URL validation
echo "9️⃣ Image URL Check:"
echo "Query: 'paneer' (checking image URLs)"
curl -s "${API_URL}/v2/search/items?q=paneer&size=1" | jq -c '{item: .items[0].name, has_image: (.items[0].image != null), full_url: .items[0].image_full_url, fallback: .items[0].image_fallback_url}'
echo ""

# Test 10: Store image URL
echo "🔟 Store Image URL:"
echo "Query: 'ganesh' (checking store logo)"
curl -s "${API_URL}/v2/search/items?q=ganesh&size=1" | jq -c '{store: .resolved_store.name, logo: .resolved_store.logo, full_url: .resolved_store.logo_full_url}'
echo ""

# Test 11: Semantic search capability
echo "1️⃣1️⃣ Semantic Similarity:"
echo "Query: 'biryani' vs embedding check"
curl -s "${API_URL}/v2/search/items?q=biryani&size=2" | jq -c '{items: [.items[].name], relevance: "should show rice/biryani items"}'
echo ""

# Test 12: Filter combination
echo "1️⃣2️⃣ Store + Filter:"
echo "Query: 'ganesh' with veg filter"
curl -s "${API_URL}/v2/search/items?q=ganesh&veg=1&size=2" | jq -c '{resolved: (.resolved_store != null), filters: {store: .filters.store_id, veg: .filters.veg}, items: [.items[].name]}'
echo ""

echo "=================================="
echo "✅ Testing Complete!"
echo ""
echo "📊 Summary:"
echo "- Store name detection should trigger 'store_first' intent"
echo "- Generic item searches return items from multiple stores"
echo "- 'from' pattern should scope items to specific store"
echo "- Images should have both full_url and fallback_url"
echo "- Resolved stores should display prominently in frontend"
