# Search API Response Format Documentation

## Overview

This document describes the expected response format from the search microservice API (`https://search.mangwale.ai`). The API returns search results for items, stores, and categories.

---

## Base URL

```
https://search.mangwale.ai
```

---

## Response Structure

### Common Response Format

All search endpoints return responses in the following format:

```json
{
  "items": [...],      // Array of items
  "stores": [...],     // Array of stores
  "categories": [...],  // Array of categories
  "meta": {
    "total": 100,      // Total number of results
    "page": 1,         // Current page number
    "size": 20         // Number of results per page
  }
}
```

---

## Item Object Format

### Required Fields

```json
{
  "id": 123,                           // Integer - Item ID (REQUIRED)
  "name": "Item Name",                 // String - Item name (REQUIRED)
  "price": 99.99,                      // Number - Item price (REQUIRED)
  "store_id": 456,                     // Integer - Store ID (REQUIRED)
  "category_id": 789                   // Integer - Category ID (REQUIRED)
}
```

### Optional Fields

```json
{
  "description": "Item description",    // String - Item description
  "image": "image.jpg",                 // String - Image filename
  "image_full_url": "https://...",      // String - Full image URL (PREFERRED)
  "image_fallback_url": "https://...", // String - Fallback image URL
  "discount": 10.0,                     // Number - Discount amount
  "discount_type": "percent",           // String - "percent" or "amount"
  "tax": 5.0,                           // Number - Tax amount
  "veg": 1,                             // Integer - 1 for veg, 0 for non-veg
  "avg_rating": 4.5,                    // Number - Average rating (0-5)
  "rating_count": 50,                   // Integer - Number of ratings
  "order_count": 100,                   // Integer - Number of orders (alternative to rating_count)
  "module_id": 1,                       // Integer - Module ID
  "module_type": "food",                // String - Module type (e.g., "food", "grocery")
  "unit_type": "piece",                 // String - Unit type (e.g., "piece", "kg")
  "zone_id": 1,                         // Integer - Zone ID
  "store_name": "Store Name",           // String - Store name
  "distance_km": 2.5,                   // Number - Distance in kilometers
  "delivery_time": "30-45",             // String - Delivery time range in minutes
  "available_time_starts": "10:00",     // String - Start time in HH:mm format (PREFERRED)
  "available_time_ends": "22:00",       // String - End time in HH:mm format (PREFERRED)
  "available_date_starts": "2024-01-01" // String - Start date in YYYY-MM-DD format
}
```

### ⚠️ CRITICAL: Time Format for `available_time_starts` and `available_time_ends`

**The API MUST return time values in ONE of the following formats:**

#### Format 1: HH:mm (PREFERRED)
```json
{
  "available_time_starts": "10:00",
  "available_time_ends": "22:00"
}
```

#### Format 2: Milliseconds since midnight (ACCEPTED but will be converted)
```json
{
  "available_time_starts": "36000000",  // 10:00 AM (10 hours * 60 * 60 * 1000)
  "available_time_ends": "79200000"     // 10:00 PM (22 hours * 60 * 60 * 1000)
}
```

**Conversion Formula:**
- Milliseconds to HH:mm: `hours = (milliseconds / (1000 * 60 * 60)) % 24`
- Example: `36000000` milliseconds = `10:00` (10 hours)

**Note:** The app will automatically convert milliseconds to HH:mm format, but it's recommended to return HH:mm format directly from the API to avoid parsing overhead.

---

## Store Object Format

### Required Fields

```json
{
  "id": 456,                            // Integer - Store ID (REQUIRED)
  "name": "Store Name",                // String - Store name (REQUIRED)
  "minimum_order": 50.0                 // Number - Minimum order amount (REQUIRED)
}
```

### Optional Fields

