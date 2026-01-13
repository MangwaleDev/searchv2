# Domain Migration Guide: search.test.mangwale.ai → search.mangwale.ai

## Status: Configuration Updated ✅

All necessary configuration files have been updated to use the production domain `search.mangwale.ai`.

---

## 1. Files Updated

### A. Traefik Configuration
**File:** `/root/searchv2/traefik-config/dynamic/search-mangwale.yml`

**Changes Made:**
- Updated all Host rules from `search.test.mangwale.ai` to `search.mangwale.ai`
- API Router rule updated
- Suggest fix endpoint rule updated
- Frontend Router rule updated
- Frontend HTTP Router rule updated

```yaml
# BEFORE
rule: "Host(`search.test.mangwale.ai`)"

# AFTER
rule: "Host(`search.mangwale.ai`)"
```

### B. Nginx Configuration
**File:** `/root/searchv2/nginx/search.mangwale.ai.conf`

**Changes Made:**
- ✅ Updated server_name from Caddy config to `search.mangwale.ai`
- ✅ Changed SSL certificate paths to Let's Encrypt production domain
- ✅ Updated proxy_pass targets:
  - API: `http://127.0.0.1:3100`
  - Frontend: `http://127.0.0.1:6000`
  - ASR uploads: `http://127.0.0.1:3100`
- ✅ Added security headers (HSTS, CSP, etc.)
- ✅ Added OCSP stapling configuration
- ✅ Configured logging paths for production domain

---

## 2. SSL Certificate Status

### Current Status: ⚠️ Pending DNS Update
```
Existing Certificate: /etc/letsencrypt/live/search.test.mangwale.ai/
Required Certificate: /etc/letsencrypt/live/search.mangwale.ai/
```

### Why Certificate Generation Failed
```
Error: Could not bind TCP port 80
Reason: Port 80 is already in use by nginx
```

### Solution: Update DNS First (Recommended)

**Step 1:** Point your DNS to 103.86.176.59
```
search.mangwale.ai  A  103.86.176.59
```

**Step 2:** Wait 15-30 minutes for DNS propagation

**Step 3:** Generate SSL certificate using webroot method
```bash
certbot certonly --webroot -w /usr/share/nginx/html -d search.mangwale.ai
```

**Step 4:** Reload nginx to apply new certificate
```bash
sudo nginx -s reload
# or
sudo systemctl reload nginx
```

---

## 3. Alternative SSL Options

### Option A: Reuse Existing Certificate (Temporary)
While DNS propagates, you can temporarily use the test certificate:
```bash
# Create symlink to existing certificate
sudo ln -s /etc/letsencrypt/live/search.test.mangwale.ai/ \
           /etc/letsencrypt/live/search.mangwale.ai
```

### Option B: Use DNS Challenge (If you have DNS API access)
```bash
# Using Cloudflare (requires API token)
certbot certonly --dns-cloudflare -d search.mangwale.ai

# Using Route53 (AWS)
certbot certonly --dns-route53 -d search.mangwale.ai

# Using Azure DNS
certbot certonly --dns-azure -d search.mangwale.ai
```

### Option C: Manual DNS Challenge
```bash
certbot certonly --manual --preferred-challenges dns -d search.mangwale.ai
```

---

## 4. Complete Nginx Configuration

File: `/root/searchv2/nginx/search.mangwale.ai.conf`

```nginx
# Nginx configuration for search.mangwale.ai
# HTTPS reverse proxy configuration

# HTTP - Redirect to HTTPS
server {
    listen 80;
    server_name search.mangwale.ai;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS - Main server block
server {
    listen 443 ssl http2;
    server_name search.mangwale.ai;
    
    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/search.mangwale.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/search.mangwale.ai/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/search.mangwale.ai/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';" always;
    
    # Allow larger uploads for ASR
    client_max_body_size 20m;
    
    # API endpoints - proxy to search-api
    location ~ ^/(search|analytics|health|docs|docs-json|v2|api-docs)(/|$) {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Ssl on;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering off;
        proxy_request_buffering off;
    }
    
    # ASR uploads (exact match takes precedence over regex above)
    location = /search/asr {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_connect_timeout 15s;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Ssl on;
    }
    
    # Frontend - proxy to search-frontend
    location / {
        proxy_pass http://127.0.0.1:6000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Ssl on;
        
        # WebSocket support (if needed)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Cache-busted assets
        location /assets/ {
            proxy_pass http://127.0.0.1:6000;
            access_log off;
            expires 1y;
            add_header Cache-Control "public, max-age=31536000, immutable";
        }
    }
    
    # Health check endpoint
    location = /health {
        access_log off;
        proxy_pass http://127.0.0.1:3100/health;
        proxy_http_version 1.1;
    }
    
    # Logging
    access_log /var/log/nginx/search.mangwale.ai.access.log;
    error_log /var/log/nginx/search.mangwale.ai.error.log;
}
```

---

## 5. Complete Traefik Configuration

File: `/root/searchv2/traefik-config/dynamic/search-mangwale.yml`

