# API Filter Reference & Test URLs

Quick reference guide for all available filters and test endpoints.

---

## 📦 STORES API

**Base URL:** `https://opensearch.mangwale.ai/v2/search/stores`

### Core Parameters
- `module_id` (required): Module identifier (use `4` for food)
- `page`: Page number (default: 1)
- `size`: Results per page (default: 10, max: 100)

### Filters

| Filter | Values | Description | Example |
|--------|--------|-------------|---------|
| `veg` | `1`, `0`, `pure_veg` | Vegetarian filter | `veg=1` (all veg), `veg=pure_veg` (pure veg only) |
| `open_now` | `1`, `0` | Currently open restaurants | `open_now=1` |
| `rating_min` | `1-5` | Minimum rating | `rating_min=4` |
| `q` | string | Search query | `q=pizza` |
| `sort` | `rating`, `popularity`, `distance` | Sort order | `sort=rating` |
| `store_id` | number | Specific store ID | `store_id=15` |

### Test URLs

```bash
# All veg restaurants
curl "https://opensearch.mangwale.ai/v2/search/stores?module_id=4&veg=1"

# Pure veg only (excludes mixed)
curl "https://opensearch.mangwale.ai/v2/search/stores?module_id=4&veg=pure_veg"

# Open now with 4+ rating
curl "https://opensearch.mangwale.ai/v2/search/stores?module_id=4&open_now=1&rating_min=4"

# Search "restaurant" in pure veg only
curl "https://opensearch.mangwale.ai/v2/search/stores?module_id=4&veg=pure_veg&q=restaurant"

# Specific store
curl "https://opensearch.mangwale.ai/v2/search/stores?module_id=4&store_id=15"
```

---

## 🍔 ITEMS API

**Base URL:** `https://opensearch.mangwale.ai/v2/search/items`

### Core Parameters
- `module_id` (required): Module identifier (use `4` for food)
- `q`: Search query
- `page`: Page number (default: 1)
- `size`: Results per page (default: 10, max: 100)

### Filters

| Filter | Values | Description | Example |
|--------|--------|-------------|---------|
| `veg` | `1`, `0` | Vegetarian filter | `veg=1` (veg only) |
| `price_min` | number | Minimum price | `price_min=100` |
| `price_max` | number | Maximum price | `price_max=300` |
| `sort` | `price_asc`, `price_desc`, `rating` | Sort order | `sort=price_asc` |
| `store_id` | number | Items from specific store | `store_id=15` |
| `category_id` | number | Category filter | `category_id=1` |
| `recommended` | `1`, `0` | Recommended items | `recommended=1` |
| `in_stock` | `1`, `0` | Available items only | `in_stock=1` |
| `semantic` | `1`, `0` | Semantic search | `semantic=1` |

### Test URLs

```bash
# Search pizza (veg only)
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&q=pizza&veg=1"

# Cheap veg pizza (under ₹250)
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&q=pizza&veg=1&price_max=250&sort=price_asc"

# Chicken items with price range
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&q=chicken&price_min=100&price_max=300"

# Biryani from specific store
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&q=biryani&store_id=15"

# Recommended items in stock
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&q=pizza&recommended=1&in_stock=1"

# Semantic search
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&q=spicy+indian+food&semantic=1"
```

---

## 💡 SUGGEST API

**Base URL:** `https://opensearch.mangwale.ai/v2/search/suggest`

### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `module_id` (required) | Module identifier | `module_id=4` |
| `q` (required) | Search query | `q=pizza` |
| `size` | Max results per category | `size=5` |

### Intent Types

| Intent | Description | Example Queries |
|--------|-------------|----------------|
| `store_first` | Brand/store search | "ganesh sww", "restaurant", "cafe", "sweets" |
| `generic` | Item search | "pizza", "biryani", "chicken" |
| `specific_item_specific_store` | Item from store | "pizza from dominos" |

### Test URLs

```bash
# Store search (incomplete typing)
curl "https://opensearch.mangwale.ai/v2/search/suggest?module_id=4&q=ganesh+sww"
# Returns: intent="store_first", stores shown first

# Generic item search
curl "https://opensearch.mangwale.ai/v2/search/suggest?module_id=4&q=pizza"
# Returns: intent="generic", items shown first

# Restaurant keyword
curl "https://opensearch.mangwale.ai/v2/search/suggest?module_id=4&q=restaurant"
# Returns: intent="store_first", stores shown first

# Partial store name
curl "https://opensearch.mangwale.ai/v2/search/suggest?module_id=4&q=sadhana+mis"
# Returns: intent="store_first", stores shown first
```

---

## 🧪 FILTER COMBINATIONS (Tested & Working)

### Stores API Combinations

```bash
# Veg + Open Now
curl "https://opensearch.mangwale.ai/v2/search/stores?module_id=4&veg=1&open_now=1"

# Pure Veg + High Rating
curl "https://opensearch.mangwale.ai/v2/search/stores?module_id=4&veg=pure_veg&rating_min=4"

# Veg + Open Now + Rating + Sort
curl "https://opensearch.mangwale.ai/v2/search/stores?module_id=4&veg=1&open_now=1&rating_min=3&sort=rating"

# Search + Pure Veg
curl "https://opensearch.mangwale.ai/v2/search/stores?module_id=4&q=restaurant&veg=pure_veg"

# Non-veg + High Rating + Sort
curl "https://opensearch.mangwale.ai/v2/search/stores?module_id=4&veg=0&rating_min=4&sort=rating"
```

