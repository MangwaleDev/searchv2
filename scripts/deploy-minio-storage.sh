#!/bin/bash
###############################################################################
# MinIO Storage Deployment Script for storage.mangwale.ai
# Sets up MinIO with HTTPS, SSL certificates, and S3 sync
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="storage.mangwale.ai"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.production.yml"
NGINX_CONFIG="/etc/nginx/sites-available/storage.mangwale.ai"
NGINX_HTTP_CONFIG="/etc/nginx/sites-available/storage.mangwale.ai.http"

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

cd "$PROJECT_ROOT" || exit 1

print_header "MinIO Storage Deployment for $DOMAIN"

# Step 1: Start MinIO services
print_header "Step 1: Starting MinIO Services"
docker-compose -f "$COMPOSE_FILE" up -d search-minio search-minio-mc
sleep 5
print_success "MinIO services started"

# Step 2: Setup MinIO (buckets, policies, S3 alias)
print_header "Step 2: Configuring MinIO"
if [ -f "$PROJECT_ROOT/scripts/setup-minio.sh" ]; then
    bash "$PROJECT_ROOT/scripts/setup-minio.sh"
    print_success "MinIO configured"
else
    print_error "setup-minio.sh not found"
    exit 1
fi

# Step 3: Setup Nginx configuration
print_header "Step 3: Setting up Nginx Configuration"

# Copy HTTP config for initial SSL setup
if [ -f "$PROJECT_ROOT/nginx/storage.mangwale.ai.http.conf" ]; then
    cp "$PROJECT_ROOT/nginx/storage.mangwale.ai.http.conf" "$NGINX_HTTP_CONFIG"
    ln -sf "$NGINX_HTTP_CONFIG" /etc/nginx/sites-enabled/storage.mangwale.ai
    nginx -t && systemctl reload nginx
    print_success "Nginx HTTP configuration installed"
else
    print_error "Nginx HTTP config template not found"
    exit 1
fi

# Step 4: Get SSL certificates
print_header "Step 4: Obtaining SSL Certificates"
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    print_info "Requesting SSL certificate from Let's Encrypt..."
    certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@mangwale.ai || {
        print_error "Failed to obtain SSL certificate"
        print_warning "Make sure DNS is pointing to this server"
        exit 1
    }
    print_success "SSL certificate obtained"
else
    print_success "SSL certificate already exists"
fi

# Step 5: Install HTTPS Nginx config
print_header "Step 5: Installing HTTPS Nginx Configuration"
if [ -f "$PROJECT_ROOT/nginx/storage.mangwale.ai.conf" ]; then
    cp "$PROJECT_ROOT/nginx/storage.mangwale.ai.conf" "$NGINX_CONFIG"
    ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/storage.mangwale.ai
    nginx -t && systemctl reload nginx
    print_success "Nginx HTTPS configuration installed"
else
    print_error "Nginx HTTPS config template not found"
    exit 1
fi

# Step 6: Initial S3 sync (optional)
print_header "Step 6: Initial S3 Sync (Optional)"
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    print_info "Running initial S3 to MinIO sync..."
    if [ -f "$PROJECT_ROOT/scripts/sync-s3-to-minio-production.sh" ]; then
        bash "$PROJECT_ROOT/scripts/sync-s3-to-minio-production.sh" || {
            print_warning "Initial sync had issues (this is OK, sync can be run later)"
        }
    fi
else
    print_warning "AWS credentials not set, skipping initial sync"
    print_info "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to enable S3 sync"
fi

# Step 7: Setup cron job for periodic sync
print_header "Step 7: Setting up Automatic Sync"
CRON_JOB="0 */6 * * * $PROJECT_ROOT/scripts/sync-s3-to-minio-production.sh >> /var/log/s3-minio-sync.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "sync-s3-to-minio-production.sh"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    print_success "Cron job added (syncs every 6 hours)"
else
    print_info "Cron job already exists"
fi

# Final summary
print_header "Deployment Complete!"

echo -e "${GREEN}MinIO Storage is now deployed and accessible!${NC}\n"

echo -e "${BLUE}Access URLs:${NC}"
echo -e "  • MinIO API:              ${GREEN}https://$DOMAIN${NC}"
echo -e "  • MinIO Console (Local):  ${GREEN}http://localhost:9010${NC}"
echo -e "  • Image Example:         ${GREEN}https://$DOMAIN/mangwale/product/test.jpg${NC}"

echo -e "\n${BLUE}Configuration:${NC}"
echo -e "  • Bucket:                 mangwale"
echo -e "  • Public Access:          Enabled (read-only)"
echo -e "  • S3 Sync:                Every 6 hours (via cron)"

echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "  1. Run initial sync:       ${GREEN}./scripts/sync-s3-to-minio-production.sh${NC}"
echo -e "  2. Test image access:     ${GREEN}curl https://$DOMAIN/mangwale/product/[image-name]${NC}"
echo -e "  3. Monitor sync logs:      ${GREEN}tail -f /var/log/s3-minio-sync.log${NC}"

echo -e "\n${BLUE}MinIO Console Access:${NC}"
echo -e "  • URL:                    http://localhost:9010"
echo -e "  • Username:               minioadmin (or MINIO_ROOT_USER)"
echo -e "  • Password:               minioadmin123 (or MINIO_ROOT_PASSWORD)"
echo ""