```yaml
http:
  routers:
    # API Router (HTTPS)
    search-api:
      rule: "Host(`search.mangwale.ai`) && (PathPrefix(`/search`) || PathPrefix(`/analytics`) || PathPrefix(`/health`) || PathPrefix(`/docs`) || PathPrefix(`/api-docs`) || PathPrefix(`/v2`) || PathPrefix(`/sync`))"
      service: search-api-service
      entryPoints:
        - websecure
      priority: 10
      tls:
        certResolver: letsencrypt

    # Fix for Legacy Suggest Endpoint
    search-suggest-fix:
      rule: "Host(`search.mangwale.ai`) && PathPrefix(`/search/suggest`)"
      service: search-api-service
      entryPoints:
        - websecure
      priority: 20
      middlewares:
        - suggest-rewrite
      tls:
        certResolver: letsencrypt

    # Frontend Router (HTTPS)
    search-frontend:
      rule: "Host(`search.mangwale.ai`)"
      service: search-frontend-service
      entryPoints:
        - websecure
      priority: 1
      tls:
        certResolver: letsencrypt

    # Frontend Router (HTTP - for nginx proxy)
    search-frontend-http:
      rule: "Host(`search.mangwale.ai`)"
      service: search-frontend-service
      entryPoints:
        - web
      priority: 2
      middlewares:
        - trust-forwarded-proto

  middlewares:
    https-redirect:
      redirectScheme:
        scheme: https
        permanent: true
    
    trust-forwarded-proto:
      headers:
        customRequestHeaders:
          X-Forwarded-Proto: "https"
    
    suggest-rewrite:
      replacePathRegex:
        regex: "^/search/suggest(.*)"
        replacement: "/v2/search/suggest$1"

  services:
    search-api-service:
      loadBalancer:
        servers:
          - url: "http://search-api:3100"

    search-frontend-service:
      loadBalancer:
        servers:
          - url: "http://search-frontend:80"
```

---

## 6. Deployment Checklist

- [ ] **Step 1:** Update DNS record
  ```
  search.mangwale.ai  A  103.86.176.59
  ```
  
- [ ] **Step 2:** Wait for DNS propagation (15-30 minutes)
  ```bash
  # Verify DNS propagation
  nslookup search.mangwale.ai
  dig search.mangwale.ai
  ```

- [ ] **Step 3:** Generate SSL certificate
  ```bash
  certbot certonly --webroot -w /usr/share/nginx/html -d search.mangwale.ai
  ```

- [ ] **Step 4:** Reload nginx
  ```bash
  sudo nginx -t  # Test configuration
  sudo systemctl reload nginx
  ```

- [ ] **Step 5:** Reload Traefik (if using)
  ```bash
  docker restart search-traefik  # or your container name
  ```

- [ ] **Step 6:** Test HTTPS
  ```bash
  curl -I https://search.mangwale.ai/health
  ```

- [ ] **Step 7:** Verify SSL certificate
  ```bash
  openssl s_client -connect search.mangwale.ai:443
  ```

- [ ] **Step 8:** Check A+ SSL rating
  ```
  https://www.ssllabs.com/ssltest/analyze.html?d=search.mangwale.ai
  ```

---

## 7. Summary of Configuration

| Component | Configuration | Status |
|-----------|---------------|--------|
| **Traefik Routers** | search.mangwale.ai | ✅ Updated |
| **Nginx HTTPS** | search.mangwale.ai | ✅ Updated |
| **Nginx HTTP→HTTPS** | Redirect enabled | ✅ Configured |
| **API Proxy** | 127.0.0.1:3100 | ✅ Configured |
| **Frontend Proxy** | 127.0.0.1:6000 | ✅ Configured |
| **SSL Certificate** | /etc/letsencrypt/live/search.mangwale.ai/ | ⏳ Pending DNS |
| **Security Headers** | HSTS, CSP, X-Frame-Options | ✅ Enabled |
| **OCSP Stapling** | Enabled | ✅ Configured |

---

## 8. Troubleshooting

### Certificate Generation Fails with Port 80 Error
**Solution:** Update DNS first, then use webroot method instead of standalone.

### Nginx Won't Start After Update
```bash
# Test nginx configuration
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log
```

### DNS Not Resolving
```bash
# Flush DNS cache (Linux)
sudo systemd-resolve --flush-caches

# Check DNS propagation
nslookup search.mangwale.ai 8.8.8.8
```

### SSL Certificate Path Errors
```bash
# Verify certificate exists
ls -la /etc/letsencrypt/live/search.mangwale.ai/

# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/search.mangwale.ai/fullchain.pem -noout -text
```

---

## 9. Next Steps

1. ✅ Configuration files updated
2. ⏳ Point DNS to 103.86.176.59
3. ⏳ Generate SSL certificate
4. ⏳ Reload nginx and Traefik
5. ⏳ Test HTTPS connectivity
6. ⏳ Monitor logs for errors

You're all set! Just update your DNS and generate the SSL certificate.
