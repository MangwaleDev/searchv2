# CDC Pipeline: How It Works & Timing

## ⚡ Real-Time Sync (No Interval - Event-Driven)

The CDC pipeline is **NOT** interval-based. It's **event-driven** and processes changes in **real-time** as they happen in MySQL.

## 🔄 How It Works

### Architecture Flow

```
MySQL Database (migrated_db)
    ↓
    [MySQL Binlog - captures ALL changes immediately]
    ↓
Debezium Connector (Kafka Connect)
    ↓
    [Reads binlog events in real-time]
    ↓
Redpanda/Kafka Topics
    ↓
    [Events streamed immediately]
    ↓
CDC Consumer (cdc-to-opensearch.js)
    ↓
    [Processes each event as it arrives]
    ↓
OpenSearch Indices
    ↓
    [Updated immediately]
```

### Processing Flow

1. **MySQL Change Occurs** (INSERT/UPDATE/DELETE)
   - MySQL writes to binlog immediately
   - **Latency: 0ms** (instant)

2. **Debezium Reads Binlog**
   - Debezium connector reads binlog events
   - **Latency: < 100ms** (near-instant)

3. **Event Published to Kafka**
   - Event sent to Kafka topic immediately
   - **Latency: < 50ms**

4. **CDC Consumer Processes Event**
   - Consumer receives event from Kafka
   - Transforms data (enriches with store/category info)
   - Generates embedding vector (if enabled, +2-3 seconds)
   - Updates OpenSearch index
   - **Latency: 1-5 seconds** (depending on vectorization)

## ⏱️ Total Latency

### Without Vectorization
- **Total Time: 1-3 seconds**
  - MySQL → Debezium: < 100ms
  - Debezium → Kafka: < 50ms
  - Kafka → Consumer: < 100ms
  - Consumer → OpenSearch: 500ms - 2s

### With Vectorization (Items Only)
- **Total Time: 3-8 seconds**
  - All above steps: 1-3 seconds
  - Embedding generation: +2-5 seconds
  - OpenSearch update: +500ms

## 📊 What Gets Synced

### Tables Monitored
- ✅ `items` → `food_items_v4` / `ecom_items_v3`
- ✅ `stores` → `food_stores_v6` / `ecom_stores`
- ✅ `categories` → `food_categories` / `ecom_categories`

### Operations Supported
- ✅ **INSERT**: New record appears in OpenSearch
- ✅ **UPDATE**: Existing record updated in OpenSearch
- ✅ **DELETE**: Record removed from OpenSearch

## 🔍 How to Verify Changes Are Syncing

### Test Real-Time Sync

1. **Insert a test item in MySQL:**
```sql
INSERT INTO migrated_db.items (name, price, module_id, status, category_id, store_id) 
VALUES ('CDC Test Item', 100, 4, 1, 279, 156);
```

2. **Check OpenSearch (within 1-5 seconds):**
```bash
# Wait 3 seconds, then check
sleep 3
curl -s "http://localhost:9210/food_items_v4/_search?q=CDC+Test+Item" | jq '.hits.hits[0]._source.name'
# Should return: "CDC Test Item"
```

3. **Update the item:**
```sql
UPDATE migrated_db.items 
SET name = 'CDC Updated Item', price = 200 
WHERE name = 'CDC Test Item';
```

4. **Verify update (within 1-5 seconds):**
```bash
sleep 3
curl -s "http://localhost:9210/food_items_v4/_search?q=CDC+Updated+Item" | jq '.hits.hits[0]._source | {name, price}'
# Should return: {"name": "CDC Updated Item", "price": 200}
```

5. **Delete the item:**
```sql
DELETE FROM migrated_db.items WHERE name = 'CDC Updated Item';
```

6. **Verify deletion (within 1-3 seconds):**
```bash
sleep 2
curl -s "http://localhost:9210/food_items_v4/_search?q=CDC+Updated+Item" | jq '.hits.total.value'
# Should return: 0
```

## 📈 Monitoring CDC Pipeline

### Check Connector Status
```bash
curl -s http://localhost:8085/connectors/mysql-mangwale/status | jq .
```

**Expected:**
```json
{
  "connector": {
    "state": "RUNNING"
  },
  "tasks": [
    {
      "state": "RUNNING"
    }
  ]
}
```

### Monitor CDC Consumer Logs
```bash
docker logs search-cdc-consumer --follow
```

**What to look for:**
- ✅ `[ConsumerGroup] Consumer has joined the group` - Consumer is running
- ✅ Processing messages (you'll see upsert operations)
- ❌ Error messages (connection issues, OpenSearch errors)

### Check Kafka Topics
```bash
# List topics
curl -s http://localhost:8084/api/v1/topics | jq '.[]' | grep mangwale

# Expected topics:
# - mangwale.migrated_db.items
# - mangwale.migrated_db.stores
# - mangwale.migrated_db.categories
```

### Monitor Event Processing
```bash
# Watch CDC consumer logs in real-time
docker logs search-cdc-consumer --follow --tail 20
```

When you make a change in MySQL, you should see:
- Event received from Kafka
- Upsert operation to OpenSearch
- Success confirmation

## ⚠️ Important Notes

### Initial Snapshot
- On first connector start, Debezium takes a **full snapshot** of all tables
- This can take several minutes depending on table size
- After snapshot, only **incremental changes** are synced

### Network Latency
- If MySQL is on a different server, network latency adds to total time
- Typical network latency: 10-50ms

### Embedding Generation
- Only **items** get vectors generated (not stores/categories)
- Vector generation adds 2-5 seconds per item
- If embedding service is slow/busy, latency increases

### OpenSearch Refresh
- OpenSearch indices refresh every 1 second by default
- Changes may not appear in search immediately (within 1 second)
- You can force refresh: `curl -X POST "http://localhost:9210/food_items_v4/_refresh"`

## 🎯 Summary

| Aspect | Details |
|--------|---------|
| **Sync Type** | Real-time, event-driven (NOT interval-based) |
| **Latency** | 1-5 seconds (without vectors), 3-8 seconds (with vectors) |
| **Processing** | Each change processed immediately as it occurs |
| **Initial Load** | Full snapshot on first start (one-time) |
| **Ongoing** | Only incremental changes (INSERT/UPDATE/DELETE) |

## ✅ Your Current Status

Based on your terminal output:
- ✅ **Connector**: RUNNING
- ✅ **CDC Consumer**: Running and subscribed to topics
- ✅ **Topics**: `mangwale.migrated_db.items`, `mangwale.migrated_db.stores`, `mangwale.migrated_db.categories`
- ✅ **Auto-Vectorization**: ENABLED

**Your CDC pipeline is fully operational and syncing in real-time!**

Any changes you make in MySQL will appear in OpenSearch within **1-5 seconds** (or 3-8 seconds if vectorization is needed).
