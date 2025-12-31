# Store Timing Analysis

## Current State

### Database Investigation ✅
- **Stores table** does NOT have `opening_time` or `closing_time` columns
- **No separate `store_schedule` table** found
- Only time-related field: `delivery_time` (e.g., "35-45 min", "1-2 hours")

### What We Have:
```sql
CREATE TABLE `stores` (
  ...
  `delivery_time` varchar(100) DEFAULT '30-40',
  `off_day` varchar(191) DEFAULT ' ',
  ...
)
```

### What We Need:
- Store opening hours
- Store closing hours
- Day-wise schedule (Monday-Sunday)
- Holiday/off-day handling

## Solutions

### Option 1: **Add Store Schedule to Database** ⭐ RECOMMENDED
```sql
CREATE TABLE `store_schedule` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id` bigint UNSIGNED NOT NULL,
  `day` tinyint NOT NULL COMMENT '0=Sunday, 1=Monday, ... 6=Saturday',
  `opening_time` TIME NOT NULL,
  `closing_time` TIME NOT NULL,
  `is_closed` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `store_id` (`store_id`),
  CONSTRAINT `store_schedule_store_id_foreign` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE
);

-- Default timing for all existing stores (10 AM - 10 PM)
INSERT INTO `store_schedule` (`store_id`, `day`, `opening_time`, `closing_time`)
SELECT id, 0, '10:00:00', '22:00:00' FROM stores WHERE active=1
UNION ALL
SELECT id, 1, '10:00:00', '22:00:00' FROM stores WHERE active=1
UNION ALL
SELECT id, 2, '10:00:00', '22:00:00' FROM stores WHERE active=1
UNION ALL
SELECT id, 3, '10:00:00', '22:00:00' FROM stores WHERE active=1
UNION ALL
SELECT id, 4, '10:00:00', '22:00:00' FROM stores WHERE active=1
UNION ALL
SELECT id, 5, '10:00:00', '22:00:00' FROM stores WHERE active=1
UNION ALL
SELECT id, 6, '10:00:00', '22:00:00' FROM stores WHERE active=1;
```

### Option 2: **Add Columns to Stores Table** (Simpler but less flexible)
```sql
ALTER TABLE `stores`
ADD COLUMN `opening_time` TIME DEFAULT '10:00:00',
ADD COLUMN `closing_time` TIME DEFAULT '22:00:00';
```

### Option 3: **Use Default Hours + Calculate Status** (Quick fix for now)
Use typical restaurant hours and calculate status on frontend/backend:
- **Breakfast places**: 7 AM - 12 PM
- **Lunch/Dinner**: 11 AM - 11 PM
- **24x7 stores**: Always open
- **Default**: 10 AM - 10 PM

## Implementation Plan

### Phase 1: Quick Fix (TODAY) ✅
**Without database changes**, add calculated status:

```typescript
// Backend: search.service.ts
function getStoreTimingStatus(store: any) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Default hours: 10 AM - 10 PM
  const opening = 10;  // 10 AM
  const closing = 22;   // 10 PM
  
  // Check if store is open
  const isOpen = currentHour >= opening && currentHour < closing;
  
  if (!isOpen) {
    if (currentHour < opening) {
      return {
        status: 'closed',
        message: `Opens at ${opening}:00 AM`
      };
    } else {
      return {
        status: 'closed',
        message: 'Closed'
      };
    }
  }
  
  // Calculate minutes until closing
  const minutesUntilClosing = (closing - currentHour) * 60 - currentMinute;
  
  if (minutesUntilClosing <= 30) {
    return {
      status: 'closing_soon',
      message: `Closing in ${minutesUntilClosing} min`,
      minutesRemaining: minutesUntilClosing
    };
  } else if (minutesUntilClosing <= 60) {
    return {
      status: 'closing_soon',
      message: `Closes at ${closing}:00 PM`,
      minutesRemaining: minutesUntilClosing
    };
  } else {
    return {
      status: 'open',
      message: `Open until ${closing}:00 PM`,
      minutesRemaining: minutesUntilClosing
    };
  }
}
```

### Phase 2: Database Schema (WEEK 2)
1. Create `store_schedule` table
2. Add migration script
3. Sync from OpenSearch
4. Update API to fetch from database

### Phase 3: UI Enhancement (WEEK 2)
1. Show "⏰ Closing in 10 min" badge
2. Add countdown timer
3. Gray out closed stores
4. Show opening time for closed stores

## UI Examples

### StoreCard Enhancement
```typescript
<StoreCard>
  {store.timing_status === 'closing_soon' && (
    <div className="timing-badge warning">
      ⏰ Closing in {store.minutes_remaining} min
    </div>
  )}
  
  {store.timing_status === 'open' && (
    <div className="timing-badge success">
      ✅ Open until {store.closing_time}
    </div>
  )}
  
  {store.timing_status === 'closed' && (
    <div className="timing-badge closed">
      🔒 {store.timing_message}
    </div>
  )}
</StoreCard>
```

## Industry Best Practices

### Zomato/Swiggy
- ✅ Show "Closing soon" badge
- ✅ Gray out closed restaurants
- ✅ Show opening time
- ✅ Filter: "Open now"

### Blinkit/Zepto
- ✅ Real-time status
- ✅ Countdown timer
- ✅ Next opening time
- ✅ Delivery slots for closed stores

### Google Maps
- ✅ "Open ⋅ Closes 10 PM"
- ✅ "Closed ⋅ Opens 10 AM"
- ✅ Popular times graph
- ✅ Holiday hours

## Next Steps

1. **✅ Implement Phase 1** - Add calculated status without DB changes
2. **📋 Design database schema** for store_schedule
3. **🔨 Create migration script** with default hours
4. **🎨 Update UI** to show timing badges
5. **📊 Add analytics** to track closed store clicks
6. **🔧 Admin panel** for store owners to set hours

*Document Created: December 30, 2025*
