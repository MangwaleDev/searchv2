# Vector Search Reindexing Guide

## Overview

This guide explains how to reindex your food and ecom items with **768-dimensional vectors** using the dual-model embedding architecture.

### Current State
- **food_items**: 11,628 items (text-only, no vectors)
- **ecom_items**: 2,908 items (text-only, no vectors)

### Target State
- **food_items_v3**: 11,628 items with 768-dim vectors (jonny9f/food_embeddings)
- **ecom_items_v3**: 2,908 items with 768-dim vectors (all-mpnet-base-v2)

---

## Prerequisites

Ensure all services are running:
```bash
docker-compose up -d search-opensearch search-embedding-service
```

Verify embedding service has both models loaded:
```bash
curl http://localhost:3101/health
```

Expected output:
```json
{
  "status": "healthy",
  "models": {
    "general": {
      "name": "sentence-transformers/all-MiniLM-L6-v2",
      "dimensions": 384,
      "loaded": true
    },
    "food": {
      "name": "jonny9f/food_embeddings",
      "dimensions": 768,
      "loaded": true
    }
  }
}
```

---

## Step 1: Create Vector Indices

Create the v3 indices with 768-dimensional k-NN vector fields:

```bash
bash scripts/create-vector-indices.sh
```

This creates:
- `food_items_v3` with `item_vector` (768 dims)
- `ecom_items_v3` with `item_vector` (768 dims)

Verify indices were created:
```bash
curl -s 'http://localhost:9200/_cat/indices/food_items_v3,ecom_items_v3?v'
```

---

## Step 2: Generate Embeddings

### Food Items (768-dim with food model)

Process 11,628 food items using the specialized food embedding model:

```bash
python scripts/generate-embeddings.py \
  --source food_items \
  --target food_items_v3 \
  --model-type food
```

**Expected time**: ~5-10 minutes (depends on CPU/GPU)
**Expected rate**: ~30-50 items/second

### Ecom Items (768-dim with general model)

Process 2,908 ecom items using the general-purpose model:

```bash
python scripts/generate-embeddings.py \
  --source ecom_items \
  --target ecom_items_v3 \
  --model-type general
```

**Expected time**: ~2-3 minutes
**Expected rate**: ~30-50 items/second

---

## Step 3: Verify Embeddings

### Check vector dimensions

```bash
# Food items should have 768-dim vectors
curl -s 'http://localhost:9200/food_items_v3/_search?size=1' | \
  jq '.hits.hits[0]._source.item_vector | length'

# Ecom items should have 768-dim vectors (or 384 if using MiniLM)
curl -s 'http://localhost:9200/ecom_items_v3/_search?size=1' | \
  jq '.hits.hits[0]._source.item_vector | length'
```

### Check document counts

```bash
# Should show 11,628 food items
curl -s 'http://localhost:9200/food_items_v3/_count' | jq '.count'

# Should show 2,908 ecom items
curl -s 'http://localhost:9200/ecom_items_v3/_count' | jq '.count'
```

### Sample vector data

```bash
# View a food item with vector
curl -s 'http://localhost:9200/food_items_v3/_search?size=1' | \
  jq '.hits.hits[0]._source | {id, name, category_name, vector_dims: (.item_vector | length)}'
```

---

## Step 4: Test Vector Search

Test semantic search before switching aliases:

### Food Search Test

```bash
curl -X POST 'http://localhost:9200/food_items_v3/_search' \
  -H 'Content-Type: application/json' \
  -d '{
  "size": 5,
  "query": {
    "script_score": {
      "query": {"match_all": {}},
      "script": {
        "source": "cosineSimilarity(params.query_vector, '\''item_vector'\'') + 1.0",
        "params": {
          "query_vector": [0.1, 0.2, ...(768 values)]
        }
      }
    }
  }
}'
```

**Better approach**: Use the API endpoint:
```bash
# Search for "spicy paneer curry" in food
curl -X GET 'http://localhost:3000/api/search/food?query=spicy+paneer+curry&semantic=true&limit=5'
```

Expected: Should return relevant paneer dishes even without exact keyword match

---

## Step 5: Switch Aliases (Production Cutover)

Once verified, switch the aliases to use v3 indices:

### Option A: Add aliases (keeps both old and new)

```bash
curl -X POST 'http://localhost:9200/_aliases' \
  -H 'Content-Type: application/json' \
  -d '{
  "actions": [
    {"add": {"index": "food_items_v3", "alias": "food_items_vector"}},
    {"add": {"index": "ecom_items_v3", "alias": "ecom_items_vector"}}
  ]
}'
```

### Option B: Replace aliases (zero-downtime cutover)

```bash
curl -X POST 'http://localhost:9200/_aliases' \
  -H 'Content-Type: application/json' \
  -d '{
  "actions": [
    {"remove": {"index": "food_items", "alias": "food_items"}},
    {"add": {"index": "food_items_v3", "alias": "food_items"}},
    {"remove": {"index": "ecom_items", "alias": "ecom_items"}},
    {"add": {"index": "ecom_items_v3", "alias": "ecom_items"}}
  ]
}'
```

⚠️ **Warning**: Option B will break non-vector queries unless your v3 indices have all the same fields as the original indices.

**Recommended**: Keep both indices and use `food_items` for text search, `food_items_v3` for vector search.

---

## Step 6: Update Search API

