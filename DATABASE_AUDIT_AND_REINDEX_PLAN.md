# MySQL Database Complete Audit & Reindexing Plan

**Date**: December 30, 2025  
**Status**: 🔴 CRITICAL - Store/Item timing data NOT indexed in OpenSearch

---

## 1. DATABASE SCHEMA AUDIT

### Core Tables Analysis

#### **stores** (71 fields total)
**Key Fields for Search:**
- `id`, `name`, `phone`, `email`, `logo`, `cover_photo`
- `latitude`, `longitude`, `address` ← GEO SEARCH
- `zone_id` ← ZONE FILTERING
- `module_id` ← MODULE FILTERING (Food/Ecom)
- `status`, `active` ← AVAILABILITY
- `delivery_time` (e.g., "30-40 min") ← DELIVERY ETA
- `off_day` (0-6, Sunday-Saturday) ← ⚠️ **NOT INDEXED**
- `veg`, `non_veg` ← VEG FILTER
- `order_count`, `total_order` ← POPULARITY
- `featured` ← FEATURED STORES
- `slug` ← SEO
- `rating` ← QUALITY SCORE
- `minimum_order`, `free_delivery` ← FILTERS
- `delivery`, `take_away` ← SERVICE TYPES

**⚠️ MISSING FROM OPENSEARCH:**
- `off_day` - Day when store is closed
- Relationship with `store_schedule` table

