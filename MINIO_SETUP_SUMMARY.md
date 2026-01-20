# MinIO Setup Summary for storage.mangwale.ai

## ✅ Files Created

### 1. Docker Compose Configuration
- **File**: `docker-compose.production.yml`
- **Changes**: Added MinIO service and MinIO MC (client) container
- **Services**:
  - `search-minio`: MinIO server (ports 9000, 9010 for console)
  - `search-minio-mc`: MinIO client for management

### 2. Nginx Configurations
- **File**: `nginx/storage.mangwale.ai.conf`
  - HTTPS configuration with SSL
  - CORS headers for image access
  - Image caching (30 days)
  - Large file support (100MB)
  
- **File**: `nginx/storage.mangwale.ai.http.conf`
  - Temporary HTTP config for SSL certificate setup

### 3. Setup Scripts
- **File**: `scripts/setup-minio.sh`
  - Configures MinIO buckets
  - Sets up public read access
  - Creates directory structure
  - Configures S3 alias for sync

- **File**: `scripts/sync-s3-to-minio-production.sh`
  - Syncs images from S3 to MinIO
  - Supports incremental sync
  - Logs sync activity
  - Can be run manually or via cron

- **File**: `scripts/deploy-minio-storage.sh`
  - Complete deployment automation
  - Handles SSL certificates
  - Sets up Nginx
  - Configures automatic syncing

### 4. Documentation
- **File**: `MINIO_DEPLOYMENT_GUIDE.md`
  - Complete deployment guide
  - Troubleshooting section
  - Configuration examples
  - Maintenance procedures

## 🚀 Quick Start

### Option 1: Automated Deployment (Recommended)

```bash
cd /root/searchv2
sudo ./scripts/deploy-minio-storage.sh
```

This will:
1. Start MinIO services
2. Configure buckets and policies
3. Set up Nginx with HTTPS
4. Obtain SSL certificates
5. Configure S3 sync
6. Set up automatic syncing

### Option 2: Manual Deployment

```bash
# 1. Start MinIO
docker-compose -f docker-compose.production.yml up -d search-minio search-minio-mc

# 2. Setup MinIO
./scripts/setup-minio.sh

# 3. Setup Nginx and SSL
sudo cp nginx/storage.mangwale.ai.http.conf /etc/nginx/sites-available/storage.mangwale.ai
sudo ln -s /etc/nginx/sites-available/storage.mangwale.ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d storage.mangwale.ai
sudo cp nginx/storage.mangwale.ai.conf /etc/nginx/sites-available/storage.mangwale.ai
sudo nginx -t && sudo systemctl reload nginx

# 4. Initial S3 sync
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
./scripts/sync-s3-to-minio-production.sh

# 5. Setup cron for automatic sync
crontab -e
# Add: 0 */6 * * * /root/searchv2/scripts/sync-s3-to-minio-production.sh >> /var/log/s3-minio-sync.log 2>&1
```

## 📋 Configuration

### Environment Variables

Add to `.env.production`:

```env
# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_BUCKET=mangwale
MINIO_URL=https://storage.mangwale.ai
MINIO_PUBLIC_URL=https://storage.mangwale.ai

# S3 (for sync)
S3_URL=https://mangwale.s3.ap-south-1.amazonaws.com
S3_BUCKET=mangwale
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## 🔗 Access URLs

- **MinIO API**: `https://storage.mangwale.ai`
- **MinIO Console**: `http://localhost:9010`
- **Image Example**: `https://storage.mangwale.ai/mangwale/product/image.jpg`

## 📁 Directory Structure

```
mangwale/
├── product/          # Item/product images
├── store/            # Store logos
├── store/cover/      # Store cover photos
├── category/         # Category images
├── banner/           # Banner images
├── delivery-man/     # Delivery man photos
└── meta/             # Meta/OG images
```

## 🔄 S3 Sync

### Manual Sync
```bash
./scripts/sync-s3-to-minio-production.sh
```

### Automatic Sync
Configured via cron to run every 6 hours. Check logs:
```bash
tail -f /var/log/s3-minio-sync.log
```

## ✅ Verification

### Test MinIO Health
```bash
docker exec search-minio curl -f http://localhost:9000/minio/health/live
```

### Test Image Access
```bash
curl -I https://storage.mangwale.ai/mangwale/product/test.jpg
```

### Check Bucket Status
```bash
docker exec search-minio-mc mc ls myminio/mangwale/
```

## 📚 Documentation

For detailed information, see:
- `MINIO_DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `scripts/setup-minio.sh` - Setup script with inline comments
- `scripts/sync-s3-to-minio-production.sh` - Sync script with inline comments

## 🔧 Troubleshooting

### MinIO Not Starting
```bash
docker logs search-minio
docker-compose -f docker-compose.production.yml restart search-minio
```

### SSL Issues
```bash
sudo certbot renew
sudo nginx -t
sudo systemctl reload nginx
```

### Sync Issues
```bash
# Check AWS credentials
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY

# Test S3 connection
docker exec search-minio-mc mc ls s3aws/mangwale/

# Check sync logs
tail -f /var/log/s3-minio-sync.log
```

## 🎯 Next Steps

1. **Deploy MinIO**: Run `sudo ./scripts/deploy-minio-storage.sh`
2. **Initial Sync**: Run `./scripts/sync-s3-to-minio-production.sh`
3. **Test Access**: Try accessing an image URL
4. **Monitor**: Check sync logs regularly
5. **Update API**: Ensure search API uses MinIO URLs

## 🔐 Security Notes

1. **Change Default Credentials**: Update `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` in `.env.production`
2. **Bucket Policies**: Currently set to public read-only (suitable for images)
3. **SSL**: HTTPS is required and automatically configured
4. **CORS**: Configured for cross-origin image access

## 📊 Monitoring

- **MinIO Health**: `docker exec search-minio curl http://localhost:9000/minio/health/live`
- **Sync Logs**: `tail -f /var/log/s3-minio-sync.log`
- **Nginx Logs**: `tail -f /var/log/nginx/storage.mangwale.ai.access.log`
- **Disk Usage**: `docker exec search-minio du -sh /data`

---

**All files are ready for deployment!** 🚀
