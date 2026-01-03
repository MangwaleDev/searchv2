# Deployment Configuration Guide

**Last Updated**: January 1, 2026  
**Status**: ✅ Production Ready

---

## 🎯 Overview

The Mangwale Search stack is now **100% environment-variable configured** with no hardcoded URLs. You can deploy to any server with any domain by simply updating the `.env` file.

---

## 📝 Quick Start

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Edit Domain Configuration
```bash
# Edit .env file
nano .env

# Change this line to your domain:
DOMAIN=your-domain.com
```

### 3. Deploy
```bash
# Rebuild containers with new domain
docker-compose up -d

# Verify domain is applied
docker-compose config | grep "traefik.http.routers"
```

---

## 🔧 Environment Variables

### Core Configuration

| Variable | Default | Description | Required |
|----------|---------|-------------|----------|
| `DOMAIN` | `opensearch.mangwale.ai` | Public domain for Traefik routing | ✅ Yes |
| `HTTP_PORT` | `80` | HTTP port | No |
| `HTTPS_PORT` | `443` | HTTPS port | No |
| `NODE_ENV` | `production` | Environment mode | No |

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_HOST` | `search-mysql` | MySQL hostname (Docker: service name, External: IP) |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_DATABASE` | `mangwale` | Database name |
| `MYSQL_USER` | `root` | MySQL username |
| `MYSQL_PASSWORD` | `secret` | MySQL password |

### OpenSearch Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSEARCH_HOST` | `http://search-opensearch:9200` | OpenSearch URL (internal) |
| `OPENSEARCH_USERNAME` | *(empty)* | Optional auth username |
| `OPENSEARCH_PASSWORD` | *(empty)* | Optional auth password |

### Search API Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_SERVICE_URL` | `http://search-embedding-service:3101` | Embedding service URL |
| `REDIS_URL` | `redis://search-redis:6379/2` | Redis cache URL |
| `FOOD_ITEMS_INDEX` | `food_items_v4` | Food items index name |
| `ECOM_ITEMS_INDEX` | `ecom_items` | Ecom items index name |

---

## 🚀 Deployment Scenarios

### Scenario 1: Same Server (Domain Change Only)

**Use Case**: Change domain from `opensearch.mangwale.ai` to `search.yourcompany.com`

```bash
# 1. Update .env
echo "DOMAIN=search.yourcompany.com" >> .env

# 2. Restart Traefik to pick up new domain
docker-compose up -d traefik

# 3. Verify
curl https://search.yourcompany.com/health
```

**DNS Required**: Point `search.yourcompany.com` to server IP  
**SSL Certificates**: Traefik auto-generates via Let's Encrypt  
**Downtime**: ~5 seconds (Traefik restart)

---

### Scenario 2: New Server (Fresh Deployment)

**Use Case**: Deploy entire stack to new production server

```bash
# 1. Clone repository
git clone <your-repo> /opt/search
cd /opt/search

# 2. Create .env from template
cp .env.example .env

# 3. Edit configuration
nano .env
# Update:
# - DOMAIN=your-production-domain.com
# - MYSQL_HOST=your-mysql-server (if external)
# - MYSQL_PASSWORD=your-secure-password

# 4. Start all services
docker-compose up -d

# 5. Run initial reindex
docker exec -it search-embedding-service bash
export MYSQL_HOST=your-mysql-server
export MYSQL_PASSWORD=your-password
python3 /tmp/sync.py
exit

# 6. Verify deployment
curl https://your-production-domain.com/health
```

**Time Required**: 20-30 minutes (including reindex)  
**Reindex Required**: ✅ Yes (first time only)

---

### Scenario 3: Multiple Environments (Staging + Production)

**Use Case**: Run staging and production on same server with different domains

```bash
# Staging deployment
cd /opt/search-staging
nano .env
# DOMAIN=staging.search.yourcompany.com
# MYSQL_DATABASE=mangwale_staging
docker-compose up -d

# Production deployment
cd /opt/search-production
nano .env
# DOMAIN=search.yourcompany.com
# MYSQL_DATABASE=mangwale_production
docker-compose up -d
```

**Note**: Use different container names and network names to avoid conflicts

---

## 🔍 Verification

### Check Domain Configuration
```bash
# Verify .env file
grep DOMAIN .env

# Check resolved configuration
docker-compose config | grep "Host("

# Expected output:
# traefik.http.routers.opensearch-api.rule: Host(`your-domain.com`) && ...
# traefik.http.routers.opensearch-frontend.rule: Host(`your-domain.com`)
```

### Test Endpoints
```bash
# Replace YOUR_DOMAIN with your configured domain
export DOMAIN="your-domain.com"

# Health check
curl https://${DOMAIN}/health

# API test
curl https://${DOMAIN}/v2/search/suggest?q=pizza&module_id=4

# Frontend test
curl -I https://${DOMAIN}/
```

