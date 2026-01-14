# Search Project Deployment Setup - Complete

## ✅ What Has Been Created

### 1. Production Docker Compose File
**File:** `docker-compose.production.yml`

- **No Traefik** - Uses system Nginx for SSL termination (avoids port 80/443 conflicts)
- **Localhost-only ports** - All services exposed on `127.0.0.1` only, proxied by Nginx
- **Unique container names** - All prefixed with `search-*` to avoid conflicts
- **Dynamic port assignment** - Ports updated automatically by deployment script
- **Separate network** - Uses `172.26.0.0/16` subnet to avoid conflicts

### 2. Enhanced Deployment Script
**File:** `scripts/deploy-staging.sh`

**Features:**
- ✅ **Automatic port conflict detection** - Checks for available ports before deployment
- ✅ **Dynamic port assignment** - Automatically uses alternatives if preferred ports are in use
- ✅ **No container conflicts** - Only manages `search-*` containers, never touches existing ones
- ✅ **Nginx configuration** - Automatically creates/updates Nginx config for `search.test.mangwale.ai`
- ✅ **Health checks** - Verifies all services are running correctly
- ✅ **Index setup** - Automatically sets up OpenSearch indices

**Key Improvements:**
- Fixed path resolution (works from any directory)
- Improved port conflict detection (tracks assigned ports)
- Better service name mapping (uses `search-*` prefix)
- Handles both `127.0.0.1:PORT:PORT` and `PORT:PORT` port formats

### 3. CI/CD Pipeline
**File:** `.github/workflows/deploy-search-staging.yml`

**Triggers:**
- Push to `main` or `master` branch
- Manual workflow dispatch

**Process:**
1. Checks out code
2. Sets up SSH authentication
3. Syncs code to server (`/root/searchv2`)
4. Runs deployment script
5. Verifies deployment health

**Required GitHub Secrets:**
- `SEARCH_STAGING_SSH_HOST` - Server IP: `103.160.107.41`
- `SEARCH_STAGING_SSH_USER` - SSH user (e.g., `root`)
- `SEARCH_STAGING_SSH_KEY` - Private SSH key (no passphrase)

## 🚀 Deployment Process

### First-Time Setup

1. **Ensure prerequisites are installed:**
   ```bash
   # Docker & Docker Compose
   docker --version
   docker-compose --version
   
   # Nginx
   nginx -v
   
   # Certbot (for SSL)
   certbot --version
   ```

2. **Run deployment:**
   ```bash
   cd /root/searchv2
   chmod +x scripts/deploy-staging.sh
   ./scripts/deploy-staging.sh deploy
   ```

3. **Set up SSL certificate:**
   ```bash
   sudo certbot --nginx -d search.test.mangwale.ai
   ```

### Port Management

The deployment script automatically:
- ✅ Detects which ports are in use
- ✅ Assigns alternative ports if needed
- ✅ Updates docker-compose file with chosen ports
- ✅ Updates Nginx configuration with correct ports

**Example port assignments (if conflicts exist):**
- Search API: `3100` → `3110` (if 3100 in use)
- Frontend: `6000` → `6010` (if 6000 in use)
- MySQL: `3306` → `3307` (if 3306 in use)
- Redpanda Proxy: `8082` → `8084` (if 8082/8083 in use)
- Kafka Connect: `8083` → `8085` (if 8083 in use)
- Adminer: `8086` → `8087` (if 8086 in use)

### Service URLs

After deployment:
- **Frontend:** https://search.test.mangwale.ai
- **API:** https://search.test.mangwale.ai/search (and other API endpoints)
- **Health Check:** https://search.test.mangwale.ai/health
- **API Docs:** https://search.test.mangwale.ai/api-docs

## 🔒 Safety Features

### No Container Conflicts
- ✅ Only manages containers with `search-*` prefix
- ✅ Never touches existing containers (`dashboard_mangwale_*`, `helper-mangwale-*`, etc.)
- ✅ Uses separate Docker network (`search-network`)

### No Port Conflicts
- ✅ Checks all ports before assignment
- ✅ Uses alternatives if preferred ports are in use
- ✅ Tracks assigned ports to prevent duplicates
- ✅ All services bound to `127.0.0.1` only (not publicly exposed)

### No Network Conflicts
- ✅ Uses separate subnet (`172.26.0.0/16`)
- ✅ Doesn't interfere with existing networks

## 📋 Container Names Used

All containers use `search-*` prefix:
- `search-opensearch`
- `search-opensearch-dashboards`
- `search-mysql`
- `search-redis`
- `search-clickhouse`
- `search-redpanda`
- `search-kafka-connect`
- `search-embedding-service`
- `search-api`
- `search-frontend`
- `search-cdc-consumer`
- `search-adminer`

## 🔄 CI/CD Setup

### GitHub Secrets Configuration

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following secrets:

   **SEARCH_STAGING_SSH_HOST**
   ```
   103.160.107.41
   ```

   **SEARCH_STAGING_SSH_USER**
   ```
   root
   ```
   (or your SSH username)

   **SEARCH_STAGING_SSH_KEY**
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   [Your private SSH key content]
   -----END OPENSSH PRIVATE KEY-----
   ```

### Testing CI/CD

1. Make a change to your code
2. Commit and push to `main` branch
3. GitHub Actions will automatically:
   - Deploy the changes
   - Run health checks
   - Report status

## 🛠️ Manual Deployment Commands

```bash
# Full deployment
./scripts/deploy-staging.sh deploy

# Build images only
./scripts/deploy-staging.sh build

# Start services
./scripts/deploy-staging.sh start

# Health checks
./scripts/deploy-staging.sh health

# Setup indices
./scripts/deploy-staging.sh indices

# Setup Nginx
./scripts/deploy-staging.sh nginx

# Show access info
./scripts/deploy-staging.sh info
```

## 📝 Notes

- **Domain:** `search.test.mangwale.ai` → `103.160.107.41`
- **Project Location:** `/root/searchv2`
- **Nginx Config:** `/etc/nginx/sites-available/search.test.mangwale.ai`
- **SSL Certificates:** `/etc/letsencrypt/live/search.test.mangwale.ai/`

## ✅ Verification Checklist

After deployment, verify:
- [ ] All containers are running: `docker ps | grep search-`
- [ ] Nginx config is active: `sudo nginx -t`
- [ ] SSL certificate is valid: `sudo certbot certificates`
- [ ] Frontend is accessible: `curl -I https://search.test.mangwale.ai`
- [ ] API is accessible: `curl https://search.test.mangwale.ai/health`
- [ ] No port conflicts: `sudo netstat -tlnp | grep LISTEN`

## 🆘 Troubleshooting

### Port Conflicts
If you see port conflicts, the script will automatically use alternatives. Check the deployment output for actual port assignments.

### Container Conflicts
All containers use `search-*` prefix. If you see conflicts, check:
```bash
docker ps --format "{{.Names}}" | grep search-
```

### Nginx Issues
Check Nginx configuration:
```bash
sudo nginx -t
sudo systemctl status nginx
```

### SSL Certificate Issues
Renew certificate:
```bash
sudo certbot renew --nginx -d search.test.mangwale.ai
```

---

**Last Updated:** $(date)  
**Status:** ✅ Ready for Deployment
