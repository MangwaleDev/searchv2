# Search API Comprehensive Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture & Components](#architecture--components)
3. [API Endpoints](#api-endpoints)
4. [Search Flow & Logic](#search-flow--logic)
5. [Store Name Search Mechanism](#store-name-search-mechanism)
6. [Sorting Mechanisms](#sorting-mechanisms)
7. [OpenSearch Integration](#opensearch-integration)
8. [Vector Search & Semantic Search](#vector-search--semantic-search)
9. [Data Filtering & Enrichment](#data-filtering--enrichment)
10. [Examples & Use Cases](#examples--use-cases)

---

## Overview

The Search API provides intelligent, multi-modal search capabilities across items and stores using:
- **OpenSearch** as the primary search engine (Elasticsearch-compatible)
- **Vector embeddings** for semantic similarity search
- **Geo-spatial queries** for location-based results
- **Multi-field matching** with relevance scoring
- **Zone-aware filtering** for geographical boundaries

### Key Features
- ✅ **Hybrid Search**: Combines keyword matching with semantic vector search
- ✅ **Store Name Detection**: Automatically detects and searches by store names
- ✅ **Geo-Distance Sorting**: Sorts results by proximity to user location
- ✅ **Multi-Module Support**: Searches across food, e-commerce, and other modules
- ✅ **Intelligent Filtering**: Zone-aware, category-aware, and store-aware filtering
- ✅ **Orphaned Item Filtering**: Automatically excludes items from non-existent stores

---

## Architecture & Components

### System Components

```
┌─────────────────┐
│   Client App    │
│  (Flutter/Web)  │
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────────────────────────┐
│      Search API (NestJS)            │
│  ┌───────────────────────────────┐ │
│  │  SearchController             │ │
│  │  - /v2/search/items          │ │
│  │  - /v2/search/stores         │ │
│  └───────────┬───────────────────┘ │
│              │                      │
│  ┌───────────▼───────────────────┐ │
│  │  SearchService                │ │
│  │  - searchItemsByModule()      │ │
│  │  - searchStoresByModule()     │ │
│  │  - searchWithStoreBoosting()  │ │
│  └───────────┬───────────────────┘ │
│              │                      │
│  ┌───────────▼───────────────────┐ │
│  │  EmbeddingService             │ │
│  │  - generateEmbedding()        │ │
│  └───────────┬───────────────────┘ │
└──────────────┼──────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌──────────┐      ┌──────────────┐
│OpenSearch│      │Embedding     │
│(Port 9200)│      │Service       │
│          │      │(Python/Flask)│
│- Items   │      │              │
│- Stores  │      │- all-MiniLM  │
│- Vectors │      │- 768-dim     │
└──────────┘      └──────────────┘
```

### Data Flow

```
User Query
    │
    ▼
Controller (Parameter Parsing)
    │
    ▼
SearchService (Query Building)
    │
    ├─► Keyword Search ────┐
    │                      │
    └─► Vector Search ─────┼─► OpenSearch Query
    │                      │
    └─► Geo Filter ────────┤
    │                      │
    └─► Zone Filter ───────┤
                           │
                           ▼
                    OpenSearch Index
                    (food_items_v4, etc.)
                           │
                           ▼
                    Results Processing
                    (Store name lookup,
                     Image transformation,
                     Field enrichment)
                           │
                           ▼
                    Response to Client
```

---

## API Endpoints

### 1. `/v2/search/items`

**Purpose**: Search for items (products, food items, etc.) with advanced filtering and sorting.

**Endpoint**: `GET /v2/search/items`

**Query Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `q` | string | No | Search query text | `"pizza"` |
| `module_id` | number | No | Filter by module (4=Food, 5=E-com) | `4` |
| `store_id` | number | No | Filter to specific store | `111` |
| `category_id` | number | No | Filter by category (requires `module_id`) | `288` |
| `semantic` | string | No | Enable semantic search (`"1"` or `"true"`) | `"1"` |
| `veg` | string | No | Veg filter: `"1"`=veg, `"0"`=non-veg | `"1"` |
| `price_min` | number | No | Minimum price | `100` |
| `price_max` | number | No | Maximum price | `500` |
| `rating_min` | number | No | Minimum rating (0-5) | `4` |
| `lat` | number | No | User latitude | `19.9527` |
| `lon` | number | No | User longitude | `73.8362` |
| `radius_km` | number | No | Search radius in kilometers | `5` |
| `page` | number | No | Page number (1-based) | `1` |
| `size` | number | No | Results per page (1-100, default: 20) | `20` |
| `sort` | string | No | Sort order: `distance`, `price_asc`, `price_desc`, `rating`, `popularity` | `"distance"` |

**Response Structure**:
```json
{
  "q": "pizza",
  "filters": {
    "module_id": 4,
    "lat": 19.9527,
    "lon": 73.8362,
    "sort": "distance"
  },
  "items": [
    {
      "id": 1234,
      "name": "Margherita Pizza",
      "description": "Classic Italian pizza",
      "price": 299,
      "store_name": "Pizza Corner",
      "store_id": 111,
      "distance_km": 2.5,
      "delivery_time": "30-45",
      "available_time_starts": "10:00",
      "available_time_ends": "22:00",
      "image_full_url": "https://...",
      "image_fallback_url": "https://...",
      "veg": 1,
      "avg_rating": 4.5,
      "rating_count": 50,
      "order_count": 100,
      "module_id": 4,
      "module_type": "food",
      "unit_type": "piece",
      "zone_id": 1,
      "discount": 10,
      "discount_type": "percent",
      "tax": 5,
      "available_date_starts": "2024-01-01"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "size": 20,
    "total_pages": 3,
    "has_more": true
  }
}
```

### 2. `/v2/search/stores`

**Purpose**: Search for stores (restaurants, shops, etc.) with category and module filtering.

**Endpoint**: `GET /v2/search/stores`

**Query Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `q` | string | No | Store name or keyword | `"pizza"` |
| `module_id` | number | No | Filter by module | `4` |
| `category_id` | number | No | Find stores serving items in this category (requires `module_id`) | `288` |
| `lat` | number | No | User latitude | `19.9527` |
| `lon` | number | No | User longitude | `73.8362` |
| `radius_km` | number | No | Search radius | `5` |
| `page` | number | No | Page number | `1` |
| `size` | number | No | Results per page | `20` |
| `sort` | string | No | Sort: `distance`, `popularity` | `"distance"` |

**Response Structure**:
```json
{
  "q": "pizza",
  "module_id": 4,
  "stores": [
    {
      "id": 111,
      "name": "Pizza Corner",
      "logo_url": "https://...",
      "rating": 4.5,
      "distance": 2.5,
      "delivery_time": "30-45",
      "module_id": 4
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "size": 20
  }
}
```

---

## Search Flow & Logic

### High-Level Search Flow

```
1. User Request
   ↓
2. Controller Validation
   - Parse query parameters
   - Validate module_id/category_id relationship
   - Set defaults (page=1, size=20)
   ↓
3. SearchService.searchItemsByModule()
   ↓
4. Query Building Phase
   ├─ Build filter clauses (module, store, category, veg, price, rating)
   ├─ Build geo filters (if lat/lon provided)
   ├─ Build zone filters (if geo provided)
   ├─ Build text query (if q provided)
   └─ Determine sort order
   ↓
5. Search Execution
   ├─ Semantic Search? (if semantic=1)
   │   ├─ Generate embedding via EmbeddingService
   │   └─ Execute KNN query in OpenSearch
   │
   └─ Keyword Search (default)
       └─ Execute multi-field match query in OpenSearch
   ↓
6. Results Processing
   ├─ Extract items from OpenSearch hits
   ├─ Lookup store names (if missing)
   ├─ Calculate distances (if geo provided)
   ├─ Transform image URLs
   ├─ Enrich items with required fields
   ├─ Filter orphaned items (store_id but no store_name)
   └─ Remove internal fields (_source, _score, embedding)
   ↓
7. Response
   └─ Return formatted JSON to client
```

### Query Building Logic

#### 1. Filter Clauses

```typescript
// Module filter
if (module_id) {
  filterClauses.push({ term: { module_id: module_id } });
}

// Store filter
if (store_id) {
  filterClauses.push({ term: { store_id: store_id } });
  // Note: When store_id is provided, geo and zone filters are skipped
}

// Category filter (includes child categories)
if (category_id) {
  const categoryIds = await getCategoryWithChildren(category_id);
  filterClauses.push({ terms: { category_id: categoryIds } });
}

// Status filters (always applied)
filterClauses.push({ term: { status: 1 } });
filterClauses.push({ term: { is_approved: 1 } });

// Veg filter
if (veg === '1') filterClauses.push({ term: { veg: 1 } });
if (veg === '0') filterClauses.push({ term: { veg: 0 } });

// Price range
if (price_min || price_max) {
  filterClauses.push({ range: { price: { gte: price_min, lte: price_max } } });
}

// Rating filter
if (rating_min) {
  filterClauses.push({ range: { avg_rating: { gte: rating_min } } });
}
```

#### 2. Geo Filters

```typescript
// Geo distance filter (only if radius_km provided and no store_id)
if (hasGeo && radiusKm && !store_id) {
  filterClauses.push({
    geo_distance: {
      distance: `${radiusKm}km`,
      store_location: { lat, lon }
    }
  });
}

// Zone filter (only if geo provided and no store_id)
if (hasGeo && !store_id) {
  const userZoneId = await zoneService.getZoneId(lat, lon);
  if (userZoneId) {
    // Include user's zone + adjacent zones
    const zoneFilter = buildZoneFilter(userZoneId, includeAdjacent: true);
    filterClauses.push(zoneFilter);
  }
}
```

#### 3. Text Query Building

When a query string (`q`) is provided, the system builds a multi-field query with different boost values:

```typescript
const textQuery = {
  bool: {
    should: [
      // Exact term match (highest priority)
      { term: { name: { value: q, boost: 10 } } },
      { term: { slug: { value: q.toLowerCase(), boost: 8 } } },
      
      // Phrase match (high priority)
      { match_phrase: { name: { query: q, boost: 6 } } },
      { match_phrase: { slug: { query: q.toLowerCase(), boost: 5 } } },
      
      // Store name match (important for store searches)
      { match: { store_name: { query: q, boost: 7, operator: 'and' } } },
      
      // Multi-field match (default)
      { multi_match: {
        query: q,
        fields: ['name^3', 'description^1', 'category_name^2', 'store_name^2'],
        type: 'best_fields',
        operator: 'and',
        fuzziness: 'AUTO',
        lenient: true
      }},
      
      // Wildcard matches (lower priority)
      { wildcard: { name: { value: `*${q.toLowerCase()}*`, boost: 2 } } },
      { wildcard: { slug: { value: `*${q.toLowerCase()}*`, boost: 1.5 } } }
    ],
    minimum_should_match: 1
  }
};
```

**Boost Values Explained**:
- `name^3`: Item name matches are 3x more important than description
- `store_name^2`: Store name matches are 2x more important than description
- `category_name^2`: Category matches are 2x more important than description
- Exact matches get boost 10, phrase matches get boost 6, wildcards get boost 2

---

## Store Name Search Mechanism

### How Store Name Searches Work

When a user searches for a store name (e.g., "Ganesh Sweet Mart"), the system performs a **multi-level search**:

#### 1. Store Name Detection in Query

The query string is analyzed to detect if it contains a store name:

```typescript
// Example: "Ganesh sweet mart" or "paneer from Ganesh"
// The system searches for items where:
// - store_name matches the query
// - OR item name matches the query AND store_name is mentioned
```

#### 2. Multi-Field Query with Store Boosting

The search query includes `store_name` as a searchable field with high boost:

```json
{
  "multi_match": {
    "query": "Ganesh sweet mart",
    "fields": [
      "name^3",           // Item name (boost 3)
      "description^1",    // Description (boost 1)
      "category_name^2",  // Category (boost 2)
      "store_name^2"      // Store name (boost 2) ← Important!
    ],
    "type": "best_fields",
    "operator": "and"
  }
}
```

#### 3. Store-First Search Strategy

The `searchWithStoreBoosting()` method implements a **store-first** approach:

```typescript
// When query matches a store name:
// 1. First, search stores index for matching stores
// 2. Then, search items index for items from those stores
// 3. Boost items from matching stores higher in results
```

**Query Structure**:
```json
{
  "function_score": {
    "query": { /* multi_match query */ },
    "functions": [
      {
        "filter": { "term": { "_index": "food_stores_v4" } },
        "weight": 10.0  // Stores get 10x boost
      },
      {
        "filter": { "term": { "_index": "food_items_v4" } },
        "weight": 1.0   // Items get base score
      }
    ]
  }
}
```

#### 4. Store Name Lookup & Population

After retrieving items, the system ensures all items have `store_name` populated:

```typescript
// 1. Extract unique store_ids from items
const storeIds = [...new Set(items.map(item => item.store_id))];

// 2. Lookup store names from OpenSearch stores index
const storeNames = await getStoreNames(storeIds);

// 3. Populate store_name for each item
items.forEach(item => {
  item.store_name = storeNames[item.store_id] || null;
});

// 4. Filter out orphaned items (store_id but no store_name)
const validItems = items.filter(item => {
  if (!item.store_id) return true;  // Items without store_id are valid
  return item.store_name && item.store_name !== '';  // Items with store_id must have store_name
});
```

#### 5. Store Name Fallback

If `store_name` is missing from OpenSearch, the system falls back to MySQL:

```typescript
async getStoreNames(storeIds: number[], module: string): Promise<Record<string, string>> {
  // 1. Try OpenSearch stores index
  const opensearchResults = await searchStoresIndex(storeIds);
  
  // 2. For missing stores, query MySQL
  const missingStoreIds = storeIds.filter(id => !opensearchResults[id]);
  if (missingStoreIds.length > 0) {
    const mysqlResults = await queryMySQLStores(missingStoreIds);
    // Merge results
  }
  
  return storeNames;
}
```

### Example: Store Name Search Flow

**Query**: `GET /v2/search/items?q=Ganesh sweet mart&module_id=4`

**Step-by-Step**:

1. **Query Analysis**: System detects "Ganesh sweet mart" as a potential store name
2. **OpenSearch Query**: Searches items with `store_name^2` boost
3. **Results**: Returns items from stores matching "Ganesh sweet mart"
4. **Store Name Lookup**: Ensures all items have `store_name` populated
5. **Filtering**: Removes items from non-existent stores (if any)
6. **Response**: Returns items with `store_name: "Ganesh Sweet Mart"` (or similar)

---

## Sorting Mechanisms

### Sort Options

The API supports multiple sorting strategies:

| Sort Option | Description | When Used |
|-------------|-------------|-----------|
| `distance` | Sort by proximity to user location | When `lat` and `lon` provided |
| `price_asc` | Sort by price (low to high) | Explicitly requested |
| `price_desc` | Sort by price (high to low) | Explicitly requested |
| `rating` | Sort by average rating (descending) | Explicitly requested |
| `popularity` | Sort by order_count, then rating | Default when no geo provided |

### Distance Sorting

When `sort=distance` and geo coordinates are provided:

```typescript
// OpenSearch geo_distance sort
sort: [{
  _geo_distance: {
    store_location: { lat: 19.9527, lon: 73.8362 },
    order: 'asc',
    unit: 'km'
  }
}]

// Distance calculation (Haversine formula)
distance_km = arcDistance(store_location, user_location) / 1000.0
```

**Distance Calculation**:
- Uses OpenSearch's `arcDistance` function (Haversine formula)
- Calculated in meters, converted to kilometers
- Stored in `distance_km` field in response

### Popularity Sorting

Default sort when no geo coordinates:

```typescript
sort: [
  { order_count: { order: 'desc', missing: 0 } },
  { avg_rating: { order: 'desc' } }
]
```

**Priority**:
1. Items with higher `order_count` appear first
2. For same `order_count`, higher `avg_rating` appears first
3. Items with `order_count = 0` are sorted by rating

### Price Sorting

```typescript
// Ascending
sort: [{ price: { order: 'asc' } }]

// Descending
sort: [{ price: { order: 'desc' } }]
```

### Rating Sorting

```typescript
sort: [
  { avg_rating: { order: 'desc' } },
  { order_count: { order: 'desc' } }  // Secondary sort
]
```

### Combined Sorting (Semantic Search)

When semantic search is enabled with geo coordinates:

```typescript
sort: [
  '_score',  // First by semantic similarity
  { _geo_distance: { store_location: { lat, lon }, order: 'asc', unit: 'km' } }
]
```

This ensures:
1. Most semantically similar items appear first
2. Among similar items, closer ones are prioritized

---

## OpenSearch Integration

### OpenSearch Role

OpenSearch serves as the **primary search engine** and **vector database**:

1. **Full-Text Search**: Indexes and searches item names, descriptions, categories, store names
2. **Vector Storage**: Stores 768-dimensional embeddings for semantic search
3. **Geo-Spatial Queries**: Handles distance calculations and geo-filtering
4. **Faceted Search**: Supports filtering by multiple criteria simultaneously
5. **Relevance Scoring**: Calculates relevance scores using BM25 algorithm

### Index Structure

#### Items Index (`food_items_v4`, `ecom_items`)

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "long" },
      "name": { "type": "text", "analyzer": "standard" },
      "description": { "type": "text" },
      "store_name": { "type": "text" },
      "store_id": { "type": "long" },
      "store_location": { "type": "geo_point" },
      "price": { "type": "float" },
      "module_id": { "type": "integer" },
      "category_id": { "type": "integer" },
      "item_vector": {
        "type": "knn_vector",
        "dimension": 768,
        "method": {
          "name": "hnsw",
          "space_type": "l2",
          "engine": "nmslib"
        }
      }
    }
  }
}
```

#### Stores Index (`food_stores_v4`, `ecom_stores`)

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "long" },
      "name": { "type": "text" },
      "store_location": { "type": "geo_point" },
      "module_id": { "type": "integer" },
      "order_count": { "type": "long" },
      "rating": { "type": "float" }
    }
  }
}
```

### Query Types

#### 1. Boolean Query

```json
{
  "query": {
    "bool": {
      "must": [ /* required clauses */ ],
      "should": [ /* optional clauses */ ],
      "filter": [ /* exact match filters */ ],
      "must_not": [ /* exclusion clauses */ ]
    }
  }
}
```

#### 2. Multi-Match Query

```json
{
  "multi_match": {
    "query": "pizza",
    "fields": ["name^3", "description^1", "store_name^2"],
    "type": "best_fields",
    "operator": "and"
  }
}
```

#### 3. Geo-Distance Query

```json
{
  "geo_distance": {
    "distance": "5km",
    "store_location": {
      "lat": 19.9527,
      "lon": 73.8362
    }
  }
}
```

#### 4. KNN Query (Vector Search)

```json
{
  "knn": {
    "item_vector": {
      "vector": [0.123, -0.456, ...],  // 768-dim vector
      "k": 100
    }
  }
}
```

### Performance Optimizations

1. **Index Aliases**: Uses aliases to switch between index versions seamlessly
2. **Field Selection**: Only retrieves required fields (`_source` exclusion)
3. **Script Fields**: Calculates distance on-the-fly without storing
4. **Pagination**: Uses `from` and `size` for efficient pagination
5. **Parallel Queries**: Searches multiple indices in parallel using `Promise.all()`

---

## Vector Search & Semantic Search

### Overview

Semantic search uses **vector embeddings** to find items based on **meaning** rather than exact keyword matches.

### How It Works

#### 1. Embedding Generation

When `semantic=1` is provided:

```typescript
// 1. Query is sent to EmbeddingService
const embedding = await embeddingService.generateEmbedding(query, modelType);

// 2. EmbeddingService uses ML model (all-MiniLM-L6-v2 or food-specific model)
//    - Input: "spicy chicken dish"
//    - Output: [0.123, -0.456, 0.789, ...] (768-dimensional vector)
```

**Model Details**:
- **Food Module**: Uses food-specific embedding model (768 dimensions)
- **E-commerce Module**: Uses general embedding model (384 dimensions)
- **Model Type**: Sentence Transformer (all-MiniLM-L6-v2 or custom)
- **Speed**: ~120 items/sec embedding generation

#### 2. KNN Search in OpenSearch

```typescript
const body = {
  query: {
    bool: {
      must: [{
        knn: {
          item_vector: {
            vector: embedding,  // 768-dim vector
            k: Math.min(size * 3, 100)  // Find top 100 similar items
          }
        }
      }],
      filter: filterClauses  // Apply filters (veg, price, etc.)
    }
  },
  sort: ['_score']  // Sort by similarity score
};
```

**KNN Algorithm**: HNSW (Hierarchical Navigable Small World)
- **Space Type**: L2 (Euclidean distance)
- **ef_construction**: 128 (build-time quality)
- **ef_search**: 100 (query-time quality)
- **m**: 24 (max connections per node)

#### 3. Similarity Scoring

OpenSearch returns items with similarity scores:
- **Lower score = More similar** (L2 distance)
- Items are sorted by `_score` (ascending for distance)

#### 4. Hybrid Search (Future Enhancement)

The system can combine keyword and vector search:

```typescript
// Combine BM25 (keyword) + KNN (semantic) scores
{
  "query": {
    "bool": {
      "should": [
        { /* keyword query */ },
        { knn: { /* vector query */ } }
      ]
    }
  }
}
```

### Use Cases

1. **Natural Language Queries**: "healthy breakfast options" → finds oats, fruits, smoothies
2. **Conceptual Search**: "spicy chicken dish" → finds curries, tikkas, biryanis
3. **Typo Tolerance**: "piza" → finds "pizza" items
4. **Cross-Lingual**: English query → finds items with Hindi/Marathi names
5. **Contextual Search**: "light meal" → finds salads, soups, not heavy curries

### Performance

- **Query Time**: ~50ms (vs 200ms with script_score)
- **Throughput**: ~200 queries/second per node
- **Index Overhead**: ~100 MB per 10K items
- **Recall**: >95% for top-100 results

---

## Data Filtering & Enrichment

### Filtering Pipeline

```
OpenSearch Results
    │
    ▼
1. Extract _source fields
    │
    ▼
2. Convert time formats (milliseconds → HH:mm)
    │
    ▼
3. Lookup store names (if missing)
    │
    ▼
4. Calculate distances (if geo provided)
    │
    ▼
5. Transform image URLs
    │
    ▼
6. Enrich with required fields
    │
    ▼
7. Filter orphaned items
    │
    ▼
8. Remove internal fields (_source, _score, embedding)
    │
    ▼
Final Response
```

### Field Enrichment

The `enrichItemWithRequiredFields()` function ensures all required fields are present:

```typescript
{
  // Required fields with defaults
  description: item.description || '',
  image: item.image || '',
  image_full_url: item.image_full_url || item.image_url || '',
  image_fallback_url: item.image_fallback_url || '',
  discount: item.discount || 0,
  discount_type: item.discount_type || 'percent',
  tax: item.tax || 0,
  veg: item.veg !== undefined ? item.veg : 1,
  avg_rating: item.avg_rating || 0,
  rating_count: item.rating_count || 0,
  order_count: item.order_count || 0,
  module_id: item.module_id || moduleId || null,
  module_type: moduleTypeMap[module_id] || null,  // 'food', 'ecommerce', 'grocery'
  unit_type: unitTypeMap[unit_id] || 'piece',     // 'piece', 'kg', 'gram', etc.
  zone_id: item.zone_id || null,
  store_name: item.store_name || null,
  distance_km: item.distance_km || null,
  delivery_time: formattedDeliveryTime,  // "30-45" format
  available_time_starts: convertedTime,  // "10:00" format
  available_time_ends: convertedTime,    // "22:00" format
  available_date_starts: formattedDate    // "2024-01-01" format
}
```

### Orphaned Item Filtering

Items with `store_id` but no `store_name` are filtered out:

```typescript
const validItems = items.filter(item => {
  // Items without store_id are valid
  if (!item.store_id) return true;
  
  // Items with store_id must have valid store_name
  return item.store_name && item.store_name !== '';
});
```

**Why?**: Prevents returning items from stores that no longer exist in the database.

### Image URL Transformation

The `ImageService` transforms image paths to full URLs:

```typescript
// Input: "2025-01-15-6787626c1a927.png"
// Output:
{
  image: "2025-01-15-6787626c1a927.png",
  image_full_url: "https://storage.mangwale.ai/mangwale/product/2025-01-15-6787626c1a927.png",
  image_fallback_url: "https://mangwale.s3.ap-south-1.amazonaws.com/product/2025-01-15-6787626c1a927.png",
  image_cdn_url: "https://cdn.mangwale.ai/product/2025-01-15-6787626c1a927.png"
}
```

---

## Examples & Use Cases

### Example 1: Basic Item Search

**Request**:
```http
GET /v2/search/items?q=pizza&module_id=4&lat=19.9527&lon=73.8362&sort=distance
```

**What Happens**:
1. Searches for items with "pizza" in name, description, or store_name
2. Filters to module_id=4 (Food)
3. Calculates distance from user location
4. Sorts by distance (closest first)
5. Returns top 20 results

**Response**:
```json
{
  "q": "pizza",
  "filters": { "module_id": 4, "sort": "distance" },
  "items": [
    {
      "id": 1234,
      "name": "Margherita Pizza",
      "store_name": "Pizza Corner",
      "distance_km": 1.2,
      "price": 299
    }
  ],
  "meta": { "total": 50, "page": 1, "size": 20 }
}
```

### Example 2: Store Name Search

**Request**:
```http
GET /v2/search/items?q=Ganesh sweet mart&module_id=4
```

**What Happens**:
1. Detects "Ganesh sweet mart" as store name
2. Searches items with `store_name^2` boost
3. Returns items from stores matching "Ganesh sweet mart"
4. Ensures all items have `store_name` populated
5. Filters out items from non-existent stores

**Response**:
```json
{
  "q": "Ganesh sweet mart",
  "items": [
    {
      "id": 2626,
      "name": "Sweet Boondi",
      "store_name": "Ganesh Sweet Mart",  // ← Populated
      "store_id": 118,
      "price": 50
    }
  ]
}
```

### Example 3: Semantic Search

**Request**:
```http
GET /v2/search/items?q=spicy chicken dish&module_id=4&semantic=1
```

**What Happens**:
1. Generates embedding for "spicy chicken dish"
2. Performs KNN search in OpenSearch
3. Finds semantically similar items (curries, tikkas, biryanis)
4. Returns items sorted by similarity score

**Response**:
```json
{
  "q": "spicy chicken dish",
  "items": [
    {
      "id": 5678,
      "name": "Chicken Tikka Masala",
      "description": "Spicy Indian curry",
      "score": 0.759  // Similarity score
    },
    {
      "id": 5679,
      "name": "Spicy Chicken Biryani",
      "score": 0.743
    }
  ]
}
```

### Example 4: Store-Specific Search

**Request**:
```http
GET /v2/search/items?q=chicken&module_id=4&store_id=111&lat=19.9527&lon=73.8362
```

**What Happens**:
1. Filters to store_id=111 only
2. **Skips geo and zone filters** (user wants specific store)
3. Searches for "chicken" items in that store
4. Returns all matching items regardless of distance

**Response**:
```json
{
  "q": "chicken",
  "filters": { "module_id": 4, "store_id": 111 },
  "items": [
    {
      "id": 9999,
      "name": "Chicken Curry",
      "store_name": "Restaurant ABC",
      "store_id": 111,
      "distance_km": null  // Not calculated (store-specific search)
    }
  ]
}
```

### Example 5: Category-Based Store Search

**Request**:
```http
GET /v2/search/stores?module_id=4&category_id=288
```

**What Happens**:
1. Finds all items in category_id=288
2. Extracts store_ids from those items
3. Searches stores by those store_ids
4. Returns stores that serve items in that category

**Response**:
```json
{
  "module_id": 4,
  "category_id": 288,
  "stores": [
    {
      "id": 111,
      "name": "Restaurant ABC",
      "module_id": 4
    }
  ]
}
```

---

## Summary

### Key Takeaways

1. **Multi-Modal Search**: Combines keyword, semantic, and geo-spatial search
2. **Store Name Intelligence**: Automatically detects and searches by store names
3. **Zone-Aware Filtering**: Filters results based on geographical zones
4. **Orphaned Item Protection**: Filters out items from non-existent stores
5. **Field Enrichment**: Ensures all required fields are present with defaults
6. **Performance Optimized**: Uses OpenSearch efficiently with proper indexing

### Technology Stack

- **Search Engine**: OpenSearch (Elasticsearch-compatible)
- **Vector Database**: OpenSearch KNN (HNSW algorithm)
- **Embedding Model**: all-MiniLM-L6-v2 (384/768 dimensions)
- **Backend**: NestJS (TypeScript)
- **Embedding Service**: Python/Flask

### Performance Metrics

- **Keyword Search**: ~50-100ms
- **Semantic Search**: ~50-150ms (including embedding generation)
- **Throughput**: ~200 queries/second per node
- **Index Size**: ~100 MB per 10K items (with vectors)

---

**Last Updated**: January 2025
**Version**: 2.0

