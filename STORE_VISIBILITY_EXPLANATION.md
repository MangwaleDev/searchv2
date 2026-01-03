# Store Visibility Investigation - January 1, 2026

## Summary: Everything is Working Correctly ✅

The frontend is showing **exactly the right number of stores** (107). Here's why:

---

## The Numbers Explained

### MySQL Database (Source of Truth)
```
Total stores in database (module_id=4): 181 stores
├─ Stores WITH items: 139 stores
└─ Stores WITHOUT items: 42 stores (empty stores, not searchable)
```

### OpenSearch Index (food_stores_v6)
```
Total indexed: 139 stores (all stores that have items)
├─ Active + Approved (status=1, active=1): 107 stores ✅ SHOWN TO USERS
├─ Inactive (status=0, active=1): 14 stores ❌ HIDDEN
├─ Not Approved (status=1, active=0): 13 stores ❌ HIDDEN
└─ Inactive + Not Approved (status=0, active=0): 5 stores ❌ HIDDEN
```

### Frontend Display
```
Stores shown to users: 107 stores ✅ CORRECT
```

---

## Why 107 Stores (Not 139)?

The system is **intentionally hiding 32 stores** from users because:

1. **14 stores have status=0** (Inactive/Closed restaurants)
2. **13 stores have active=0** (Not approved by admin)
3. **5 stores have both status=0 AND active=0** (Inactive & not approved)

These stores are **indexed in OpenSearch** but **filtered out by the API** to show only operational, approved restaurants.

---

## Status Field Meanings

### status (Business Operations)
- **status=1**: Restaurant is ACTIVE/OPEN for business
- **status=0**: Restaurant is INACTIVE/CLOSED (temporarily or permanently)

### active (Admin Approval)
- **active=1**: Restaurant is APPROVED by admin/system
- **active=0**: Restaurant is NOT APPROVED (pending review, rejected, or suspended)

### Visibility Logic
```
VISIBLE to users = status=1 AND active=1
HIDDEN from users = status=0 OR active=0
```

---

## Examples of Hidden Stores

Here are some stores that are indexed but NOT shown to users:

**Store ID 57**: RK Chinese And Chat Corner (status=0, active=0)
**Store ID 127**: ZORKO - BRAND OF FOOD LOVERS (status=0, active=0)
**Store ID 150**: Raja Burger (status=0, active=0)
**Store ID 163**: Mai Food Station (status=0, active=0)
**Store ID 175**: Spicy Corner Cafe & Restaurant (status=0, active=0)

These stores exist in the database and are indexed, but are deliberately hidden because they are either inactive or not approved.

---

## Verification Steps Taken

✅ **Checked MySQL**: 139 stores with items, 107 are status=1 AND active=1
✅ **Checked OpenSearch**: 139 stores indexed in food_stores_v6
✅ **Checked API filtering**: Correctly filters to show only 107 active+approved stores
✅ **Checked Frontend endpoint**: `/v2/search/stores` returns 107 stores
✅ **Verified hidden stores**: 32 stores are indexed but hidden (14+13+5)

---

## How to Make Hidden Stores Visible

If you want to activate any of these hidden stores:

### Option 1: Activate Inactive Store
```sql
-- Make store active
UPDATE stores SET status = 1 WHERE id = 127;
```

### Option 2: Approve Non-Approved Store
```sql
-- Make store approved
UPDATE stores SET active = 1 WHERE id = 127;
```

### Option 3: Fully Activate Store
```sql
-- Make store both active AND approved
UPDATE stores SET status = 1, active = 1 WHERE id = 127;
```

**After updating MySQL:**
```bash
# Reindex stores to reflect changes in search
docker exec 6e52d399eeb1_search-embedding-service bash -c \
  "cd /tmp && OPENSEARCH_URL='http://search-opensearch:9200' python3 sync-stores-v6.py"
```

---

## To Show ALL Stores (Including Inactive/Non-Approved)

If you want the frontend to show **all 139 stores** (including inactive and non-approved), you need to:

### Option A: Remove Status Filtering (Show All)

**File:** `apps/search-api/src/search/search.service.ts`

**Remove these lines from `searchStoresByModule` method (~line 6277):**
```typescript
// REMOVE THESE:
filterClauses.push({ term: { status: 1 } });
filterClauses.push({ term: { active: 1 } });
```

**Result:** API will return all 139 stores regardless of status

### Option B: Add Query Parameter (Conditional Filtering)

**Better approach:** Add optional `show_all` parameter:

```typescript
// In searchStoresByModule method, around line 6277:

// Only filter by status if show_all is not true
if (filters?.show_all !== 'true' && filters?.show_all !== true) {
  filterClauses.push({ term: { status: 1 } });
  filterClauses.push({ term: { active: 1 } });
  this.logger.debug(`[searchStoresByModule] Applied status=1, active=1 filter`);
} else {
  this.logger.debug(`[searchStoresByModule] show_all=true, showing all stores`);
}
```

**Usage:**
```
Normal users: /v2/search/stores?module_id=4  → Returns 107 stores
Admin view:   /v2/search/stores?module_id=4&show_all=true  → Returns 139 stores
```

---

## Current System Behavior ✅

| Endpoint | Stores Returned | Status Filter | Who Should Use |
|----------|----------------|---------------|----------------|
| `/v2/search/stores?module_id=4` | 107 | status=1, active=1 | **End Users** (Customers) |
| `/search/food/stores` | 107 | status=1, active=1 | **End Users** (Customers) |
| Direct OpenSearch query | 139 | No filter | **Admins/Developers** |

---

## Conclusion

**The system is working CORRECTLY.** The frontend shows 107 stores because:

1. ✅ **139 stores are fully indexed** (all stores with items from MySQL)
2. ✅ **32 stores are intentionally hidden** (inactive or not approved)
3. ✅ **107 active+approved stores are shown** to users
4. ✅ **All API endpoints are filtering correctly**

If you want to see more stores on the frontend, you need to either:
- **Activate the hidden stores in MySQL** (update status=1, active=1)
- **Remove the status filtering** from the API (not recommended for production)
- **Add a "show all" mode** for admins (recommended approach)

---

## Quick Check Command

To verify everything at any time:
```bash
echo "MySQL WITH items: $(mysql -h 103.86.176.59 -u root -proot_password mangwale_db -N -e 'SELECT COUNT(DISTINCT s.id) FROM stores s INNER JOIN items i ON s.id = i.store_id WHERE s.module_id = 4;' 2>/dev/null)"

echo "OpenSearch indexed: $(docker exec search-api wget -qO- 'http://search-opensearch:9200/food_stores_v6/_count' 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin)[\"count\"])')"

echo "API returns: $(docker run --rm --network search_search-network curlimages/curl:latest -s 'http://search-api:3100/v2/search/stores?module_id=4&size=1' | python3 -c 'import sys,json; print(json.load(sys.stdin)[\"meta\"][\"total\"])')"
```

**Expected output:**
```
MySQL WITH items: 139
OpenSearch indexed: 139
API returns: 107
```

This means: **All stores are indexed, but only active+approved ones are shown to users.** ✅