```json
{
  "description": "Store description",  // String - Store description
  "image": "store.jpg",                 // String - Image filename
  "image_full_url": "https://...",      // String - Full image URL
  "cover_photo": "cover.jpg",           // String - Cover photo filename
  "cover_photo_full_url": "https://...", // String - Full cover photo URL
  "address": "Store Address",            // String - Store address
  "latitude": 28.6139,                  // Number - Latitude
  "longitude": 77.2090,                 // Number - Longitude
  "location": {                          // Object - Location coordinates
    "lat": 28.6139,
    "lon": 77.2090
  },
  "distance_km": 2.5,                   // Number - Distance in kilometers
  "avg_rating": 4.5,                     // Number - Average rating (0-5)
  "rating": 4.5,                        // Number - Alternative field for rating
  "rating_count": 50,                   // Integer - Number of ratings
  "order_count": 100,                   // Integer - Number of orders
  "open": 1,                             // Integer - 1 for open, 0 for closed
  "active": 1,                          // Integer - 1 for active, 0 for inactive
  "schedules": [                         // Array - Store opening hours per day (REQUIRED for "Opens at" / "Closes at" labels)
    {
      "id": 1,
      "store_id": 456,
      "day": 1,                          // Integer - 1=Monday, 2=Tuesday, ... 7=Sunday (app may use 0=Sunday in some configs)
      "opening_time": "10:00",           // String - HH:mm or HH:mm:ss (24-hour). Used for "Opens at" when store is closed
      "closing_time": "22:00"            // String - HH:mm or HH:mm:ss (24-hour). Used for "Closes at" when store is open
    }
  ],
  "featured": 1,                        // Integer - 1 for featured, 0 for not featured
  "veg": 1,                             // Integer - 1 for veg, 0 for non-veg
  "non_veg": 1,                         // Integer - 1 for non-veg, 0 for veg
  "tax": 5.0,                           // Number - Tax percentage
  "minimum_shipping_charge": 20.0,     // Number - Minimum shipping charge
  "maximum_shipping_charge": 50.0,     // Number - Maximum shipping charge
  "per_km_shipping_charge": 5.0,       // Number - Per kilometer shipping charge
  "self_delivery_system": 0,            // Integer - 1 for self-delivery, 0 for platform delivery
  "module_id": 1,                      // Integer - Module ID
  "zone_id": 1,                        // Integer - Zone ID
  "vendor_id": 123,                    // Integer - Vendor ID
  "total_items": 50,                    // Integer - Total number of items
  "item_count": 50,                     // Integer - Alternative field for total items
  "reviews_count": 25,                  // Integer - Number of reviews
  "extra_packaging_amount": 5.0,       // Number - Extra packaging charge
  "order_place_to_schedule_interval": 30 // Integer - Schedule interval in minutes
}
```

### Opening / Closing time display ("Opens at" / "Closes at")

To show the **"Closes at HH:MM AM/PM"** (red) or **"Opens at HH:MM AM/PM"** (green) label on store cards in search and home:

1. **Required fields**
   - `open` (integer): 1 = currently open, 0 = closed.
   - `active` (integer): 1 = store is active.
   - `schedules` (array): at least one object per day the store is open, each with:
     - `day` (integer): weekday (e.g. 1 = Monday … 7 = Sunday; confirm backend convention).
     - `opening_time` (string): time in **24-hour HH:mm** or HH:mm:ss (e.g. `"10:00"`, `"09:30"`).
     - `closing_time` (string): time in **24-hour HH:mm** or HH:mm:ss (e.g. `"22:00"`, `"03:00"` for 3 AM).

2. **Behaviour**
   - If the store is **open**: the app shows a **red** label **"Closes at {time}"** when closing is within the next hour (e.g. "Closes at 03:00 PM").
   - If the store is **closed**: the app shows a **green** label **"Opens at {time}"** for the next opening (e.g. "Opens at 06:30 PM").

3. **Example `schedules` for one day**
```json
"schedules": [
  { "id": 1, "store_id": 456, "day": 1, "opening_time": "09:00", "closing_time": "15:15" },
  { "id": 2, "store_id": 456, "day": 2, "opening_time": "09:00", "closing_time": "22:00" }
]
```

4. **Optional: pre-computed display (alternative)**  
   If the backend prefers to send a single display string instead of full schedules, it can add:
   - `operational_status_display` (string): e.g. `"Closes at 03:00 PM"` or `"Opens at 06:30 PM"`.
   - `operational_status_type` (string): `"closing"` (red) or `"opening"` (green).  
   The app currently derives the label from `schedules` + `open` + `active`; if you add these optional fields, the app can be extended later to use them when `schedules` is missing.

---

## Category Object Format

### Required Fields

```json
{
  "id": 789,                            // Integer - Category ID (REQUIRED)
  "name": "Category Name"               // String - Category name (REQUIRED)
}
```

