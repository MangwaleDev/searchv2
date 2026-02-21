# Opening/Closing Time - API Response Format (Implemented)

This document describes the response format for **items** and **stores** with opening/closing times, as implemented per `SEARCH_API_RESPONSE_FORMAT.md`.

---

## Item Response (with available times)

Items now include `available_time_starts` and `available_time_ends` in **HH:mm** format:

```json
{
  "id": 123,
  "name": "Pizza Margherita",
  "price": 299.99,
  "store_id": 456,
  "store_name": "Pizza Palace",
  "category_id": 789,
  "image_full_url": "https://...",
  "veg": 1,
  "avg_rating": 4.5,
  "available_time_starts": "10:00",
  "available_time_ends": "22:00",
  "delivery_time": "30-45"
}
```

- **available_time_starts**: Start time in HH:mm (24-hour)
- **available_time_ends**: End time in HH:mm (24-hour)
- Values are converted from milliseconds (if stored in index) to HH:mm before returning

---

## Store Response (with schedules & open status)

Stores now include `open`, `active`, and `schedules` for "Opens at" / "Closes at" labels:

```json
{
  "id": 456,
  "name": "Pizza Palace",
  "minimum_order": 50.0,
  "image_full_url": "https://...",
  "cover_photo_full_url": "https://...",
  "address": "123 Main St",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "location": { "lat": 28.6139, "lon": 77.2090 },
  "avg_rating": 4.5,
  "rating_count": 100,
  "delivery_time": "30-45",
  "open": 1,
  "active": 1,
  "schedules": [
    { "id": 1, "store_id": 456, "day": 1, "opening_time": "09:00", "closing_time": "15:15" },
    { "id": 2, "store_id": 456, "day": 2, "opening_time": "09:00", "closing_time": "22:00" },
    { "id": 3, "store_id": 456, "day": 3, "opening_time": "09:00", "closing_time": "22:00" },
    { "id": 4, "store_id": 456, "day": 4, "opening_time": "09:00", "closing_time": "22:00" },
    { "id": 5, "store_id": 456, "day": 5, "opening_time": "09:00", "closing_time": "22:00" },
    { "id": 6, "store_id": 456, "day": 6, "opening_time": "09:00", "closing_time": "22:00" },
    { "id": 7, "store_id": 456, "day": 7, "opening_time": "10:00", "closing_time": "22:00" }
  ],
  "timing_status": "open",
  "timing_message": "Closes at 10:00 PM",
  "is_open": true,
  "minutes_until_closing": 45
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| **open** | integer | 1 = currently open, 0 = closed |
| **active** | integer | 1 = store is active |
| **schedules** | array | Opening hours per day (required for "Opens at" / "Closes at" labels) |
| **schedules[].day** | integer | 1=Monday, 2=Tuesday, ..., 7=Sunday |
| **schedules[].opening_time** | string | HH:mm (24-hour), e.g. "09:00" |
| **schedules[].closing_time** | string | HH:mm (24-hour), e.g. "22:00" |
| **timing_status** | string | "open", "closing_soon", "closed" |
| **timing_message** | string | e.g. "Closes at 10:00 PM" or "Opens at 06:30 PM" |
| **is_open** | boolean | Same as open (for backward compatibility) |

### App Display Logic

- **Store open**: Show red label "Closes at {time}" when closing within next hour
- **Store closed**: Show green label "Opens at {time}" for next opening

---

## Endpoints Updated

1. **searchWithStoreBoosting** (unified search) – items + stores
2. **searchStoresByModule** – stores list
3. **suggestByModule** – suggestions (items + stores)
4. **search** (cached) – recalculates `open` on cache hit

---

## Database Requirements

- **store_schedule** table with: `id`, `store_id`, `day`, `opening_time`, `closing_time`
- **items** table: `available_time_starts`, `available_time_ends` (TIME or milliseconds)

---

## Reindex Note

Run reindex to ensure items have correct time format in OpenSearch:

```bash
node scripts/reindex-mysql-to-opensearch.js --module all
```

The reindex now stores `available_time_starts`/`available_time_ends` as HH:mm string when MySQL returns TIME, or as number (milliseconds) when applicable.
