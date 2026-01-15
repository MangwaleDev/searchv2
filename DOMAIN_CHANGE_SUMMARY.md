# Domain Migration Summary: search.test.mangwale.ai → search.mangwale.ai

## ✅ Changes Completed

All necessary code changes have been made to migrate from `search.test.mangwale.ai` to `search.mangwale.ai`.

### Updated Files

1. **`scripts/deploy-staging.sh`**
   - Updated `DOMAIN` variable from `search.test.mangwale.ai` to `search.mangwale.ai`
   - Updated all Nginx configuration templates
   - Updated SSL certificate paths
   - Updated deployment messages and warnings

2. **`nginx/search.mangwale.ai.conf`** (NEW)
   - Complete HTTPS Nginx configuration for production domain
   - Includes SSL settings, security headers, and proxy configurations
   - Configured for ports 3100 (API) and 6000 (Frontend)

3. **`nginx/search.mangwale.ai.http.conf`** (NEW)
   - HTTP-only configuration for initial setup before SSL certificates
   - Temporary configuration for Certbot certificate generation

4. **`.github/workflows/deploy-search-staging.yml`**
   - Updated workflow name from "Deploy to search.test.mangwale.ai" to "Deploy to search.mangwale.ai"

5. **`apps/search-web/vite.config.ts`**
   - Updated proxy headers from `search.test.mangwale.ai` to `search.mangwale.ai`
   - Kept `search.test.mangwale.ai` in `allowedHosts` for backward compatibility

6. **`DOMAIN_MIGRATION_TO_PRODUCTION.md`** (NEW)
   - Complete migration guide with step-by-step instructions
   - DNS configuration instructions
   - SSL certificate setup
   - Troubleshooting guide

## 🚀 Next Steps

### 1. DNS Configuration (REQUIRED)

**Point `search.mangwale.ai` to server IP `103.160.107.41`:**

Add/Update A record in your DNS provider:
```
Type: A
Name: search
Value: 103.160.107.41
TTL: 300
```

**Verify DNS resolution:**
```bash
dig search.mangwale.ai +short
# Should return: 103.160.107.41
```

### 2. Deploy to Server

SSH into the server and run:
```bash
cd /root/searchv2
./scripts/deploy-staging.sh deploy
```

This will:
- Update Docker Compose with available ports
- Create Nginx configuration for `search.mangwale.ai`
- Set up the reverse proxy

### 3. SSL Certificate Setup

**Option A: Using Certbot (Recommended)**
```bash
# Use HTTP-only config temporarily
sudo cp /root/searchv2/nginx/search.mangwale.ai.http.conf /etc/nginx/sites-available/search.mangwale.ai
sudo ln -sf /etc/nginx/sites-available/search.mangwale.ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d search.mangwale.ai
```

**Option B: Manual (if certificates exist)**
```bash
# Copy HTTPS config
sudo cp /root/searchv2/nginx/search.mangwale.ai.conf /etc/nginx/sites-available/search.mangwale.ai
sudo ln -sf /etc/nginx/sites-available/search.mangwale.ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4. Verify Deployment

```bash
# Health check
curl https://search.mangwale.ai/health

# API test
curl https://search.mangwale.ai/v2/search/items?q=pizza&module_id=4

# Frontend
curl -I https://search.mangwale.ai/
```

## 📋 Production URLs

After migration, these URLs will be available:

- **Frontend**: https://search.mangwale.ai
- **API Health**: https://search.mangwale.ai/health
- **API Docs**: https://search.mangwale.ai/api-docs
- **Search API**: https://search.mangwale.ai/v2/search/items
- **Categories API**: https://search.mangwale.ai/v2/search/categories
- **Stores API**: https://search.mangwale.ai/v2/search/stores

## ⚠️ Important Notes

1. **DNS Propagation**: Allow 5-15 minutes (up to 48 hours) for DNS changes
2. **SSL Certificates**: New Let's Encrypt certificates needed for `search.mangwale.ai`
3. **Old Domain**: `search.test.mangwale.ai` will continue working until removed
4. **CI/CD**: GitHub Actions will auto-deploy to `search.mangwale.ai` on push to main/master

## 📚 Documentation

See `DOMAIN_MIGRATION_TO_PRODUCTION.md` for detailed step-by-step instructions.

## 🔍 Verification Checklist

- [ ] DNS A record points `search.mangwale.ai` to `103.160.107.41`
- [ ] DNS resolution works: `dig search.mangwale.ai +short`
- [ ] Deployment script runs successfully
- [ ] Nginx configuration is valid: `sudo nginx -t`
- [ ] SSL certificates are installed
- [ ] HTTPS works: `curl -I https://search.mangwale.ai`
- [ ] API responds: `curl https://search.mangwale.ai/health`
- [ ] Frontend loads: Browser test `https://search.mangwale.ai`
