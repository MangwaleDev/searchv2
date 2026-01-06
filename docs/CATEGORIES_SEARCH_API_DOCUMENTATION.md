# Categories Search API Documentation

## Overview

The `/v2/search/categories` endpoint allows you to search and retrieve available categories with optional filtering by module, store, location, and text query. When a `store_id` is provided, the API returns categories served by that specific store along with item counts for each category.

**Base URL**: `https://search.test.mangwale.ai`

**Endpoint**: `GET /v2/search/categories`

---

## Use Cases

1. **Browse All Categories**: Get all available categories for a module
2. **Store Menu Categories**: Get categories available at a specific store with item counts
3. **Location-Based Categories**: Get categories available within a geographic radius
4. **Search Categories**: Find categories by name (e.g., "pizza", "sweet")
5. **Module-Specific Categories**: Filter categories by module (Food, E-commerce, etc.)

---

## Request Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `q` | string | No | Search query text for category name | `"pizza"` |
| `module_id` | number | No | Filter by module ID (4=Food, 5=E-commerce, 6=Grocery) | `4` |
| `store_id` | number | No | Filter by store ID (returns categories served by this store with item counts) | `13` |
| `lat` | number | No | Latitude for geo-distance filtering | `19.9527` |
| `lon` | number | No | Longitude for geo-distance filtering | `73.8362` |
| `radius_km` | number | No | Search radius in kilometers (requires `lat` and `lon`) | `5` |
| `page` | number | No | Page number (1-based, default: 1) | `1` |
| `size` | number | No | Results per page (1-100, default: 20) | `20` |

### Parameter Notes

- **`module_id`**: When provided, returns only categories belonging to that module
- **`store_id`**: When provided:
  - Returns only categories that have items in that store
  - Includes `item_count` field showing number of items in each category for that store
  - Geo filtering is skipped (store location is fixed)
- **`lat`/`lon`**: When provided with `radius_km`, filters categories by items within the geographic radius
- **`q`**: Searches category names and slugs (supports fuzzy matching)

---

## Response Structure

### Success Response (200 OK)

```json
{
  "q": "pizza",
  "filters": {
    "module_id": 4,
    "store_id": 13,
    "lat": 19.9527,
    "lon": 73.8362
  },
  "categories": [
    {
      "id": 120,
      "name": "Chaat",
      "slug": "chaat",
      "image": "2025-06-11-68496fe601c8c.png",
      "image_full_url": "https://storage.mangwale.ai/mangwale/category/2025-06-11-68496fe601c8c.png",
      "image_fallback_url": "https://mangwale.s3.ap-south-1.amazonaws.com/category/2025-06-11-68496fe601c8c.png",
      "image_status": "available",
      "module_id": 4,
      "parent_id": null,
      "priority": null,
      "featured": 0,
      "item_count": 12
    }
  ],
  "meta": {
    "total": 16,
    "page": 1,
    "size": 20,
    "total_pages": 1,
    "has_more": false
  }
}
```

### Response Fields

#### Category Object

| Field | Type | Description | Notes |
|-------|------|-------------|-------|
| `id` | number | Category ID | Unique identifier |
| `name` | string | Category name | Display name |
| `slug` | string | Category slug | URL-friendly identifier |
| `image` | string | Image filename | Original filename |
| `image_full_url` | string | Full image URL | Primary image URL (PREFERRED) |
| `image_fallback_url` | string | Fallback image URL | Backup image URL |
| `image_status` | string | Image availability status | `"available"`, `"missing"`, or `null` |
| `module_id` | number | Module ID | 4=Food, 5=E-commerce, 6=Grocery |
| `parent_id` | number\|null | Parent category ID | For subcategories |
| `priority` | number\|null | Display priority | Higher = more important |
| `featured` | number | Featured flag | 1=featured, 0=not featured |
| `item_count` | number | Item count in category | **Only present when `store_id` is provided** |

#### Meta Object

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total number of categories matching filters |
| `page` | number | Current page number |
| `size` | number | Number of results per page |
| `total_pages` | number | Total number of pages |
| `has_more` | boolean | Whether there are more results |

---

## Examples

### Example 1: Get All Categories for a Module

**Request**:
```http
GET /v2/search/categories?module_id=4
```

**Response**:
```json
{
  "q": "",
  "filters": { "module_id": 4 },
  "categories": [
    {
      "id": 288,
      "name": "Paneer",
      "item_count": 950,
      "module_id": 4
    },
    {
      "id": 279,
      "name": "Chicken",
      "item_count": 749,
      "module_id": 4
    }
  ],
  "meta": {
    "total": 115,
    "page": 1,
    "size": 20,
    "total_pages": 6,
    "has_more": true
  }
}
```

**Use Case**: Display all available food categories in a category browser

---

