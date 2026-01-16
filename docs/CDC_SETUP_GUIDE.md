# CDC (Change Data Capture) Pipeline Setup Guide

## Overview

The CDC pipeline provides **real-time synchronization** from MySQL to OpenSearch using:
- **Debezium**: MySQL binlog connector (captures database changes)
- **Redpanda/Kafka**: Message queue (streams change events)
- **CDC Consumer**: Node.js service (consumes events and updates OpenSearch)

## Architecture

```
MySQL (migrated_db)
    ↓ (binlog)
Debezium Connector (Kafka Connect)
    ↓ (Kafka topics)
Redpanda/Kafka
    ↓ (consume events)
CDC Consumer (cdc-to-opensearch.js)
    ↓ (upsert/delete)
OpenSearch Indices
```

## Prerequisites

### 1. MySQL Binlog Configuration

The MySQL server must have binlog enabled. Check with:

```sql
SHOW VARIABLES LIKE 'log_bin';
-- Should return: log_bin = ON

SHOW VARIABLES LIKE 'binlog_format';
-- Should return: binlog_format = ROW (required for Debezium)
```

### 2. MySQL User Permissions

The MySQL user used by Debezium needs specific permissions:

```sql
-- Grant required permissions
GRANT SELECT, RELOAD, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'helper_31b9_mangwale_459f'@'%';
FLUSH PRIVILEGES;
```

**Required Permissions:**
- `SELECT`: Read table data
- `RELOAD`: Reload server configuration
- `SHOW DATABASES`: List databases
- `REPLICATION SLAVE`: Read binlog (CRITICAL)
- `REPLICATION CLIENT`: Get binlog position (CRITICAL)

### 3. Network Access

The Kafka Connect container must be able to reach the MySQL server:
- If MySQL is on the same server: Use internal IP or hostname
- If MySQL is external: Ensure firewall allows connections from container network

## Setup Steps

### Step 1: Verify Infrastructure

```bash
# Check services are running
docker ps | grep -E "kafka-connect|redpanda|cdc-consumer"

# Check Kafka Connect is accessible
curl -s http://localhost:8085/ | jq .
```

### Step 2: Register Debezium Connector

**Option A: Using the setup script (Recommended)**

```bash
cd /root/searchv2
./scripts/setup-cdc.sh
```

**Option B: Manual registration**

```bash
# Get MySQL credentials
MYSQL_HOST=103.160.107.41
MYSQL_USER=helper_31b9_mangwale_459f
MYSQL_PASSWORD=39c2922b-810e-42fb-aa1e-80d1b7d62ea2
MYSQL_DATABASE=migrated_db

# Register connector
curl -X POST http://localhost:8085/connectors \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"mysql-mangwale\",
    \"config\": {
      \"connector.class\": \"io.debezium.connector.mysql.MySqlConnector\",
      \"database.hostname\": \"${MYSQL_HOST}\",
      \"database.port\": \"3306\",
      \"database.user\": \"${MYSQL_USER}\",
      \"database.password\": \"${MYSQL_PASSWORD}\",
      \"database.server.id\": \"184054\",
      \"topic.prefix\": \"mangwale\",
      \"schema.history.internal.kafka.bootstrap.servers\": \"search-redpanda:9092\",
      \"schema.history.internal.kafka.topic\": \"schema-changes.mangwale\",
      \"database.include.list\": \"${MYSQL_DATABASE}\",
      \"table.include.list\": \"${MYSQL_DATABASE}.items,${MYSQL_DATABASE}.stores,${MYSQL_DATABASE}.categories\",
      \"include.schema.changes\": \"false\",
      \"tombstones.on.delete\": \"false\",
      \"snapshot.mode\": \"initial\",
      \"snapshot.locking.mode\": \"none\",
      \"decimal.handling.mode\": \"string\",
      \"time.precision.mode\": \"connect\",
      \"event.processing.failure.handling.mode\": \"fail\",
      \"topic.creation.default.replication.factor\": 1,
      \"topic.creation.default.partitions\": 1
    }
  }"
```

### Step 3: Verify Connector Status

```bash
# Check connector status
curl -s http://localhost:8085/connectors/mysql-mangwale/status | jq .

# Expected output:
# {
#   "name": "mysql-mangwale",
#   "connector": {
#     "state": "RUNNING"
#   },
#   "tasks": [...]
# }
```

### Step 4: Start CDC Consumer

```bash
# Start CDC consumer
docker-compose -f docker-compose.production.yml up -d search-cdc-consumer

# Check logs
docker logs search-cdc-consumer --follow
```

### Step 5: Verify Data Flow

```bash
# Check Kafka topics (should see CDC topics)
curl -s http://localhost:8084/api/v1/topics | jq '.[]' | grep mangwale

# Expected topics:
# - mangwale.migrated_db.items
# - mangwale.migrated_db.stores
# - mangwale.migrated_db.categories

# Check CDC consumer is processing
docker logs search-cdc-consumer --tail 20
```

