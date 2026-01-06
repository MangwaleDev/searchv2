# Search v2 Deployment Summary - search.test.mangwale.ai

## Deployment Status: ✅ COMPLETED

**Date**: December 31, 2025
**Domain**: search.test.mangwale.ai
**Branch**: feature/one-click-deployment
**Latest Commit**: f62d69a - "feat: Enhance brand detection and messaging in search functionality"

## Services Status

All services are running and healthy:

```
✅ search-api (localhost:3100)
✅ search-frontend (localhost:8090)
✅ search-opensearch
✅ search-redis
✅ search-mysql (external: dashboard_mangwale_mysql)
✅ search-clickhouse
✅ search-embedding-service (localhost:3101)
✅ search-redpanda
✅ search-kafka-connect
✅ search-cdc-consumer
✅ search-opensearch-dashboards
✅ search-adminer
✅ Nginx (main reverse proxy)
```

## Configuration Details

### Environment Variables (.env)
- **DOMAIN**: search.test.mangwale.ai
- **NODE_ENV**: production
- **MYSQL_HOST**: dashboard_mangwale_mysql
- **MYSQL_DATABASE**: mangwale_db
- **MYSQL_USER**: root
- **MYSQL_PASSWORD**: root_password

### Storage Configuration (MinIO)
- **STORAGE_TYPE**: minio
- **MINIO_URL**: https://storage.mangwale.ai
- **MINIO_BUCKET**: mangwale
- **MINIO_ACCESS_KEY**: admin
- **MINIO_SECRET_KEY**: Mangwale@2024
- **IMAGE_FALLBACK_ENABLED**: true

### S3 Fallback Configuration
- **S3_URL**: https://mangwale.s3.ap-south-1.amazonaws.com
- **S3_BUCKET**: mangwale
- **S3_REGION**: ap-south-1

## Network Configuration

### Port Mappings
- Port 80/443: Nginx (main reverse proxy)
- Port 3100: search-api (exposed)
- Port 8090: search-frontend (exposed)
- Port 3101: search-embedding-service (exposed)
- Port 6000: traefik HTTP (not used - bypassed)
- Port 6443: traefik HTTPS (not used - bypassed)
- Port 6081: traefik dashboard (not used - bypassed)

### Nginx Reverse Proxy
Nginx is configured to proxy requests as follows:
- `/search`, `/analytics`, `/health`, `/docs`, `/api-docs`, `/v2`, `/sync` → search-api (localhost:3100)
- `/` (default) → search-frontend (localhost:8090)

## API Endpoints

### Health Check
```
https://search.test.mangwale.ai/health
Response: {"ok":true,"opensearch":"yellow"}
```

### Search API
```
https://search.test.mangwale.ai/search?q=<query>&limit=<n>
```

### API Documentation
```
https://search.test.mangwale.ai/api-docs
https://search.test.mangwale.ai/docs
```

## Latest Changes (feature/one-click-deployment)

The deployment includes the latest commit:
- **f62d69a**: Enhanced brand detection and messaging in search functionality
  - Updated query-parser.service.ts
  - Updated search.service.ts
  - Updated App.tsx
  - Updated styles.css

## Testing Results

✅ Health endpoint: Working
✅ Search API: Working (tested with "pizza" query)
✅ Frontend: Working (HTML loaded successfully)
✅ MinIO integration: Configured and ready
✅ MySQL connection: Connected to external database (dashboard_mangwale_mysql)
✅ OpenSearch: Status yellow (healthy)
✅ Redis: Connected and healthy
✅ Embedding Service: Running and healthy

## Notes

1. **Traefik bypassed**: Due to Docker API version compatibility issues, we bypassed Traefik and configured Nginx to proxy directly to the services.

2. **Database**: Using external MySQL container `dashboard_mangwale_mysql` with database `mangwale_db`.

3. **MinIO**: All MinIO configuration is in place and the API is configured to use MinIO as primary storage with S3 as fallback.

4. **SSL**: Let's Encrypt certificates are properly configured via Nginx for search.test.mangwale.ai.

5. **Image storage**: The system is configured with:
   - Primary: MinIO (storage.mangwale.ai)
   - Fallback: S3 (mangwale.s3.ap-south-1.amazonaws.com)
   - Fallback enabled: true

## Access URLs

- **Frontend**: https://search.test.mangwale.ai/
- **API Health**: https://search.test.mangwale.ai/health
- **API Docs**: https://search.test.mangwale.ai/api-docs
- **Search**: https://search.test.mangwale.ai/search?q=<query>

## Maintenance Commands

### View logs
```bash
cd ~/searchv2
docker compose logs -f search-api
docker compose logs -f search-frontend
```

### Restart services
```bash
cd ~/searchv2
docker compose restart search-api search-frontend
```

### Check status
```bash
cd ~/searchv2
docker compose ps
```

### Update deployment
```bash
cd ~/searchv2
git pull origin feature/one-click-deployment
docker compose build
docker compose up -d
```

---
**Deployment completed successfully!** 🎉