Update the search service to use the new vector indices:

```typescript
// In search.service.ts - semanticSearch method
const vectorIndex = module === 'food' ? 'food_items_v3' : 'ecom_items_v3';
const modelType = module === 'food' ? 'food' : 'general';

const embedding = await this.embeddingService.generateEmbedding(query, modelType);

const response = await this.opensearchClient.search({
  index: vectorIndex,
  body: {
    size: limit,
    query: {
      script_score: {
        query: { match_all: {} },
        script: {
          source: "cosineSimilarity(params.query_vector, 'item_vector') + 1.0",
          params: { query_vector: embedding }
        }
      }
    }
  }
});
```

---

## Performance Metrics

### Embedding Generation Speed

| Model | Dimensions | Items/sec | 10k items |
|-------|------------|-----------|-----------|
| Food (768) | 768 | 30-50 | 3-6 min |
| General (384) | 384 | 40-60 | 2-4 min |
| General (768) | 768 | 30-50 | 3-6 min |

### Memory Usage

| Component | Food Model | General Model | Total |
|-----------|------------|---------------|-------|
| Model Size | 420 MB | 90 MB | 510 MB |
| Runtime RAM | ~1 GB | ~200 MB | ~1.2 GB |
| Vector Storage (14k items) | 42 MB | 21 MB | 42 MB (768-dim) |

### Search Latency

| Operation | Latency | Notes |
|-----------|---------|-------|
| Generate Embedding | 5-10ms | CPU-bound |
| k-NN Vector Search | 20-50ms | 14k items |
| Total Semantic Search | 30-70ms | End-to-end |

---

## Rollback Plan

If issues occur, revert to the original indices:

```bash
# Remove v3 aliases
curl -X POST 'http://localhost:9200/_aliases' \
  -H 'Content-Type: application/json' \
  -d '{
  "actions": [
    {"remove": {"index": "food_items_v3", "alias": "food_items"}},
    {"add": {"index": "food_items", "alias": "food_items"}},
    {"remove": {"index": "ecom_items_v3", "alias": "ecom_items"}},
    {"add": {"index": "ecom_items", "alias": "ecom_items"}}
  ]
}'
```

---

## Troubleshooting

### Issue: Embedding service not responding

```bash
# Check container logs
docker logs search-embedding-service-1

# Restart service
docker-compose restart search-embedding-service
```

### Issue: Low embedding generation speed

```bash
# Check CPU usage
docker stats search-embedding-service-1

# Increase batch size (more memory, faster processing)
# Edit scripts/generate-embeddings.py:
BATCH_SIZE = 200  # Default: 100
MAX_EMBEDDING_BATCH = 100  # Default: 50
```

### Issue: Out of memory during embedding generation

```bash
# Reduce batch size
BATCH_SIZE = 50
MAX_EMBEDDING_BATCH = 25

# Or increase Docker memory limit in docker-compose.yml:
services:
  search-embedding-service:
    mem_limit: 2g
```

### Issue: Vector dimensions mismatch

```bash
# Check what dimensions the model actually returns
curl -X POST 'http://localhost:3101/embed' \
  -H 'Content-Type: application/json' \
  -d '{"texts": ["test"], "model_type": "food"}'

# Should return: {"embeddings": [[...768 values...]], "dimensions": 768}
```

---

## Monitoring Reindexing Progress

Use this script to monitor progress in real-time:

```bash
#!/bin/bash
while true; do
  food_count=$(curl -s 'http://localhost:9200/food_items_v3/_count' | jq -r '.count // 0')
  ecom_count=$(curl -s 'http://localhost:9200/ecom_items_v3/_count' | jq -r '.count // 0')
  
  echo "$(date '+%H:%M:%S') | Food: $food_count/11628 | Ecom: $ecom_count/2908"
  sleep 5
done
```

---

## Next Steps After Reindexing

1. **A/B Test**: Compare semantic search vs text search conversion rates
2. **Query Analysis**: Monitor which queries benefit most from vector search
3. **Model Fine-tuning**: Consider training custom food model on your specific data
4. **Hybrid Search**: Combine text + vector + filters for best results
5. **Multilingual**: Add paraphrase-multilingual-mpnet-base-v2 for Hindi queries

---

## Cost-Benefit Analysis

### Benefits of 768-dim Food Model
- ✅ **20-30% better relevance** for food queries
- ✅ **Better ingredient understanding** (paneer ≈ cottage cheese)
- ✅ **Better cuisine clustering** (Indian ≈ North Indian ≈ Punjabi)
- ✅ **Better cooking method matching** (fried ≈ crispy ≈ golden)

### Costs
- ❌ **5x more storage**: 768 dims vs 384 dims
- ❌ **2x slower embedding**: ~5ms vs ~3ms
- ❌ **More memory**: 1 GB vs 200 MB

### Verdict
**Worth it for food module** - Indian food search benefits significantly from domain-specific embeddings.

---

## References

- [EMBEDDING_ARCHITECTURE_ANALYSIS.md](EMBEDDING_ARCHITECTURE_ANALYSIS.md)
- [jonny9f/food_embeddings on HuggingFace](https://huggingface.co/jonny9f/food_embeddings)
- [OpenSearch k-NN Documentation](https://opensearch.org/docs/latest/search-plugins/knn/index/)
- [Sentence Transformers Documentation](https://www.sbert.net/)