### Example 2: Get Categories for a Specific Store

**Request**:
```http
GET /v2/search/categories?module_id=4&store_id=13
```

**Response**:
```json
{
  "q": "",
  "filters": { "module_id": 4, "store_id": 13 },
  "categories": [
    {
      "id": 120,
      "name": "Chaat",
      "item_count": 12,
      "module_id": 4
    },
    {
      "id": 932,
      "name": "Barfi Specials",
      "item_count": 5,
      "module_id": 4
    },
    {
      "id": 933,
      "name": "Pedha Specials",
      "item_count": 5,
      "module_id": 4
    }
  ],
  "meta": {
    "total": 16,
    "page": 1,
    "size": 20,
    "total_pages": 1,
    "has_more": false
  }
}
```

**Use Case**: Display store menu categories with item counts (e.g., "Chaat (12 items)")

---

### Example 3: Search Categories by Name

**Request**:
```http
GET /v2/search/categories?module_id=4&q=pizza
```

**Response**:
```json
{
  "q": "pizza",
  "filters": { "module_id": 4 },
  "categories": [
    {
      "id": 154,
      "name": "Pizza",
      "item_count": 243,
      "module_id": 4
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "size": 20,
    "total_pages": 1,
    "has_more": false
  }
}
```

**Use Case**: Autocomplete or search functionality for categories

---

### Example 4: Store Categories with Text Search

**Request**:
```http
GET /v2/search/categories?module_id=4&store_id=13&q=sweet
```

**Response**:
```json
{
  "q": "sweet",
  "filters": { "module_id": 4, "store_id": 13 },
  "categories": [
    {
      "id": 21,
      "name": "Sweets",
      "item_count": 2,
      "module_id": 4
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "size": 20,
    "total_pages": 1,
    "has_more": false
  }
}
```

**Use Case**: Search for specific category types within a store's menu

---

### Example 5: Location-Based Categories

**Request**:
```http
GET /v2/search/categories?module_id=4&lat=19.9527&lon=73.8362&radius_km=5
```

**Response**:
```json
{
  "q": "",
  "filters": {
    "module_id": 4,
    "lat": 19.9527,
    "lon": 73.8362,
    "radius_km": 5
  },
  "categories": [
    {
      "id": 288,
      "name": "Paneer",
      "item_count": 950,
      "module_id": 4
    }
  ],
  "meta": {
    "total": 115,
    "page": 1,
    "size": 20,
    "total_pages": 6,
    "has_more": true
  }
}
```

**Use Case**: Show categories available near user's location

---

## Integration Guide

### Flutter/Dart Example

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class Category {
  final int id;
  final String name;
  final String slug;
  final String? image;
  final String? imageFullUrl;
  final int? itemCount;
  final int moduleId;

  Category({
    required this.id,
    required this.name,
    required this.slug,
    this.image,
    this.imageFullUrl,
    this.itemCount,
    required this.moduleId,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'],
      name: json['name'],
      slug: json['slug'],
      image: json['image'],
      imageFullUrl: json['image_full_url'],
      itemCount: json['item_count'],
      moduleId: json['module_id'],
    );
  }
}

class CategoriesResponse {
  final List<Category> categories;
  final int total;
  final int page;
  final int size;
  final bool hasMore;

  CategoriesResponse({
    required this.categories,
    required this.total,
    required this.page,
    required this.size,
    required this.hasMore,
  });

  factory CategoriesResponse.fromJson(Map<String, dynamic> json) {
    return CategoriesResponse(
      categories: (json['categories'] as List)
          .map((c) => Category.fromJson(c))
          .toList(),
      total: json['meta']['total'],
      page: json['meta']['page'],
      size: json['meta']['size'],
      hasMore: json['meta']['has_more'],
    );
  }
}

class CategoriesApi {
  static const String baseUrl = 'https://search.test.mangwale.ai';

  // Get all categories for a module
  static Future<CategoriesResponse> getCategories({
    int? moduleId,
    int? storeId,
    String? query,
    double? lat,
    double? lon,
    double? radiusKm,
    int page = 1,
    int size = 20,
  }) async {
    final uri = Uri.parse('$baseUrl/v2/search/categories').replace(
      queryParameters: {
        if (moduleId != null) 'module_id': moduleId.toString(),
        if (storeId != null) 'store_id': storeId.toString(),
        if (query != null && query.isNotEmpty) 'q': query,
        if (lat != null) 'lat': lat.toString(),
        if (lon != null) 'lon': lon.toString(),
        if (radiusKm != null) 'radius_km': radiusKm.toString(),
        'page': page.toString(),
        'size': size.toString(),
      },
    );

    final response = await http.get(uri);
    
    if (response.statusCode == 200) {
      return CategoriesResponse.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to load categories: ${response.statusCode}');
    }
  }

