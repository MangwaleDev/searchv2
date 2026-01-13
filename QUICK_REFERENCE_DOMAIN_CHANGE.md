# Quick Reference: Domain Migration Summary

## ✅ Changes Completed

### 1. Traefik Configuration
**File:** `/root/searchv2/traefik-config/dynamic/search-mangwale.yml`
- ✅ API Router: `search.test.mangwale.ai` → `search.mangwale.ai`
- ✅ Suggest Fix: `search.test.mangwale.ai` → `search.mangwale.ai`
- ✅ Frontend Router: `search.test.mangwale.ai` → `search.mangwale.ai`
- ✅ Frontend HTTP: `search.test.mangwale.ai` → `search.mangwale.ai`

### 2. Nginx Configuration
**File:** `/root/searchv2/nginx/search.mangwale.ai.conf`
- ✅ Server name: `search.mangwale.ai`
- ✅ HTTP redirect to HTTPS enabled
- ✅ SSL certificate path: `/etc/letsencrypt/live/search.mangwale.ai/`
- ✅ API proxy: `http://127.0.0.1:3100`
- ✅ Frontend proxy: `http://127.0.0.1:6000`
- ✅ Security headers configured
- ✅ OCSP stapling enabled

---

## 🔧 Required Actions by You

### Step 1: Update DNS
Point your DNS A record to your server IP:

```bash
# DNS Record to create:
search.mangwale.ai  A  103.86.176.59
```

**Wait 15-30 minutes for DNS propagation**

### Step 2: Verify DNS Propagation
```bash
nslookup search.mangwale.ai
# or
dig search.mangwale.ai
# or
host search.mangwale.ai
```

Expected output should show `103.86.176.59`

### Step 3: Generate SSL Certificate
```bash
certbot certonly --webroot -w /usr/share/nginx/html -d search.mangwale.ai
```

### Step 4: Test and Reload Nginx
```bash
# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
# or
sudo service nginx reload
```

### Step 5: Verify HTTPS Works
```bash
curl -I https://search.mangwale.ai/health
# Should return 200 OK
```

---

## 📋 Configuration Files Changed

| File | Changes | Status |
|------|---------|--------|
| `/root/searchv2/traefik-config/dynamic/search-mangwale.yml` | All Host rules updated | ✅ Done |
| `/root/searchv2/nginx/search.mangwale.ai.conf` | Domain + SSL paths updated | ✅ Done |

---

## 🚀 Deployment Commands

```bash
# 1. Update DNS (do this in your DNS provider)
#    Set: search.mangwale.ai A 103.86.176.59

# 2. Wait for DNS propagation (15-30 min)
sleep 60 && dig search.mangwale.ai

# 3. Generate certificate
sudo certbot certonly --webroot -w /usr/share/nginx/html -d search.mangwale.ai

# 4. Test nginx configuration
sudo nginx -t

# 5. Reload nginx to apply changes
sudo systemctl reload nginx

# 6. Reload Traefik (if applicable)
docker restart <traefik-container-name>

# 7. Verify HTTPS
curl -I https://search.mangwale.ai/health
```

---

## 📝 Configuration Highlights

### Nginx Reverse Proxy Setup
- **HTTP:** Listens on port 80, redirects to HTTPS
- **HTTPS:** Listens on port 443, proxies to:
  - API: `127.0.0.1:3100`
  - Frontend: `127.0.0.1:6000`
- **SSL:** Uses Let's Encrypt certificates
- **Security:** HSTS, CSP, X-Frame-Options headers enabled
- **OCSP Stapling:** Enabled for certificate validation

### Traefik Configuration
- **API Router:** Handles `/search`, `/analytics`, `/health`, `/docs`, `/v2`, `/sync`
- **Frontend Router:** Handles all other routes
- **Priority:** API (10) > Suggest Fix (20) > Frontend (1)
- **Middleware:** Automatic HTTPS redirect, protocol trust

---

## 🔐 SSL Certificate Details

**Path:** `/etc/letsencrypt/live/search.mangwale.ai/`

**Files:**
- `fullchain.pem` - Full certificate chain
- `privkey.pem` - Private key
- `cert.pem` - Certificate only
- `chain.pem` - Intermediate certificate

**Auto-renewal:** Certbot will automatically renew before expiration (every 60 days)

---

## ✨ Security Features Configured

- ✅ TLS 1.2 & 1.3 only
- ✅ Strong cipher suites
- ✅ HSTS header (31536000 seconds = 1 year)
- ✅ OCSP Stapling
- ✅ Content Security Policy
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ Referrer-Policy: strict-origin-when-cross-origin

---

## 📞 Support

If you encounter issues:

1. **Check nginx logs:**
   ```bash
   sudo tail -f /var/log/nginx/search.mangwale.ai.error.log
   ```

2. **Check certificate validity:**
   ```bash
   openssl x509 -in /etc/letsencrypt/live/search.mangwale.ai/fullchain.pem -noout -text
   ```

3. **Verify DNS:**
   ```bash
   dig +short search.mangwale.ai
   # Should show: 103.86.176.59
   ```

4. **Test SSL:**
   ```bash
   openssl s_client -connect search.mangwale.ai:443 -servername search.mangwale.ai
   ```

---

**Next Step:** Update your DNS record to point `search.mangwale.ai` to `103.86.176.59`