### Items API Combinations

```bash
# Veg + Price + Recommended
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&q=pizza&veg=1&price_max=300&recommended=1"

# Non-veg + Price Range + Sort
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&q=chicken&veg=0&price_min=150&price_max=400&sort=price_asc"

# Store + Category + In Stock
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&store_id=15&category_id=1&in_stock=1"

# Search + Veg + Price + Sort
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&q=pizza&veg=1&price_max=250&sort=price_asc"
```

---

## 📊 FILTER VALUES SUMMARY

### Veg Filter Values
- `veg=1` → **100 restaurants** (all veg including mixed)
- `veg=0` → **72 restaurants** (non-veg)
- `veg=pure_veg` → **29 restaurants** (pure veg only, excludes mixed)

### Sort Options
**Stores:**
- `sort=rating` - Highest rated first
- `sort=popularity` - Most popular first
- `sort=distance` - Nearest first

**Items:**
- `sort=price_asc` - Cheapest first
- `sort=price_desc` - Most expensive first
- `sort=rating` - Highest rated first

---

## 🎯 REAL-WORLD SCENARIOS

### Scenario 1: Find Cheap Veg Pizza
```bash
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&q=pizza&veg=1&price_max=250&sort=price_asc"
```

### Scenario 2: High-Rated Pure Veg Open Now
```bash
curl "https://opensearch.mangwale.ai/v2/search/stores?module_id=4&veg=pure_veg&open_now=1&rating_min=4&sort=rating"
```

### Scenario 3: Premium Non-Veg Items
```bash
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&veg=0&price_min=500&sort=price_desc"
```

### Scenario 4: Biryani from Specific Store
```bash
curl "https://opensearch.mangwale.ai/v2/search/items?module_id=4&q=biryani&store_id=15"
```

### Scenario 5: Incomplete Store Name Typing
```bash
# Progressive typing
curl "https://opensearch.mangwale.ai/v2/search/suggest?module_id=4&q=ganesh+sw"
curl "https://opensearch.mangwale.ai/v2/search/suggest?module_id=4&q=ganesh+sww"
curl "https://opensearch.mangwale.ai/v2/search/suggest?module_id=4&q=ganesh+sweet"
```

---

## 🔍 INTENT DETECTION PATTERNS

The suggest API automatically detects intent based on query patterns:

### Store-First Intent
**Triggers:**
- Known brands: "dominos", "kfc", "mcdonald"
- Store keywords: "restaurant", "cafe", "sweets", "mart"
- Proper names with store hints: "Ganesh sww", "Sadhana mis"
- Partial store keywords: "sw" (for sweets), "mar" (for mart)

**Example:**
```bash
curl "https://opensearch.mangwale.ai/v2/search/suggest?module_id=4&q=ganesh+sww"
# Returns: {"intent": "store_first", "stores": [...], "items": [...]}
# Stores shown first in UI
```

### Generic Intent
**Triggers:**
- Generic food items: "pizza", "biryani", "chicken"
- No store-specific keywords

**Example:**
```bash
curl "https://opensearch.mangwale.ai/v2/search/suggest?module_id=4&q=pizza"
# Returns: {"intent": "generic", "stores": [...], "items": [...]}
# Items shown first in UI
```

---

## ✅ TEST CHECKLIST

Use this checklist to verify all features:

### Basic Functionality
- [ ] Stores API returns results
- [ ] Items API returns results
- [ ] Suggest API returns results with intent

### Veg Filters
- [ ] `veg=1` returns all veg restaurants (100)
- [ ] `veg=0` returns non-veg restaurants (72)
- [ ] `veg=pure_veg` returns pure veg only (29)
- [ ] Pure veg excludes mixed restaurants

### Combined Filters
- [ ] Veg + Open Now works
- [ ] Pure Veg + Rating works
- [ ] Search + Veg + Price works
- [ ] Non-veg + Price Range + Sort works

### Intent Detection
- [ ] "ganesh sww" → store_first
- [ ] "ganesh sweet" → store_first
- [ ] "pizza" → generic
- [ ] "restaurant" → store_first

### Search Journey
- [ ] Search "ganesh sweet" shows Ganesh items
- [ ] Then search "pizza" shows pizza items (not Ganesh)
- [ ] Then search "biryani" shows biryani items
- [ ] No stuck results between searches

### Edge Cases
- [ ] Empty query handled
- [ ] Special characters handled
- [ ] Long queries handled
- [ ] Invalid inputs handled gracefully

---

## 📝 NOTES

### Cache Management
- Timing fields are stripped from cache and recalculated on every request
- Redis FLUSHALL clears all cache if needed
- No stale timing messages

### Multi-Slot Timing
- Restaurants can have multiple opening/closing times per day
- Schedule data attached using `id || store_id`
- Timing display shows next opening time correctly

### Database Updates
- 12 restaurants had veg/non_veg values corrected
- OpenSearch index reindexed with latest data
- All data verified and accurate

---

**Last Updated:** December 31, 2025, 12:54 PM IST  
**Environment:** Production (opensearch.mangwale.ai)  
**Status:** All Features Working ✅