  // Get store menu categories
  static Future<CategoriesResponse> getStoreCategories({
    required int storeId,
    int? moduleId,
    int page = 1,
    int size = 100,
  }) async {
    return getCategories(
      storeId: storeId,
      moduleId: moduleId,
      page: page,
      size: size,
    );
  }
}

// Usage Example
void main() async {
  // Get all food categories
  final allCategories = await CategoriesApi.getCategories(moduleId: 4);
  print('Total categories: ${allCategories.total}');
  
  // Get store menu categories
  final storeCategories = await CategoriesApi.getStoreCategories(
    storeId: 13,
    moduleId: 4,
  );
  print('Store has ${storeCategories.categories.length} categories');
  storeCategories.categories.forEach((cat) {
    print('${cat.name}: ${cat.itemCount} items');
  });
  
  // Search categories
  final pizzaCategories = await CategoriesApi.getCategories(
    moduleId: 4,
    query: 'pizza',
  );
  print('Found ${pizzaCategories.categories.length} pizza categories');
}
```

---

### JavaScript/TypeScript Example

```typescript
interface Category {
  id: number;
  name: string;
  slug: string;
  image?: string;
  image_full_url?: string;
  image_fallback_url?: string;
  image_status?: string;
  module_id: number;
  parent_id?: number | null;
  priority?: number | null;
  featured: number;
  item_count?: number; // Only present when store_id is provided
}

interface CategoriesResponse {
  q: string;
  filters: {
    module_id?: number;
    store_id?: number;
    lat?: number;
    lon?: number;
    radius_km?: number;
  };
  categories: Category[];
  meta: {
    total: number;
    page: number;
    size: number;
    total_pages: number;
    has_more: boolean;
  };
}

class CategoriesApi {
  private baseUrl = 'https://search.test.mangwale.ai';

