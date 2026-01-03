# Architecture Analysis & Strategic Questions

**Date:** January 1, 2026  
**Issue Found:** Hari Om Dhaba shows in Restaurants tab but 0 items in Dishes tab

---

## Current Issue: Hari Om Dhaba

### Problem
- **Store ID:** 42
- **Store Status:** status=0 (INACTIVE), active=1 (APPROVED)
- **Items:** 277 items exist BUT **is_visible=0** (all hidden)
- **Result:** Store appears in search (when we disable status filter) but NO items show

### Root Cause
Items have `is_visible=0` which means they're not indexed or filtered out by the API.

---

## Your Architecture (What I Discovered)

### 1. Module System
```
module_id | module_name       | module_type | stores_count | status
----------|-------------------|-------------|--------------|--------
4         | Food              | food        | 228          | ACTIVE
5         | Shop              | ecommerce   | 54           | ACTIVE
3         | Local Delivery    | parcel      | 0            | ACTIVE
```

### 2. Zone System
```
Nashik has 7 zones:
- Zone 4: Nashik New (ACTIVE)
- Zone 7: Nashik - Road Jailroad (INACTIVE)
- Zone 8: Nashik - Collage Road (INACTIVE)
- Zone 9: Nashik - Satpur (INACTIVE)
- Zone 10: Nashik - Cidco (INACTIVE)
- Zone 11: Nashik - RTO (INACTIVE)
- Zone 12: Nashik - Panchvati (INACTIVE)
```

### 3. Current Reality
```
All 181 food stores are in Zone 4 (Nashik New)
module_id=4 + zone_id=4 = 181 stores
```

### 4. Module-Zone Relationship
- **module_zone table** defines which modules serve which zones
- **Module 4 (Food)** is configured for:
  - Zone 2 (some other zone)
  - Zone 4 (Nashik New) ← YOUR ACTIVE ZONE

---

## Strategic Questions for You

### Question 1: Zone Expansion Intent
**Right now all food stores are in Zone 4. Do you plan to expand?**

**Scenario A:** Expand to multiple zones in Nashik
```
Zone 4: Nashik New (current)
Zone 7: Road Jailroad (expand here?)
Zone 10: Cidco (expand here?)
Zone 12: Panchvati (expand here?)
```

**Scenario B:** Stay with Zone 4 only
- Keep all stores in Zone 4
- Ignore other zones for now

**My Recommendation:** If planning expansion, we need smart zone-aware indexing NOW.

---

### Question 2: Items Across Stores
**You said: "items in all zones can be similar but only displaying them would be different"**

**What this means:**
1. **Same restaurant, different zones** = Different store_ids with similar menus?
   - Example: "Pizza Hut Zone 4" (store_id=100) vs "Pizza Hut Zone 7" (store_id=200)
   - Both have similar items but different prices/availability?

2. **Different restaurants, similar items** = Many stores selling "Paneer Butter Masala"
   - Search "paneer butter masala" → Show ALL stores that have it
   - Filter by zone to show nearby stores only?

**Which scenario applies to you?**

---

### Question 3: Pricing & Availability
**You said: "which store has which items that important with their pricing"**

**Current MySQL Structure:**
```sql
items table:
- id, store_id, name, price, status, is_visible, is_approved
```

**Questions:**
1. Does the **same item** have **different prices** in different zones?
   - Example: Paneer Tikka = ₹250 in Zone 4, ₹280 in Zone 7?

2. Does the **same restaurant** in different zones have **different menus**?
   - Example: Store 42 in Zone 4 has 277 items
   - If Store 42 also operates in Zone 7, do they have different items?

3. **Store-Item-Zone relationship:**
   - Is it: `store → items` (current, 1:N)
   - Or: `store → zone → items` (future, M:N with zone context)

---

### Question 4: Search Behavior
**When a user searches "biryani" in Zone 4:**

**Option A: Show only Zone 4 results** (Location-based)
```
User in Zone 4 → See only Zone 4 stores
User in Zone 7 → See only Zone 7 stores
```

**Option B: Show all zones, sort by distance** (Distance-based)
```
User in Zone 4 → See ALL zones, nearest first
User can order from Zone 7 if willing to pay delivery
```

**Option C: Show zone + nearby zones** (Hybrid)
```
User in Zone 4 → See Zone 4 + adjacent zones
Filter by delivery radius (e.g., 5km)
```

**Which behavior do you want?**

---

