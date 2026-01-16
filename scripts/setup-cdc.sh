#!/bin/bash
# Setup CDC (Change Data Capture) Pipeline
# This script registers the Debezium connector and starts the CDC consumer

set -e

echo "🔧 Setting up CDC Pipeline..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load MySQL credentials from .env.production file
if [ -f .env.production ]; then
    echo "Loading credentials from .env.production..."
    export $(grep -v '^#' .env.production | grep -E '^MYSQL_' | xargs)
fi

# Fallback to defaults if not set
MYSQL_HOST=${MYSQL_HOST:-103.160.107.41}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-search_43d2_ai_55a6}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-4854af0c-326d-4801-8b44-555c53eaec97}
MYSQL_DATABASE=${MYSQL_DATABASE:-migrated_db}

KAFKA_CONNECT_URL=${KAFKA_CONNECT_URL:-http://localhost:8085}

echo -e "${BLUE}Configuration:${NC}"
echo -e "  MySQL Host: ${MYSQL_HOST}"
echo -e "  MySQL Database: ${MYSQL_DATABASE}"
echo -e "  Kafka Connect: ${KAFKA_CONNECT_URL}"
echo ""

# Step 1: Wait for Kafka Connect to be ready
echo -e "${YELLOW}Step 1: Waiting for Kafka Connect...${NC}"
for i in {1..30}; do
    if curl -s "${KAFKA_CONNECT_URL}/" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Kafka Connect is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Kafka Connect not ready after 30 attempts${NC}"
        exit 1
    fi
    echo "  Attempt $i/30..."
    sleep 2
done

# Step 2: Register Debezium Connector
echo -e "\n${YELLOW}Step 2: Registering Debezium MySQL Connector...${NC}"

CONNECTOR_NAME="mysql-mangwale"
CONNECTOR_CONFIG=$(cat <<EOF
{
  "name": "${CONNECTOR_NAME}",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "database.hostname": "${MYSQL_HOST}",
    "database.port": "${MYSQL_PORT}",
    "database.user": "${MYSQL_USER}",
    "database.password": "${MYSQL_PASSWORD}",
    "database.server.id": "184054",
    "topic.prefix": "mangwale",
    "schema.history.internal.kafka.bootstrap.servers": "search-redpanda:9092",
    "schema.history.internal.kafka.topic": "schema-changes.mangwale",
    "database.include.list": "${MYSQL_DATABASE}",
    "table.include.list": "${MYSQL_DATABASE}.items,${MYSQL_DATABASE}.stores,${MYSQL_DATABASE}.categories",
    "include.schema.changes": "false",
    "tombstones.on.delete": "false",
    "snapshot.mode": "initial",
    "snapshot.locking.mode": "none",
    "decimal.handling.mode": "string",
    "time.precision.mode": "connect",
    "event.processing.failure.handling.mode": "fail",
    "topic.creation.default.replication.factor": 1,
    "topic.creation.default.partitions": 1
  }
}
EOF
)

# Check if connector already exists
EXISTING=$(curl -s "${KAFKA_CONNECT_URL}/connectors/${CONNECTOR_NAME}" 2>/dev/null || echo "not found")

if echo "$EXISTING" | grep -q "not found\|404"; then
    # Create new connector
    echo "  Creating new connector..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${KAFKA_CONNECT_URL}/connectors" \
        -H "Content-Type: application/json" \
        -d "$CONNECTOR_CONFIG")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "202" ]; then
        echo -e "${GREEN}✓ Connector created successfully${NC}"
    else
        echo -e "${RED}✗ Failed to create connector (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
        exit 1
    fi
else
    # Update existing connector
    echo "  Updating existing connector..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "${KAFKA_CONNECT_URL}/connectors/${CONNECTOR_NAME}/config" \
        -H "Content-Type: application/json" \
        -d "$(echo "$CONNECTOR_CONFIG" | jq -c '.config')")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "202" ]; then
        echo -e "${GREEN}✓ Connector updated successfully${NC}"
    else
        echo -e "${YELLOW}⚠ Update returned HTTP $HTTP_CODE${NC}"
        echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    fi
fi

# Step 3: Check connector status
echo -e "\n${YELLOW}Step 3: Checking connector status...${NC}"
sleep 3
STATUS=$(curl -s "${KAFKA_CONNECT_URL}/connectors/${CONNECTOR_NAME}/status" | jq -r '.connector.state // "UNKNOWN"')
echo -e "  Connector state: ${STATUS}"

if [ "$STATUS" = "RUNNING" ]; then
    echo -e "${GREEN}✓ Connector is running${NC}"
else
    echo -e "${YELLOW}⚠ Connector state: ${STATUS}${NC}"
    echo "  Full status:"
    curl -s "${KAFKA_CONNECT_URL}/connectors/${CONNECTOR_NAME}/status" | jq '.'
fi

# Step 4: Start CDC Consumer
echo -e "\n${YELLOW}Step 4: Starting CDC Consumer...${NC}"
cd /root/searchv2
if docker-compose -f docker-compose.production.yml ps | grep -q "search-cdc-consumer.*Up"; then
    echo -e "${GREEN}✓ CDC Consumer is already running${NC}"
else
    echo "  Starting CDC consumer container..."
    docker-compose -f docker-compose.production.yml up -d search-cdc-consumer
    sleep 3
    
    if docker-compose -f docker-compose.production.yml ps | grep -q "search-cdc-consumer.*Up"; then
        echo -e "${GREEN}✓ CDC Consumer started${NC}"
    else
        echo -e "${RED}✗ Failed to start CDC Consumer${NC}"
        echo "  Check logs: docker logs search-cdc-consumer"
        exit 1
    fi
fi

# Step 5: Verify CDC Pipeline
echo -e "\n${YELLOW}Step 5: Verifying CDC Pipeline...${NC}"

# Check Kafka topics
echo "  Checking Kafka topics..."
TOPICS=$(curl -s "http://localhost:8084/api/v1/topics" 2>/dev/null | jq -r '.[]' 2>/dev/null || echo "")
if echo "$TOPICS" | grep -q "mangwale.mangwale_db"; then
    echo -e "${GREEN}✓ CDC topics found${NC}"
    echo "$TOPICS" | grep "mangwale.mangwale_db" | head -3
else
    echo -e "${YELLOW}⚠ No CDC topics found yet (this is normal if no data has been synced)${NC}"
fi

# Check CDC consumer logs
echo -e "\n${BLUE}CDC Consumer Status:${NC}"
docker logs search-cdc-consumer --tail 10 2>&1 | tail -5

echo -e "\n${GREEN}✅ CDC Pipeline Setup Complete!${NC}"
echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "  1. Monitor CDC consumer: ${YELLOW}docker logs search-cdc-consumer --follow${NC}"
echo -e "  2. Check connector status: ${YELLOW}curl -s ${KAFKA_CONNECT_URL}/connectors/${CONNECTOR_NAME}/status | jq .${NC}"
echo -e "  3. Verify data sync: Make a change in MySQL and check OpenSearch indices"
echo ""
