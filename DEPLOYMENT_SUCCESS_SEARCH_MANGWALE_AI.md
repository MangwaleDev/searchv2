# ✅ Deployment Success: search.mangwale.ai

## 🎉 Status: LIVE and OPERATIONAL

The search service has been successfully deployed to `search.mangwale.ai` (production domain).

## 📋 Deployment Summary

**Date**: January 14, 2026  
**Domain**: `search.mangwale.ai`  
**Server IP**: `103.160.107.41`  
**SSL**: ✅ Installed and working

## 🔧 Service Ports (Dynamic Assignment)

Due to port conflicts, the deployment script automatically assigned alternative ports:

| Service | Port | Status |
|---------|------|--------|
| Search API | **3110** | ✅ Running |
| Frontend | **6010** | ✅ Running |
| Embedding Service | **3111** | ✅ Running |
| OpenSearch | **9210** | ✅ Running |
| OpenSearch Dashboards | **5611** | ✅ Running |
| MySQL | **3308** | ✅ Running |
| ClickHouse HTTP | **8124** | ✅ Running |
| ClickHouse Native | **9001** | ✅ Running |
| Redpanda/Kafka | **9093** | ✅ Running |
| Redpanda Proxy | **8087** | ✅ Running |
| Kafka Connect | **8087** | ✅ Running |
| Adminer | **8087** | ✅ Running |

## 🌐 Access URLs

### Production (HTTPS)
- **Frontend**: https://search.mangwale.ai
- **API Health**: https://search.mangwale.ai/health
- **API Docs**: https://search.mangwale.ai/api-docs
- **Search API**: https://search.mangwale.ai/v2/search/items
- **Categories API**: https://search.mangwale.ai/v2/search/categories
- **Stores API**: https://search.mangwale.ai/v2/search/stores

### Local (for debugging)
- **Frontend**: http://localhost:6010
- **Search API**: http://localhost:3110
- **API Docs**: http://localhost:3110/api-docs
- **OpenSearch**: http://localhost:9210
- **OpenSearch Dashboards**: http://localhost:5611
- **Adminer (MySQL UI)**: http://localhost:8087

## ✅ Verification Tests

All endpoints tested and working:

```bash
# Health check
curl https://search.mangwale.ai/health
# Response: {"ok":true,"opensearch":"yellow"}

# Search items
curl "https://search.mangwale.ai/v2/search/items?q=pizza&module_id=4"
# Response: JSON with pizza items

# Categories
curl "https://search.mangwale.ai/v2/search/categories?store_id=229&module_id=4"
# Response: JSON with categories and item counts
```

## 🔧 Nginx Configuration

**Important**: After Certbot installs SSL certificates, it may overwrite the port numbers in the Nginx config. If you get a 502 Bad Gateway error, update the ports:

```bash
# Manual update
sudo sed -i 's|proxy_pass http://127.0.0.1:3100;|proxy_pass http://127.0.0.1:3110;|g' /etc/nginx/sites-enabled/search.mangwale.ai
sudo sed -i 's|proxy_pass http://127.0.0.1:6000;|proxy_pass http://127.0.0.1:6010;|g' /etc/nginx/sites-enabled/search.mangwale.ai
sudo nginx -t && sudo systemctl reload nginx

# Or use the helper script
./scripts/update-nginx-ports.sh
```

## 📝 Key Changes Made

1. ✅ Updated `scripts/deploy-staging.sh` to use `search.mangwale.ai`
2. ✅ Created Nginx configurations for production domain
3. ✅ Updated GitHub Actions workflow
4. ✅ Updated frontend `vite.config.ts` proxy headers
5. ✅ Fixed Nginx port mappings (3110 for API, 6010 for frontend)
6. ✅ SSL certificates installed via Certbot

## 🚀 CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy-search-staging.yml`) is configured to:
- Trigger on push to `main`/`master` branches
- Sync code to `/root/searchv2` on the server
- Run `./scripts/deploy-staging.sh deploy` automatically

## 📚 Documentation

- **Migration Guide**: `DOMAIN_MIGRATION_TO_PRODUCTION.md`
- **Quick Summary**: `DOMAIN_CHANGE_SUMMARY.md`
- **Helper Script**: `scripts/update-nginx-ports.sh`

## 🔍 Monitoring

Check service status:
```bash
cd /root/searchv2
docker-compose -f docker-compose.production.yml ps
```

View logs:
```bash
docker-compose -f docker-compose.production.yml logs -f search-api
docker-compose -f docker-compose.production.yml logs -f search-frontend
```

## ⚠️ Important Notes

1. **Port Changes**: If you redeploy and ports change, remember to update Nginx config
2. **SSL Renewal**: Certbot will auto-renew certificates (expires April 14, 2026)
3. **DNS**: Ensure `search.mangwale.ai` A record points to `103.160.107.41`
4. **Old Domain**: `search.test.mangwale.ai` still works but should be deprecated

## 🎯 Next Steps

1. ✅ DNS configured and pointing to server
2. ✅ SSL certificates installed
3. ✅ Services running and accessible
4. ✅ API endpoints tested and working
5. ⏭️ Monitor for any issues
6. ⏭️ Consider removing `search.test.mangwale.ai` config when ready

## ✨ Success!

The search service is now live at **https://search.mangwale.ai** and ready for production use!