#### **store_schedule** (7 fields)
**⚠️ NOT INDEXED AT ALL IN OPENSEARCH**
```sql
CREATE TABLE `store_schedule` (
  `id` bigint UNSIGNED NOT NULL,
  `store_id` bigint UNSIGNED NOT NULL,
  `day` int NOT NULL,  -- 0=Sunday, 1=Monday, ..., 6=Saturday
  `opening_time` time DEFAULT NULL,  -- e.g., "09:00:00"
  `closing_time` time DEFAULT NULL,  -- e.g., "22:00:00"
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Example Data:**
- Store ID 1: Tuesday (day=2) → 00:00:00 to 23:59:59 (24/7)
- Store ID 8: Friday (day=5) → 09:00:00 to 19:00:59
- Store ID 8: Saturday (day=6) → 09:00:00 to 21:00:59
- Store ID 219: Monday (day=1) → 11:30:00 to 23:00:00

**Usage:** Restaurants have day-wise different timings. Need to:
1. Fetch all 7 days of schedule per store
2. Index as nested array in OpenSearch
3. Calculate real-time open/closed status based on IST time & current day

#### **items** (40 fields total)
**Key Fields for Search:**
- `id`, `name`, `description`, `image`
- `store_id` ← BELONGS TO STORE
- `category_id`, `category_ids` ← CATEGORY
- `module_id` ← MODULE (Food/Ecom)
- `price`, `tax`, `discount` ← PRICING
- `veg`, `status` ← FILTERS
- `available_time_starts` time ← ⚠️ **INDEXED BUT NOT USED**
- `available_time_ends` time ← ⚠️ **INDEXED BUT NOT USED**
- `order_count`, `avg_rating`, `rating_count` ← POPULARITY
- `variations`, `add_ons` ← CUSTOMIZATION
- `stock` ← INVENTORY

**⚠️ CURRENTLY INDEXED BUT NOT UTILIZED:**
- `available_time_starts` - When item is available (e.g., "06:00:00" for breakfast)
- `available_time_ends` - When item stops being available (e.g., "11:00:00")

**Use Case:** Some items only available at specific times:
- Breakfast items: 6 AM - 10 AM
- Lunch specials: 12 PM - 3 PM  
- Dinner items: 7 PM - 11 PM

#### **categories** (13 fields)
**All Properly Indexed:**
- `id`, `name`, `image`, `slug`
- `module_id` ← MODULE FILTERING
- `parent_id` ← HIERARCHY
- `position`, `priority` ← ORDERING
- `status`, `featured` ← FILTERS

#### **modules** (12 fields)
**Properly Tracked:**
- `id=4` → Food
- `id=6` → Ecom/Shopping
- Other modules: Pharmacy, Parcel, etc.

---

## 2. CURRENT STATE ANALYSIS

### What's CORRECTLY Indexed in OpenSearch

#### food_items index:
✅ Basic item data (name, description, price)
✅ Store relationship (store_id, store_name)
✅ Location (store_location as geo_point)
✅ Category data
✅ `available_time_starts` and `available_time_ends` (BUT NOT USED IN QUERIES)
✅ Popularity metrics (order_count, avg_rating)

#### food_stores / ecom_stores indices:
✅ Basic store data (name, address, phone)
✅ Location (geo_point for lat/lon)
✅ Module ID
✅ Order count, ratings

### What's MISSING ⚠️

#### food_stores / ecom_stores:
❌ `store_schedule` data (day-wise opening/closing times)
❌ `off_day` field
❌ Real-time open/closed calculation not possible

#### food_items:
❌ Not using `available_time_starts/ends` for filtering/sorting
❌ No time-based relevance boosting (breakfast items in morning, etc.)

---

## 3. PROBLEMS CAUSED

### User Experience Issues:
1. **All stores showing generic timing** (hardcoded 10 AM - 10 PM)
2. **Incorrect open/closed status** - stores may actually have different hours
3. **Items showing when not available** - breakfast items at dinner time
4. **Store suggestions not considering timing** - closed stores suggested first

### Business Impact:
- Users clicking on closed stores → Bad UX
- Items ordered when not available → Order cancellations
- No time-of-day relevance → Lower conversion

---

## 4. SOLUTION ARCHITECTURE

### Phase 1: Quick Fix (MySQL Direct Query) ✅ IMPLEMENT FIRST
**Timeline:** 2-3 hours

1. **Add MySQL Connection to search-api**
   - Inject MySQL pool into SearchService
   - Query `store_schedule` table when needed
   - Cache results in Redis (30 min TTL)

2. **Update Timing Calculation Logic**
   - Fetch store_schedule for store IDs
   - Calculate open/closed based on current IST day & time
   - Use actual opening/closing hours instead of hardcoded 10-22

3. **Deploy**
   - Rebuild search-api container
   - Test with stores that have schedules

**Files to Modify:**
- `apps/search-api/src/search/search.service.ts`
- `apps/search-api/src/search/search.module.ts`
- `docker-compose.yml` (add MYSQL_* env vars if needed)

### Phase 2: Proper Reindexing (Update Embedding Service) 🎯 PROPER FIX
**Timeline:** 1-2 days

1. **Update Sync Scripts**
   - Modify `scripts/sync-mysql-complete.py`
   - Modify `scripts/sync-production-data.py`
   - Add JOIN with `store_schedule` table
   - Index as nested field in OpenSearch

2. **Update OpenSearch Mappings**
   ```json
   "schedule": {
     "type": "nested",
     "properties": {
       "day": {"type": "integer"},
       "opening_time": {"type": "keyword"},
       "closing_time": {"type": "keyword"}
     }
   },
   "off_day": {"type": "integer"}
   ```

3. **Reindex All Data**
   ```bash
   cd /home/ubuntu/Devs/Search
   ./scripts/reindex-all.sh
   ```

4. **Update Search Queries**
   - Use indexed schedule data instead of MySQL
   - Add time-based filters
   - Boost items by availability time

### Phase 3: CDC Pipeline (Real-time Sync) 🔄 FUTURE
**Timeline:** 3-5 days

1. **MySQL Binlog CDC**
   - Enable MySQL binlog
   - Use Debezium or custom CDC service
   - Watch tables: `stores`, `store_schedule`, `items`

2. **CDC Service Architecture**
   ```
   MySQL Binlog → CDC Service → Message Queue (Redis Streams)
                                      ↓
                              search-api consumes
                                      ↓
                           Update OpenSearch indices
   ```

3. **Implementation Options:**
   
   **Option A: Debezium + Kafka**
   - Most robust, industry standard
   - Complex setup
   
   **Option B: Custom Node.js CDC** (RECOMMENDED)
   - Use `mysql-events` or `zongji` npm packages
   - Listen to binlog events
   - Publish to Redis Streams
   - search-api consumer updates OpenSearch
   
   **Option C: Polling** (Simplest)
   - Cron job every 5 minutes
   - Query `updated_at` timestamps
   - Sync changed records

4. **Files to Create:**
   - `apps/cdc-service/` (new microservice)
   - `apps/cdc-service/src/main.ts`
   - `apps/cdc-service/src/mysql-watcher.ts`
   - `apps/cdc-service/src/opensearch-sync.ts`

---

## 5. RECOMMENDED IMPLEMENTATION ORDER

### Week 1: Critical Fixes
- [ ] **Day 1**: Implement Phase 1 (MySQL direct query)
- [ ] **Day 2**: Test and verify timing accuracy
- [ ] **Day 3**: Update sync scripts (Phase 2 prep)

### Week 2: Proper Architecture  
- [ ] **Day 1-2**: Reindex with store_schedule data
- [ ] **Day 3-4**: Test and optimize queries
- [ ] **Day 5**: Deploy to production

### Week 3: Real-time Sync
- [ ] **Day 1-3**: Build CDC service (Option B)
- [ ] **Day 4-5**: Test and deploy

---

## 6. IMMEDIATE ACTION ITEMS

### Today (Dec 30):
1. ✅ Complete database audit (THIS DOCUMENT)
2. ⏳ Add MySQL connection to search-api
3. ⏳ Update `getStoreTimingStatus()` to query database
4. ⏳ Test with real data
5. ⏳ Deploy and verify

### Tomorrow (Dec 31):
1. Update sync scripts with store_schedule
2. Add item time-based filtering
3. Test reindexing locally

### Jan 2:
1. Production reindex
2. Monitor performance
3. Plan CDC pipeline

---

## 7. TESTING CHECKLIST

### Before Deployment:
- [ ] Test store with schedule data (e.g., store_id 219)
- [ ] Test store without schedule (should use defaults)
- [ ] Test off_day field handling
- [ ] Test different days of week
- [ ] Test boundary times (just before/after opening/closing)
- [ ] Test IST timezone calculation
- [ ] Load test with 100+ concurrent requests

### After Deployment:
- [ ] Verify API response has correct timing_status
- [ ] Check frontend displays timing badges
- [ ] Test store navigation
- [ ] Monitor error logs
- [ ] Check Redis cache effectiveness
- [ ] Measure query performance impact

---

## 8. PERFORMANCE CONSIDERATIONS

### MySQL Query Impact:
- **Current**: 0 MySQL queries per search
- **Phase 1**: 1 MySQL query per search (for store schedules)
- **With Redis Cache**: ~90% cache hit rate expected
- **Expected Latency**: +20-30ms without cache, +2ms with cache

### Optimization Strategies:
1. Redis caching (30 min TTL)
2. Batch fetch schedules for all stores in result
3. Connection pooling (already configured)
4. Consider materialized view in MySQL

### Phase 2 Performance:
- **No MySQL queries** - all data in OpenSearch
- **Faster**: Direct index lookup
- **Better**: Time-based scoring and filtering

---

## 9. ROLLBACK PLAN

If Phase 1 causes issues:

1. **Immediate Rollback:**
   ```bash
   git revert <commit-hash>
   docker-compose build search-api
   docker-compose restart search-api
   ```

2. **Gradual Rollback:**
   - Add feature flag: `ENABLE_REAL_STORE_TIMING=false`
   - Fall back to hardcoded timings
   - Fix issues, then re-enable

---

## 10. MONITORING & ALERTS

### Metrics to Track:
- Search API response time (P50, P95, P99)
- MySQL connection pool utilization
- Redis cache hit rate
- Error rate for store timing calculation
- User engagement with timing feature

### Alerts:
- Response time > 500ms
- MySQL connection failures
- Redis unavailable
- Error rate > 1%

---

## APPENDIX A: Sample Queries

### Fetch Store Schedule:
```sql
SELECT store_id, day, opening_time, closing_time 
FROM store_schedule 
WHERE store_id IN (1, 3, 13, 219);
```

### Find Stores Open Now (IST):
```sql
SELECT s.id, s.name, ss.opening_time, ss.closing_time
FROM stores s
JOIN store_schedule ss ON s.id = ss.store_id
WHERE s.status = 1
  AND ss.day = DAYOFWEEK(CONVERT_TZ(NOW(), '+00:00', '+05:30')) - 1
  AND CURTIME() BETWEEN ss.opening_time AND ss.closing_time;
```

### Find Items Available Now:
```sql
SELECT i.id, i.name, i.available_time_starts, i.available_time_ends
FROM items i
WHERE i.status = 1
  AND (
    i.available_time_starts IS NULL 
    OR CURTIME() BETWEEN i.available_time_starts AND i.available_time_ends
  );
```

---

**Next Steps:** Proceed with Phase 1 implementation immediately.