### Optional Fields

```json
{
  "description": "Category description", // String - Category description
  "image": "category.jpg",              // String - Image filename
  "image_full_url": "https://...",      // String - Full image URL
  "parent_id": 0,                       // Integer - Parent category ID (0 for root)
  "position": 1,                        // Integer - Display position
  "status": 1,                         // Integer - 1 for active, 0 for inactive
  "module_id": 1,                      // Integer - Module ID
  "slug": "category-slug"               // String - Category slug
}
```

---

## Error Response Format

If an error occurs, the API should return:

```json
{
  "error": "Error message",
  "status": "error",
  "code": 400
}
```

---

## Field Type Guidelines

### Numbers
- **Integers**: Use integer type (e.g., `123`, not `"123"`)
- **Floats**: Use number type (e.g., `99.99`, not `"99.99"`)
- **Null values**: Use `null`, not `0` or empty string

### Strings
- **Non-nullable strings**: Always return a string, even if empty (`""`)
- **Nullable strings**: Use `null` if the value is not available

### Booleans
- **Use integers**: `1` for true, `0` for false
- **Alternative**: Use boolean type (`true`/`false`)

### Arrays
- **Empty arrays**: Return `[]`, not `null`
- **Null arrays**: Use `null` if the field is optional and not available

---

## Image URL Format

### Preferred Format
```json
{
  "image_full_url": "https://mangwale.s3.ap-south-1.amazonaws.com/product/image.jpg"
}
```

### Fallback Format
If `image_full_url` is not available, the app will construct the URL from the `image` filename:
```
https://mangwale.s3.ap-south-1.amazonaws.com/product/{image}
```

---

## Example Complete Response

```json
{
  "items": [
    {
      "id": 123,
      "name": "Pizza Margherita",
      "description": "Classic Italian pizza",
      "price": 299.99,
      "discount": 10.0,
      "discount_type": "percent",
      "image_full_url": "https://mangwale.s3.ap-south-1.amazonaws.com/product/pizza.jpg",
      "store_id": 456,
      "store_name": "Pizza Palace",
      "category_id": 789,
      "veg": 1,
      "avg_rating": 4.5,
      "rating_count": 50,
      "module_type": "food",
      "available_time_starts": "10:00",
      "available_time_ends": "22:00",
      "distance_km": 2.5,
      "delivery_time": "30-45"
    }
  ],
  "stores": [
    {
      "id": 456,
      "name": "Pizza Palace",
      "description": "Best pizza in town",
      "image_full_url": "https://mangwale.s3.ap-south-1.amazonaws.com/store/pizza-palace.jpg",
      "minimum_order": 50.0,
      "avg_rating": 4.5,
      "rating_count": 100,
      "open": 1,
      "distance_km": 2.5,
      "location": {
        "lat": 28.6139,
        "lon": 77.2090
      }
    }
  ],
  "categories": [
    {
      "id": 789,
      "name": "Pizza",
      "image_full_url": "https://mangwale.s3.ap-south-1.amazonaws.com/category/pizza.jpg"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "size": 20
  }
}
```

---

## Common Issues and Solutions

### Issue 1: FormatException when parsing time
**Error:** `FormatException: Trying to read : from 36000000 at 9`

**Cause:** The API is returning time in milliseconds instead of HH:mm format.

**Solution:** 
1. Return time in HH:mm format: `"10:00"` instead of `"36000000"`
2. OR the app will automatically convert, but HH:mm is preferred

### Issue 2: Null pointer exceptions
**Cause:** Required fields are missing or null.

**Solution:** Ensure all required fields are present and non-null.

### Issue 3: Image not displaying
**Cause:** Missing `image_full_url` or incorrect image path.

**Solution:** Always provide `image_full_url` with the complete URL.

---

## Testing Checklist

Before deploying the API, verify:

- [ ] All required fields are present
- [ ] Time fields are in HH:mm format (or milliseconds that can be converted)
- [ ] Image URLs are complete and accessible
- [ ] Numbers are proper numeric types (not strings)
- [ ] Null values use `null`, not `0` or empty strings
- [ ] Arrays are properly formatted
- [ ] Error responses follow the error format

---

## Support

For questions or issues with the API response format, please contact the development team.

**Last Updated:** 2024-01-XX
**Version:** 1.0

