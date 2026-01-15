# Domain Migration Guide: search.test.mangwale.ai → search.mangwale.ai

This guide covers the complete migration from `search.test.mangwale.ai` to `search.mangwale.ai` (production domain).

## 📋 Prerequisites

- DNS access to configure `search.mangwale.ai`
- SSH access to the server at `103.160.107.41`
- Root or sudo access on the server

## 🔧 Step 1: DNS Configuration

**Point `search.mangwale.ai` to the server IP:**

1. Log in to your DNS provider (where `mangwale.ai` domain is managed)
2. Add or update the A record:
   ```
   Type: A
   Name: search
   Value: 103.160.107.41
   TTL: 300 (or your preferred TTL)
   ```
3. Wait for DNS propagation (usually 5-15 minutes, can take up to 48 hours)
4. Verify DNS resolution:
   ```bash
   dig search.mangwale.ai +short
   # Should return: 103.160.107.41
   
   # Or using nslookup:
   nslookup search.mangwale.ai
   # Should show: 103.160.107.41
   ```

## 🚀 Step 2: Server-Side Configuration

### 2.1 Update Deployment Script

The deployment script (`scripts/deploy-staging.sh`) has been updated to use `search.mangwale.ai`. No manual changes needed.

### 2.2 Deploy with New Domain

SSH into the server and run:

```bash
cd /root/searchv2
./scripts/deploy-staging.sh deploy
```

This will:
- Update Docker Compose with dynamic ports
- Create Nginx configuration for `search.mangwale.ai`
- Set up SSL certificates (if not already present)

### 2.3 SSL Certificate Setup

If SSL certificates don't exist yet:

**Option A: Using Certbot (Recommended)**

```bash
# First, temporarily use HTTP-only config
sudo cp /root/searchv2/nginx/search.mangwale.ai.http.conf /etc/nginx/sites-available/search.mangwale.ai
sudo ln -sf /etc/nginx/sites-available/search.mangwale.ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d search.mangwale.ai

# Certbot will automatically update the Nginx config with SSL settings
```

**Option B: Manual Certificate Installation**

If you have existing certificates, you can symlink them:

```bash
# If you have certificates from search.test.mangwale.ai, you can reuse them temporarily
# (Not recommended for production, but works for testing)
sudo ln -s /etc/letsencrypt/live/search.test.mangwale.ai /etc/letsencrypt/live/search.mangwale.ai

# Then update Nginx config
sudo cp /root/searchv2/nginx/search.mangwale.ai.conf /etc/nginx/sites-available/search.mangwale.ai
sudo ln -sf /etc/nginx/sites-available/search.mangwale.ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 2.4 Verify Nginx Configuration

```bash
# Test Nginx configuration
sudo nginx -t

# Check if site is enabled
ls -la /etc/nginx/sites-enabled/ | grep search.mangwale.ai

# Reload Nginx
sudo systemctl reload nginx
```

## ✅ Step 3: Verification

### 3.1 Test HTTP Redirect

```bash
curl -I http://search.mangwale.ai
# Should return: HTTP/1.1 301 Moved Permanently
# Location: https://search.mangwale.ai/...
```

### 3.2 Test HTTPS

```bash
# Health check
curl https://search.mangwale.ai/health

# API endpoint
curl https://search.mangwale.ai/v2/search/items?q=pizza&module_id=4

# Frontend
curl -I https://search.mangwale.ai/
```

### 3.3 Browser Test

1. Open `https://search.mangwale.ai` in your browser
2. Verify SSL certificate is valid (green lock icon)
3. Test search functionality
4. Check API documentation at `https://search.mangwale.ai/api-docs`

## 🔄 Step 4: Cleanup (Optional)

If you want to remove the old `search.test.mangwale.ai` configuration:

```bash
# Disable old site
sudo rm /etc/nginx/sites-enabled/search.test.mangwale.ai
sudo nginx -t && sudo systemctl reload nginx

# Note: Keep the SSL certificates for search.test.mangwale.ai if you might need them later
# To remove them completely:
# sudo certbot delete --cert-name search.test.mangwale.ai
```

## 📝 Updated Files

The following files have been updated to use `search.mangwale.ai`:

1. ✅ `scripts/deploy-staging.sh` - Domain variable and Nginx config generation
2. ✅ `nginx/search.mangwale.ai.conf` - HTTPS Nginx configuration
3. ✅ `nginx/search.mangwale.ai.http.conf` - HTTP-only Nginx configuration (for initial setup)
4. ✅ `.github/workflows/deploy-search-staging.yml` - CI/CD workflow name
5. ✅ `apps/search-web/vite.config.ts` - Frontend proxy configuration

## 🎯 Production URLs

After migration, the following URLs will be available:

- **Frontend**: https://search.mangwale.ai
- **API Health**: https://search.mangwale.ai/health
- **API Docs**: https://search.mangwale.ai/api-docs
- **Search API**: https://search.mangwale.ai/v2/search/items
- **Categories API**: https://search.mangwale.ai/v2/search/categories

## ⚠️ Important Notes

1. **DNS Propagation**: Allow 5-15 minutes (up to 48 hours) for DNS changes to propagate globally
2. **SSL Certificates**: Let's Encrypt certificates are domain-specific. You'll need new certificates for `search.mangwale.ai`
3. **Old Domain**: `search.test.mangwale.ai` will continue to work until you remove its Nginx configuration
4. **CI/CD**: The GitHub Actions workflow will automatically deploy to `search.mangwale.ai` on push to main/master

## 🆘 Troubleshooting

### DNS Not Resolving

```bash
# Check DNS resolution
dig search.mangwale.ai
nslookup search.mangwale.ai

# Flush local DNS cache (if testing locally)
# Linux:
sudo systemd-resolve --flush-caches
# macOS:
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
# Windows:
ipconfig /flushdns
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificates
sudo certbot renew --nginx -d search.mangwale.ai

# Check Nginx SSL configuration
sudo nginx -T | grep -A 10 "search.mangwale.ai"
```

### Nginx Errors

```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/search.mangwale.ai.error.log

# Check Nginx access logs
sudo tail -f /var/log/nginx/search.mangwale.ai.access.log

# Test Nginx configuration
sudo nginx -t
```

## 📞 Support

If you encounter issues during migration, check:

1. DNS resolution is correct
2. Nginx configuration is valid
3. SSL certificates are properly installed
4. Docker containers are running
5. Ports are correctly configured

For detailed deployment logs, check:
```bash
cd /root/searchv2
./scripts/deploy-staging.sh health
```
