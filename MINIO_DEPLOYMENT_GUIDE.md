# MinIO Deployment Guide for storage.mangwale.ai

This guide explains how to deploy MinIO on `https://storage.mangwale.ai` with S3 image synchronization.

## Overview

MinIO is deployed as a self-hosted S3-compatible object storage service that:
- Provides fast local access to images
- Syncs with AWS S3 for redundancy
- Serves images via HTTPS on `storage.mangwale.ai`
- Automatically syncs from S3 every 6 hours

## Architecture

```
AWS S3 (Source)
    ↓ (sync every 6h)
MinIO (Local Cache)
    ↓ (HTTPS)
storage.mangwale.ai
    ↓
Applications (Fast Image Access)
```

## Prerequisites

1. **DNS Configuration**: Point `storage.mangwale.ai` to your server IP
2. **AWS Credentials** (optional, for S3 sync):
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
3. **Server Requirements**:
   - Docker and Docker Compose
   - Nginx
   - Certbot (for SSL)

## Quick Deployment

### 1. One-Command Deployment

```bash
sudo ./scripts/deploy-minio-storage.sh
```

This script will:
- Start MinIO services
- Configure buckets and policies
- Set up Nginx with HTTPS
- Obtain SSL certificates
- Configure S3 sync (if credentials provided)
- Set up automatic syncing via cron

### 2. Manual Deployment

#### Step 1: Start MinIO Services

```bash
docker-compose -f docker-compose.production.yml up -d search-minio search-minio-mc
```

#### Step 2: Configure MinIO

```bash
./scripts/setup-minio.sh
```

This creates:
- Bucket: `mangwale`
- Directory structure: `product/`, `store/`, `store/cover/`, `category/`, etc.
- Public read access
- S3 alias (if credentials provided)

#### Step 3: Setup Nginx

```bash
# Copy HTTP config (for initial SSL setup)
sudo cp nginx/storage.mangwale.ai.http.conf /etc/nginx/sites-available/storage.mangwale.ai
sudo ln -s /etc/nginx/sites-available/storage.mangwale.ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d storage.mangwale.ai

# Install HTTPS config
sudo cp nginx/storage.mangwale.ai.conf /etc/nginx/sites-available/storage.mangwale.ai
sudo nginx -t && sudo systemctl reload nginx
```

#### Step 4: Initial S3 Sync

```bash
# Set AWS credentials (if not already set)
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"

# Run sync
./scripts/sync-s3-to-minio-production.sh
```

#### Step 5: Setup Automatic Sync

Add to crontab (syncs every 6 hours):

```bash
crontab -e
# Add this line:
0 */6 * * * /root/searchv2/scripts/sync-s3-to-minio-production.sh >> /var/log/s3-minio-sync.log 2>&1
```

## Configuration

### Environment Variables

Add to `.env.production`:

```env
# MinIO Configuration
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_BUCKET=mangwale
MINIO_URL=https://storage.mangwale.ai
MINIO_PUBLIC_URL=https://storage.mangwale.ai

# S3 Configuration (for sync)
S3_URL=https://mangwale.s3.ap-south-1.amazonaws.com
S3_BUCKET=mangwale
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### MinIO Console Access

Access MinIO console at `http://localhost:9010`:
- Username: `minioadmin` (or `MINIO_ROOT_USER`)
- Password: `minioadmin123` (or `MINIO_ROOT_PASSWORD`)

## Usage

### Image URLs

Images are accessible via:

```
https://storage.mangwale.ai/mangwale/{path}/{filename}
```

Examples:
- Product: `https://storage.mangwale.ai/mangwale/product/2025-01-15-abc123.jpg`
- Store Logo: `https://storage.mangwale.ai/mangwale/store/2025-01-15-logo.png`
- Category: `https://storage.mangwale.ai/mangwale/category/cat-icon.png`

### Directory Structure

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

## S3 Sync

### Manual Sync

```bash
./scripts/sync-s3-to-minio-production.sh
```

### Sync Status

Check sync logs:
```bash
tail -f /var/log/s3-minio-sync.log
```

### Sync Frequency

Default: Every 6 hours (configurable in crontab)

## Monitoring

### Check MinIO Health

```bash
docker exec search-minio curl -f http://localhost:9000/minio/health/live
```