## Monitoring

### Check Connector Health

```bash
# Connector status
curl -s http://localhost:8085/connectors/mysql-mangwale/status | jq .

# Connector config
curl -s http://localhost:8085/connectors/mysql-mangwale/config | jq .
```

### Check CDC Consumer

```bash
# View logs
docker logs search-cdc-consumer --tail 50 --follow

# Check if running
docker ps | grep cdc-consumer
```

### Test Real-time Sync

1. **Insert a test item in MySQL:**
```sql
INSERT INTO migrated_db.items (name, price, module_id, status) 
VALUES ('Test Item', 100, 4, 1);
```

2. **Check OpenSearch (should appear within seconds):**
```bash
curl -s "http://localhost:9210/food_items_v4/_search?q=Test+Item" | jq '.hits.hits[0]'
```

3. **Update the item:**
```sql
UPDATE migrated_db.items SET name = 'Updated Test Item' WHERE name = 'Test Item';
```

4. **Verify update in OpenSearch:**
```bash
curl -s "http://localhost:9210/food_items_v4/_search?q=Updated+Test+Item" | jq '.hits.hits[0]._source.name'
```

## Troubleshooting

### Issue: "Access denied" when registering connector

**Cause:** MySQL user lacks required permissions

**Solution:**
```sql
-- Grant REPLICATION permissions
GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'helper_31b9_mangwale_459f'@'%';
FLUSH PRIVILEGES;
```

### Issue: Connector state is "FAILED"

**Check logs:**
```bash
docker logs search-kafka-connect --tail 50
```

**Common causes:**
- MySQL binlog not enabled
- Network connectivity issues
- Wrong database/table names
- MySQL user permissions

### Issue: CDC Consumer not processing events

**Check:**
1. Consumer is running: `docker ps | grep cdc-consumer`
2. Consumer logs: `docker logs search-cdc-consumer --tail 50`
3. Kafka topics exist: `curl -s http://localhost:8084/api/v1/topics | jq '.[]' | grep mangwale`
4. Connector is running: `curl -s http://localhost:8085/connectors/mysql-mangwale/status | jq .`

### Issue: Data not appearing in OpenSearch

**Check:**
1. CDC consumer logs for errors
2. OpenSearch indices exist: `curl -s http://localhost:9210/_cat/indices?v`
3. Index names match configuration (FOOD_ITEMS_INDEX, etc.)
4. Embedding service is accessible (for vector generation)

## Configuration

### Environment Variables (CDC Consumer)

Set in `docker-compose.production.yml`:

```yaml
environment:
  - KAFKA_BROKER=search-redpanda:9092
  - OPENSEARCH_HOST=http://search-opensearch:9200
  - EMBEDDING_SERVICE_URL=http://search-embedding-service:3101
  - FOOD_ITEMS_INDEX=food_items_v4
  - ECOM_ITEMS_INDEX=ecom_items_v3
  - FOOD_STORES_INDEX=food_stores_v6
  - ECOM_STORES_INDEX=ecom_stores
  - ENABLE_AUTO_VECTORIZATION=true
```

### Connector Configuration

Key settings in connector config:

- `snapshot.mode`: `initial` (takes full snapshot on first run)
- `snapshot.locking.mode`: `none` (doesn't lock tables)
- `decimal.handling.mode`: `string` (handles MySQL DECIMAL types)
- `tombstones.on.delete`: `false` (doesn't create tombstone records on delete)

## Performance

### Expected Latency

- **Insert/Update**: 1-5 seconds (MySQL → OpenSearch)
- **Delete**: 1-5 seconds
- **Vector Generation**: +2-3 seconds (if enabled)

### Throughput

- **Items**: ~100-500 events/second
- **Stores**: ~10-50 events/second
- **Categories**: ~5-20 events/second

## Maintenance

### Restart CDC Pipeline

```bash
# Restart connector
curl -X POST http://localhost:8085/connectors/mysql-mangwale/restart

# Restart CDC consumer
docker-compose -f docker-compose.production.yml restart search-cdc-consumer
```

### Update Connector Configuration

```bash
# Update config
curl -X PUT http://localhost:8085/connectors/mysql-mangwale/config \
  -H "Content-Type: application/json" \
  -d @connectors/mysql-mangwale.json
```

### Remove Connector

```bash
# Delete connector
curl -X DELETE http://localhost:8085/connectors/mysql-mangwale
```

## Next Steps

1. ✅ Verify CDC pipeline is running
2. ✅ Test real-time sync with sample data
3. ✅ Monitor logs for any errors
4. ✅ Set up alerts for connector failures
5. ✅ Document any custom transformations needed
