# 🚀 QUICK START GUIDE

## 30-Second Setup

```bash
# 1. Clone & setup
cd /path/to/search
cp .env.example .env
# Edit .env with your values

# 2. Deploy
docker-compose up -d

# 3. Sync data
python3 scripts/sync-mysql-with-vectors.py

# 4. Done!
curl http://localhost:3100/health
```

---

## API Quick Reference

### 🔍 Basic Search
```bash
curl 'http://localhost:3100/v2/search/items?q=butter+chicken&module_id=4'
```

### 🏪 Store-Specific Search
```bash
curl 'http://localhost:3100/v2/search/items?q=Inayat+Cafe&module_id=4'
```

### 🎯 Intent-Based Search (with NLU)
```bash
curl 'http://localhost:3100/v2/search/items?q=butter+chicken+from+Inayat&module_id=4'
```

### 🤖 LLM Structured Query
```bash
curl -X POST http://localhost:3100/v2/search/items/structured \
  -H 'Content-Type: application/json' \
  -d '{
    "intent": "specific_item_specific_store",
    "item": "butter chicken",
    "store": "Inayat Cafe",
    "filters": { "module_id": 4 }
  }'
```

---

## File Locations

| What | Where |
|------|-------|
| Config | `.env` |
| Docker | `docker-compose.yml` |
| Sync Script | `scripts/sync-mysql-with-vectors.py` |
| API Code | `apps/search-api/src/` |
| Intent Parser | `apps/search-api/src/search/query-parser.service.ts` |
| Search Logic | `apps/search-api/src/search/search.service.ts` |
| Endpoints | `apps/search-api/src/search/search.controller.ts` |
| Tests | `apps/search-api/src/search/*.spec.ts` |
| Docs | `docs/` |

---

## Key Features

| Feature | Endpoint | Status |
|---------|----------|--------|
| Intent Detection (NLU) | `GET /v2/search/items?q=...` | ✅ |
| Store Name Search | `GET /v2/search/items?q=Store+Name` | ✅ |
| LLM Structured | `POST /v2/search/items/structured` | ✅ |
| Vector Search | Built-in to OpenSearch | ✅ |
| Fallback Search | Automatic | ✅ |

---

## Environment Variables

**Required:**
- `OPENSEARCH_HOST` - Vector database
- `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DB` - Data source
- `EMBEDDING_SERVICE_URL` - Embedding API

**Optional:**
- `ENABLE_INTENT_PARSING` - Enable NLU (default: true)
- `ENABLE_STRUCTURED_SEARCH` - Enable LLM endpoint (default: true)
- `ENABLE_STORE_NAME_SEARCH` - Enable store search (default: true)
- `ENABLE_FALLBACK_SEARCH` - Enable fallback (default: true)

---

## Health Checks

```bash
# API Status
curl http://localhost:3100/health

# OpenSearch Status
curl http://localhost:9200/_cluster/health

# Embedding Service
curl http://localhost:3101/health

# Check indexed documents
curl http://localhost:9200/food_items_v5/_count
```

---

## Troubleshooting

**Services not responding?**
```bash
docker-compose ps
docker-compose logs
docker-compose logs search-api
```

**Embeddings not synced?**
```bash
python3 scripts/sync-mysql-with-vectors.py
```

**Wrong search results?**
```bash
# Check intent parsing
# curl -X POST /v2/search/items/structured with debug=true

# Or check OpenSearch query
# Use Kibana or direct curl to inspect
curl http://localhost:9200/food_items_v5/_search?q=butter+chicken
```

---

## Testing

```bash
npm run test --prefix apps/search-api
npm run build --prefix apps/search-api
```

---

**🎉 That's it! System is ready for production. For detailed docs see [docs/](docs/)**