### Check Bucket Status

```bash
docker exec search-minio-mc mc ls myminio/mangwale/
```

### Check Sync Status

```bash
# Count files in S3
docker exec search-minio-mc mc ls --recursive s3aws/mangwale/product/ | wc -l

# Count files in MinIO
docker exec search-minio-mc mc ls --recursive myminio/mangwale/product/ | wc -l
```

## Troubleshooting

### MinIO Not Starting

```bash
# Check logs
docker logs search-minio

# Check if port is in use
netstat -tuln | grep 9000
```

### SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Test Nginx config
sudo nginx -t
```

### S3 Sync Failing

1. Check AWS credentials:
   ```bash
   echo $AWS_ACCESS_KEY_ID
   echo $AWS_SECRET_ACCESS_KEY
   ```

2. Test S3 connection:
   ```bash
   docker exec search-minio-mc mc ls s3aws/mangwale/
   ```

3. Check sync logs:
   ```bash
   tail -f /var/log/s3-minio-sync.log
   ```

### Images Not Accessible

1. Check bucket policy:
   ```bash
   docker exec search-minio-mc mc anonymous get myminio/mangwale
   ```

2. Check Nginx config:
   ```bash
   sudo nginx -t
   curl -I https://storage.mangwale.ai/mangwale/product/test.jpg
   ```

3. Check MinIO logs:
   ```bash
   docker logs search-minio --tail 50
   ```

## Security

### Change Default Credentials

1. Update `.env.production`:
   ```env
   MINIO_ROOT_USER=your-secure-username
   MINIO_ROOT_PASSWORD=your-secure-password
   ```

2. Restart MinIO:
   ```bash
   docker-compose -f docker-compose.production.yml restart search-minio
   ```

3. Update MinIO client:
   ```bash
   docker exec search-minio-mc mc alias set myminio http://search-minio:9000 your-secure-username your-secure-password
   ```

### Bucket Policies

MinIO buckets are set to public read-only by default. To restrict access:

```bash
# Remove public access
docker exec search-minio-mc mc anonymous set none myminio/mangwale

# Set custom policy (requires policy file)
docker exec search-minio-mc mc anonymous set download myminio/mangwale
```

## Performance

### Caching

Nginx is configured to cache images for 30 days:
- Static images (jpg, png, etc.) are cached
- Cache-Control headers are set
- CDN-ready configuration

### Optimization

1. **Enable Nginx caching** (already configured)
2. **Use CDN** (CloudFront, Cloudflare) in front of MinIO
3. **Monitor disk usage**:
   ```bash
   docker exec search-minio du -sh /data
   ```

## Backup

### Backup MinIO Data

```bash
# Backup entire MinIO data directory
docker exec search-minio tar czf /tmp/minio-backup.tar.gz /data
docker cp search-minio:/tmp/minio-backup.tar.gz ./minio-backup-$(date +%Y%m%d).tar.gz
```

### Sync to S3 (Backup)

MinIO automatically syncs to S3, which serves as a backup. For manual backup:

```bash
./scripts/backup-minio-to-s3.sh
```

## Maintenance

### Update MinIO

```bash
docker-compose -f docker-compose.production.yml pull search-minio
docker-compose -f docker-compose.production.yml up -d search-minio
```

### Cleanup Old Images

```bash
# List old files (older than 1 year)
docker exec search-minio-mc mc find myminio/mangwale --older-than 365d

# Remove old files (be careful!)
docker exec search-minio-mc mc rm --recursive --older-than 365d myminio/mangwale/
```

## Integration with Search API

The search API is already configured to use MinIO. Update `.env.production`:

```env
STORAGE_TYPE=minio
MINIO_URL=https://storage.mangwale.ai
MINIO_PUBLIC_URL=https://storage.mangwale.ai
MINIO_BUCKET=mangwale
IMAGE_FALLBACK_ENABLED=true
```

The API will:
- Use MinIO as primary storage
- Fallback to S3 if MinIO is unavailable
- Return both URLs in responses

## Support

For issues or questions:
1. Check logs: `docker logs search-minio`
2. Check sync logs: `tail -f /var/log/s3-minio-sync.log`
3. Review this guide
4. Check MinIO documentation: https://min.io/docs/