### Question 5: Data Segregation Strategy
**Current OpenSearch Index:**
```
food_items_v4: 9,389 items (ALL zones mixed)
food_stores_v6: 139 stores (ALL zones mixed)
```

**Option A: Single Index with zone filtering** (Current, simpler)
```
- One food_items_v4 index for all zones
- Filter by zone_id at query time
- PRO: Easy to search across zones
- CON: May get slower with more zones
```

**Option B: Zone-specific indices** (Complex, scalable)
```
- food_items_zone4: Items for Zone 4
- food_items_zone7: Items for Zone 7
- PRO: Faster per-zone searches
- CON: Can't easily search across zones
```

**Option C: Module-Zone indices** (Smart, recommended)
```
- food_zone4_items: Food items in Zone 4
- food_zone7_items: Food items in Zone 7
- ecom_zone4_items: Ecom items in Zone 4
- PRO: Clean separation, module + zone aware
- CON: More indices to manage
```

**Which strategy fits your growth plan?**

---

### Question 6: Smart Indexing Approach
**You mentioned "can we do something smart here"**

**Smart Option 1: Hierarchical Indexing**
```
Level 1: Module (food, ecom, parcel)
Level 2: Zone (nashik_new, nashik_rto, etc)
Level 3: Store → Items

Search flow:
1. Identify user's module (food)
2. Identify user's zone (zone 4)
3. Search in food_zone4_items index
4. Optional: Expand to nearby zones if needed
```

**Smart Option 2: Unified Index with Smart Filtering**
```
Single index: all_items_v4
Fields:
- module_id, zone_id, store_id, price
- location (geo_point)
- availability_zones (array)

Search flow:
1. Filter by module_id
2. Filter by user's zone_id OR nearby zones
3. Sort by distance
4. Show items with store context
```

**Smart Option 3: Store-Centric with Item Denormalization**
```
Index: food_stores_v6
Each store document contains:
- store_id, name, zone_id
- top_items: [embedded popular items]
- total_items_count

Separate index: food_items_v4
- Full item details
- Links back to store

Search flow:
1. Search stores first (fast)
2. Load items for selected stores (lazy load)
```

---

## My Recommendations

### For Immediate Fix (Hari Om Dhaba Issue)
```sql
-- Option 1: Activate the store
UPDATE stores SET status = 1 WHERE id = 42;

-- Option 2: Make items visible
UPDATE items SET is_visible = 1 WHERE store_id = 42;

-- Then reindex
```

### For Long-term Architecture

**If staying single zone (Zone 4):**
- ✅ Keep current single index approach
- ✅ Add zone_id filtering (already have it)
- ✅ Focus on item visibility and store status
- ✅ Simple and fast

**If expanding to multiple zones:**
- ✅ **Recommended:** Smart Option 2 (Unified index with smart filtering)
- ✅ Add `zone_id` to OpenSearch documents
- ✅ Add `nearby_zones` field (e.g., Zone 4 can also serve Zone 7)
- ✅ Filter at query time based on user's location
- ✅ Show all results but sort by:
  1. Same zone (boost 3x)
  2. Adjacent zones (boost 1.5x)
  3. Distance (geo_distance)
  4. Popularity (order_count)

**If planning complex multi-zone operations:**
- ✅ Module-Zone specific indices (Smart Option 3)
- ✅ Separate indices per module-zone combination
- ✅ Alias for cross-zone searching
- ✅ Best for scale (1000+ stores per zone)

---

## Questions I Need Answers To:

1. **Expansion Plan:** Will you expand to multiple zones soon?

2. **Store Duplication:** Can the same restaurant (e.g., "Pizza Hut") exist in multiple zones with different store_ids?

3. **Pricing Model:** Does the same item have different prices in different zones?

4. **Search Scope:** Should search show only current zone OR all zones sorted by distance?

5. **Item Visibility:** Why are items hidden (is_visible=0)? Is this intentional or data quality issue?

6. **Zone Strategy:** Are zones for delivery logistics only OR also for content/pricing segregation?

7. **Scale Estimate:** How many:
   - Zones do you expect? (7 now, how many in 1 year?)
   - Stores per zone? (181 in Zone 4, similar for others?)
   - Items per store? (avg 100-300?)

---

## Next Steps (Waiting for Your Answers)

**After you answer these questions, I'll:**
1. Design the optimal indexing strategy
2. Implement smart zone-aware search
3. Fix the Hari Om Dhaba visibility issue
4. Optimize for your specific use case
5. Create a scalable solution for future growth

**Let's discuss this step by step!**
