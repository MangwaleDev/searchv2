# 🚀 Mangwale Search - One-Click Deployment Guide

## Prerequisites

- **Docker** 20.10+ with Docker Compose v2
- **Memory**: 8GB RAM minimum (16GB recommended)
- **Disk**: 20GB free space minimum
- **Ports**: 80, 443, 8081 available

## One-Click Deploy

```bash
# Make executable and run
chmod +x deploy-one-click.sh
./deploy-one-click.sh
```

## What Gets Deployed

| Service | Container | Internal Port | Purpose |
|---------|-----------|---------------|---------|
| Traefik | search-traefik | 80, 443, 8080 | Reverse proxy, SSL |
| OpenSearch | search-opensearch | 9200 | Vector search |
| MySQL | search-mysql | 3306 | Data storage |
| Redis | search-redis | 6379 | Cache |
| Redpanda | search-redpanda | 9092 | Kafka streaming |
| Kafka Connect | search-kafka-connect | 8083 | CDC connector |
| ClickHouse | search-clickhouse | 8123 | Analytics |
| Embedding Service | search-embedding-service | 3101 | ML embeddings |
| Search API | search-api | 3100 | NestJS API |
| Frontend | search-frontend | 80 | React UI |
| CDC Consumer | search-cdc-consumer | - | Data sync |

## Access URLs

After deployment:

| Service | URL |
|---------|-----|
| Frontend | https://search.test.mangwale.ai |
| Search API | https://search.test.mangwale.ai/search |
| API Docs | https://search.test.mangwale.ai/docs |
| Traefik Dashboard | http://localhost:8081 |

## Configuration

### Environment Variables

Edit `.env` to customize:

```env
# Domain (change for production)
DOMAIN=search.test.mangwale.ai

# MySQL
MYSQL_ROOT_PASSWORD=your_secure_password

# Storage
MINIO_URL=https://storage.mangwale.ai
```

### Custom Domain

1. Edit `.env`:
   ```env
   DOMAIN=search.yourdomain.com
   ```

2. Run deployment:
   ```bash
   ./deploy-one-click.sh
   ```

The script auto-generates Traefik config with SSL (Let's Encrypt).

### Port Configuration

Default exposed ports:
- **80**: HTTP (redirects to HTTPS)
- **443**: HTTPS (main access)
- **8081**: Traefik dashboard

To change, edit `.env`:
```env
HTTP_PORT=8080
HTTPS_PORT=8443
DASHBOARD_PORT=9090
```

## Commands

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f search-api

# Stop all services
docker-compose stop

# Start all services
docker-compose start

# Restart specific service
docker-compose restart search-api

# Status
docker-compose ps

# Full rebuild
docker-compose up -d --build --force-recreate
```

## Health Checks

```bash
# API health
curl http://localhost:3100/health

# OpenSearch
curl http://localhost:9200/_cluster/health

# Test search
curl 'http://localhost:3100/v2/search?q=pizza&module=food'
```

## Troubleshooting

### Services not starting

```bash
# Check logs
docker-compose logs search-api
docker-compose logs search-opensearch

# Restart
docker-compose restart
```

### OpenSearch memory issues

Ensure vm.max_map_count is set:
```bash
sudo sysctl -w vm.max_map_count=262144
```

### Port already in use

Check what's using the port:
```bash
sudo lsof -i :80
sudo lsof -i :443
```

### SSL certificate issues

Clear Let's Encrypt cache:
```bash
rm -rf letsencrypt/acme.json
docker-compose restart search-traefik
```

## Production Checklist

- [ ] Change DOMAIN in .env
- [ ] Set strong passwords for MySQL, ClickHouse, MinIO
- [ ] Configure DNS A record pointing to server
- [ ] Enable firewall (allow 80, 443 only)
- [ ] Set up log rotation
- [ ] Configure backups
- [ ] Set up monitoring (Prometheus/Grafana)

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │           Traefik (SSL/Proxy)           │
                    │         :80 → :443 (HTTPS)              │
                    └─────────────┬───────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼────────┐ ┌───────▼──────┐ ┌─────────▼────────┐
    │   Search API     │ │   Frontend   │ │   API Docs       │
    │   (NestJS)       │ │   (React)    │ │   (Swagger)      │
    │    :3100         │ │     :80      │ │    :3100/docs    │
    └────────┬─────────┘ └──────────────┘ └──────────────────┘
             │
    ┌────────┴─────────────────────────────┐
    │                                      │
┌───▼────┐  ┌──────────┐  ┌───────┐  ┌────▼─────┐
│OpenSearch│ │ClickHouse│ │ Redis │ │ Embedding │
│ :9200   │ │  :8123   │ │ :6379 │ │  :3101   │
└─────────┘  └──────────┘  └───────┘  └──────────┘
```

## Support

For issues, check:
1. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
2. [docs/COMPLETE_DEPLOYMENT_SOLUTION.md](docs/COMPLETE_DEPLOYMENT_SOLUTION.md)
3. Container logs: `docker-compose logs -f`