  async getCategories(params: {
    q?: string;
    module_id?: number;
    store_id?: number;
    lat?: number;
    lon?: number;
    radius_km?: number;
    page?: number;
    size?: number;
  }): Promise<CategoriesResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.q) queryParams.append('q', params.q);
    if (params.module_id) queryParams.append('module_id', params.module_id.toString());
    if (params.store_id) queryParams.append('store_id', params.store_id.toString());
    if (params.lat) queryParams.append('lat', params.lat.toString());
    if (params.lon) queryParams.append('lon', params.lon.toString());
    if (params.radius_km) queryParams.append('radius_km', params.radius_km.toString());
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.size) queryParams.append('size', params.size.toString());

    const response = await fetch(`${this.baseUrl}/v2/search/categories?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  }

  // Get all categories for a module
  async getModuleCategories(moduleId: number): Promise<CategoriesResponse> {
    return this.getCategories({ module_id: moduleId, size: 100 });
  }

  // Get store menu categories
  async getStoreCategories(storeId: number, moduleId?: number): Promise<CategoriesResponse> {
    return this.getCategories({ 
      store_id: storeId, 
      module_id: moduleId,
      size: 100 
    });
  }

  // Search categories by name
  async searchCategories(query: string, moduleId?: number): Promise<CategoriesResponse> {
    return this.getCategories({ q: query, module_id: moduleId });
  }
}

// Usage Example
const api = new CategoriesApi();

// Get all food categories
const allCategories = await api.getModuleCategories(4);
console.log(`Total categories: ${allCategories.meta.total}`);

// Get store menu categories
const storeCategories = await api.getStoreCategories(13, 4);
storeCategories.categories.forEach(cat => {
  console.log(`${cat.name}: ${cat.item_count} items`);
});

// Search categories
const pizzaCategories = await api.searchCategories('pizza', 4);
console.log(`Found ${pizzaCategories.categories.length} pizza categories`);
```

---

### React Native Example

```typescript
import axios from 'axios';

const API_BASE_URL = 'https://search.test.mangwale.ai';

interface Category {
  id: number;
  name: string;
  slug: string;
  image?: string;
  image_full_url?: string;
  item_count?: number;
  module_id: number;
}

interface CategoriesResponse {
  categories: Category[];
  meta: {
    total: number;
    page: number;
    size: number;
    has_more: boolean;
  };
}

export const getCategories = async (params: {
  moduleId?: number;
  storeId?: number;
  query?: string;
  lat?: number;
  lon?: number;
  radiusKm?: number;
  page?: number;
  size?: number;
}): Promise<CategoriesResponse> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/v2/search/categories`, {
      params: {
        module_id: params.moduleId,
        store_id: params.storeId,
        q: params.query,
        lat: params.lat,
        lon: params.lon,
        radius_km: params.radiusKm,
        page: params.page || 1,
        size: params.size || 20,
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

// React Component Example
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image } from 'react-native';

const StoreCategoriesScreen = ({ storeId, moduleId }: { storeId: number; moduleId: number }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCategories({
          storeId,
          moduleId,
          size: 100,
        });
        setCategories(data.categories);
      } catch (error) {
        console.error('Failed to load categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [storeId, moduleId]);

  if (loading) {
    return <Text>Loading categories...</Text>;
  }

  return (
    <FlatList
      data={categories}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
          {item.image_full_url && (
            <Image
              source={{ uri: item.image_full_url }}
              style={{ width: 50, height: 50, marginRight: 12 }}
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{item.name}</Text>
            {item.item_count !== undefined && (
              <Text style={{ fontSize: 14, color: '#666' }}>
                {item.item_count} items
              </Text>
            )}
          </View>
        </View>
      )}
    />
  );
};
```

---

### cURL Examples

```bash
# Get all categories for module 4 (Food)
curl "https://search.test.mangwale.ai/v2/search/categories?module_id=4"

# Get categories for store 13
curl "https://search.test.mangwale.ai/v2/search/categories?module_id=4&store_id=13"

# Search categories by name
curl "https://search.test.mangwale.ai/v2/search/categories?module_id=4&q=pizza"

# Get store categories with location
curl "https://search.test.mangwale.ai/v2/search/categories?module_id=4&store_id=13&lat=19.9527&lon=73.8362"

# Get all categories (pagination)
curl "https://search.test.mangwale.ai/v2/search/categories?module_id=4&page=1&size=100"
```

---

## Sorting and Filtering

### Default Sorting

Categories are sorted by:
1. **Item count** (descending) - When `store_id` is provided
2. **Priority** (descending) - Category display priority
3. **Name** (ascending) - Alphabetical order

### Availability Filtering

The API automatically filters out categories that:
- Have no items (`status=1`, `is_approved=1`)
- Are not active (`status=1`)

### Geo Filtering

When `lat`, `lon`, and `radius_km` are provided:
- Filters categories by items within the geographic radius
- **Note**: Geo filtering is skipped when `store_id` is provided (store location is fixed)

---

## Error Handling

### Common Errors

#### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid parameters",
  "error": "Bad Request"
}
```

#### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

### Error Handling Example

```typescript
try {
  const categories = await api.getCategories({ moduleId: 4 });
  // Handle success
} catch (error) {
  if (error.response) {
    // Server responded with error
    console.error('Error status:', error.response.status);
    console.error('Error data:', error.response.data);
  } else if (error.request) {
    // Request made but no response
    console.error('No response received');
  } else {
    // Error in request setup
    console.error('Error:', error.message);
  }
}
```

---

## Best Practices

### 1. Use Appropriate Page Size

- **Store categories**: Use `size=100` to get all categories at once
- **Module categories**: Use `size=20` for pagination (default)
- **Search results**: Use `size=20` for better performance

### 2. Cache Category Data

Categories don't change frequently. Consider caching:
- Store categories: Cache for 5-10 minutes
- Module categories: Cache for 15-30 minutes
- Search results: Cache for 1-2 minutes

### 3. Handle Image URLs

Always use `image_full_url` as primary, with `image_fallback_url` as backup:

```typescript
const imageUrl = category.image_full_url || category.image_fallback_url || defaultImage;
```

### 4. Display Item Counts

When `item_count` is present (store-specific search), display it prominently:

```typescript
{category.item_count !== undefined && (
  <Text>{category.name} ({category.item_count} items)</Text>
)}
```

### 5. Pagination

For large result sets, implement pagination:

```typescript
const loadMore = async () => {
  if (response.meta.has_more) {
    const nextPage = await api.getCategories({
      moduleId: 4,
      page: currentPage + 1,
    });
    setCategories([...categories, ...nextPage.categories]);
  }
};
```

---

## Performance Considerations

- **Response Time**: Typically 50-150ms
- **Rate Limiting**: No explicit rate limits, but use reasonable request intervals
- **Caching**: Responses are cached for 1-5 minutes depending on query type
- **Pagination**: Use pagination for large result sets (>100 categories)

---

## Integration Checklist

- [ ] Implement API client for `/v2/search/categories`
- [ ] Handle `item_count` field when `store_id` is provided
- [ ] Implement image URL fallback logic
- [ ] Add error handling for network failures
- [ ] Implement pagination for large result sets
- [ ] Cache category data appropriately
- [ ] Display item counts in UI when available
- [ ] Handle empty results gracefully
- [ ] Test with different parameter combinations

---

## Support

For issues or questions:
- **API Base URL**: `https://search.test.mangwale.ai`
- **Documentation**: See `/docs/SEARCH_API_COMPREHENSIVE_DOCUMENTATION.md`
- **Health Check**: `GET /health`

---

**Last Updated**: January 2025  
**API Version**: 2.0