---

## 🛡️ Security Best Practices

### 1. Environment Variables
- ✅ **Never commit `.env` to git** - Already in `.gitignore`
- ✅ Use strong passwords for MySQL
- ✅ Restrict MySQL access to internal network only
- ✅ Use SSL/TLS for all public endpoints (handled by Traefik)

### 2. SSL Certificates
- ✅ Let's Encrypt auto-renewal enabled in Traefik
- ✅ HTTP to HTTPS redirect configured
- ✅ HSTS headers recommended (add to Traefik config)

### 3. Firewall Rules
```bash
# Recommended firewall rules (UFW)
ufw allow 80/tcp    # HTTP (redirects to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw allow 22/tcp    # SSH (your IP only)
ufw deny 3306/tcp   # MySQL (block public access)
ufw deny 9200/tcp   # OpenSearch (block public access)
ufw deny 3100/tcp   # Search API (access via Traefik only)
```

---

## 📊 Current Production Configuration

```bash
# Active Configuration (as of Jan 1, 2026)
DOMAIN=opensearch.mangwale.ai

# Services
- Frontend: https://opensearch.mangwale.ai
- API: https://opensearch.mangwale.ai/v2/search/*
- Health: https://opensearch.mangwale.ai/health
- API Docs: https://opensearch.mangwale.ai/api-docs

# Backend Services (Internal Only)
- OpenSearch: http://search-opensearch:9200
- MySQL: search-mysql:3306
- Embedding: http://search-embedding-service:3101
- Redis: redis://search-redis:6379/2
```

---

## 🔄 Migration Guide

### From Hardcoded URLs to Environment Variables

**Before** (Hardcoded):
```yaml
- "traefik.http.routers.api.rule=Host(`opensearch.mangwale.ai`)"
```

**After** (Configurable):
```yaml
- "traefik.http.routers.api.rule=Host(`${DOMAIN:-opensearch.mangwale.ai}`)"
```

**Migration Steps**:
1. ✅ Updated `docker-compose.yml` with `${DOMAIN}` variable
2. ✅ Created `.env` file with `DOMAIN=opensearch.mangwale.ai`
3. ✅ Updated `.env.example` with documentation
4. ✅ Verified no hardcoded URLs remain in code
5. ✅ Tested domain resolution via `docker-compose config`

---

## 🧪 Testing Checklist

After changing domain configuration:

- [ ] `.env` file updated with new DOMAIN
- [ ] DNS points to server IP
- [ ] `docker-compose config` shows correct domain
- [ ] `docker-compose up -d` completes successfully
- [ ] Health endpoint responds: `curl https://NEW_DOMAIN/health`
- [ ] API endpoint works: `curl https://NEW_DOMAIN/v2/search/suggest?q=test&module_id=4`
- [ ] Frontend loads: `curl -I https://NEW_DOMAIN/`
- [ ] SSL certificate valid (Let's Encrypt auto-generated)
- [ ] HTTP redirects to HTTPS
- [ ] Search functionality working end-to-end

---

## 📚 Additional Resources

- **Main README**: [README.md](README.md)
- **One-Click Deployment**: [ONE_CLICK_DEPLOYMENT.md](ONE_CLICK_DEPLOYMENT.md)
- **Deployment Script**: [deploy-one-click.sh](deploy-one-click.sh)
- **Final System Report**: [FINAL_SYSTEM_REPORT_2026-01-01.md](FINAL_SYSTEM_REPORT_2026-01-01.md)

---

## 🆘 Troubleshooting

### Issue: Domain not resolving

**Symptoms**: `curl https://new-domain.com` fails  
**Solution**:
```bash
# 1. Check DNS
nslookup new-domain.com
# Should point to your server IP

# 2. Check Traefik logs
docker logs search-traefik

# 3. Verify docker-compose config
docker-compose config | grep "Host("
```

### Issue: SSL certificate not generating

**Symptoms**: `curl` shows certificate error  
**Solution**:
```bash
# 1. Check Let's Encrypt logs
docker logs search-traefik | grep acme

# 2. Ensure ports 80/443 are open
sudo ufw status

# 3. Verify domain DNS is correct
# Let's Encrypt requires valid DNS resolution

# 4. Restart Traefik
docker-compose restart traefik
```

### Issue: API returns 404

**Symptoms**: Frontend loads but API calls fail  
**Solution**:
```bash
# 1. Check search-api is running
docker ps | grep search-api

# 2. Check API health directly
docker exec search-api curl -s http://localhost:3100/health

# 3. Check Traefik routing
docker logs search-traefik | grep search-api

# 4. Verify labels in docker-compose
docker inspect search-api | grep traefik
```

---

**Status**: ✅ Configuration Complete  
**Deployment**: 🚀 Ready for any domain  
**Documentation**: 📝 Complete

