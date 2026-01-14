# Ports & Containers Reference - dashboard.mangwale.com

**Purpose:** Quick reference for ports and container names to avoid conflicts when deploying new services.

---

## 🔌 Port Usage

### Host Ports (DO NOT USE THESE)

| Port | Service | Container | Status |
|------|---------|-----------|--------|
| **80** | HTTP (Nginx Host) | System Nginx | ✅ IN USE |
| **443** | HTTPS (Nginx Host) | System Nginx | ✅ IN USE |
| **3000** | Dispatcher Web | dispatcher-web | ✅ IN USE |
| **3002** | Helper Backend | helper-mangwale-backend | ✅ IN USE |
| **3306** | MySQL | `dashboard_mangwale_mysql` | ✅ IN USE |
| **4000** | Rider API | rider-api | ✅ IN USE |
| **5000** | Dispatcher API | dispatcher-api | ✅ IN USE |
| **5174** | Helper Frontend (Dev) | HelperView (dev) | ✅ IN USE |
| **8080** | phpMyAdmin | `dashboard_mangwale_phpmyadmin` | ✅ IN USE |
| **8081** | Laravel App (HTTP) | `dashboard_mangwale_nginx` | ✅ IN USE |
| **8082** | Helper Frontend (Old) | mangwale-helper-frontend | ⚠️ OLD |
| **8083** | Helper Frontend (Prod) | helper-mangwale-frontend | ✅ IN USE |
| **8443** | Laravel App (HTTPS) | `dashboard_mangwale_nginx` | ✅ IN USE |
| **6381** | Redis | `dashboard_mangwale_redis` | ✅ IN USE |

### Available Ports (Safe to Use)

- **8084-8442** (except 8443)
- **8444-8999**
- **9000-2999** (except 3000, 3002)
- **3003-3305** (except 3306)
- **3307-3999** (except 4000)
- **4001-4999** (except 5000)
- **5001-5173** (except 5174)
- **5175-6379** (except 6381)
- **6382-65535**

---

## 🐳 Docker Containers

| Container Name | Service | Internal Port | Host Port |
|----------------|---------|---------------|-----------|
| `dashboard_mangwale_php` | PHP-FPM | 9000 | N/A (internal) |
| `dashboard_mangwale_nginx` | Nginx | 80, 443 | 8081, 8443 |
| `dashboard_mangwale_mysql` | MySQL | 3306 | 3306 |
| `dashboard_mangwale_phpmyadmin` | phpMyAdmin | 80 | 8080 |
| `dashboard_mangwale_redis` | Redis | 6379 | 6381 |
| `helper-mangwale-backend` | Helper Backend (NestJS) | 3002 | 3002 |
| `helper-mangwale-frontend` | Helper Frontend (React) | 80 | 8083 |
| `rider-api` | Rider API | 4000 | 4000 |
| `dispatcher-api` | Dispatcher API | 5000 | 5000 |
| `dispatcher-web` | Dispatcher Web | 3000 | 3000 |

---

## 🌐 Network Configuration

**Docker Networks:**
- `dashboard_mangwale_network` (bridge driver) - Dashboard services
- `helper-mangwale-network` (bridge driver) - Helper services

**Container Communication:**
- Containers communicate via network name: `db`, `php`, `nginx`, `redis`
- Host access: Use `host.docker.internal` or host IP
- Helper services use `helper-mangwale-network`

---

## 📋 Quick Reference

### For New Service Deployment:

1. **Check available ports:**
   ```bash
   sudo netstat -tlnp | grep LISTEN
   ```

2. **Check container names:**
   ```bash
   docker ps --format "{{.Names}}"
   ```

3. **Avoid these ports:** 80, 443, 3000, 3002, 3306, 4000, 5000, 5174, 8080, 8081, 8083, 8443, 6381

4. **Avoid these container names:**
   - `dashboard_mangwale_*`
   - `helper-mangwale-*`
   - `rider-api`
   - `dispatcher-api`
   - `dispatcher-web`

---

## 🔍 Verification Commands

```bash
# Check all listening ports
sudo netstat -tlnp | grep LISTEN

# Check Docker containers
docker compose ps
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Check specific port
sudo lsof -i :PORT_NUMBER

# Check container names
docker ps --format "{{.Names}}"
```

---

## ⚠️ Important Notes

- **Port 80 & 443:** Used by system Nginx (host-level)
- **Port 3002:** Helper Backend API (internal, proxied via Nginx)
- **Port 8083:** Helper Frontend (internal, proxied via Nginx)
- **Port 3306:** MySQL database (exposed to host)
- **Port 4000:** Rider API
- **Port 5000:** Dispatcher API
- **Port 3000:** Dispatcher Web
- **Port 8080:** phpMyAdmin web interface
- **Port 8081:** Laravel app HTTP (proxied by host Nginx)
- **Port 8443:** Laravel app HTTPS (proxied by host Nginx)
- **Port 6381:** Redis cache

**Always verify port availability before deploying new services!**

---

## 📍 Service URLs

- **Helper Frontend**: https://helper.mangwale.com
- **Helper Backend API**: https://helper.mangwale.com/api
- **Dashboard**: https://dashboard.mangwale.com
- **Track**: https://track.mangwale.in

---

**Last Updated:** $(date)  
**Project:** Mangwale Services  
**Location:** `/srv`
