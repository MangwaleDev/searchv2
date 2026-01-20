#!/bin/bash
###############################################################################
# MinIO Setup Script for storage.mangwale.ai
# This script configures MinIO with buckets, policies, and S3 alias
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MINIO_CONTAINER="search-minio"
MC_CONTAINER="search-minio-mc"
MINIO_ALIAS="myminio"
MINIO_ENDPOINT="http://search-minio:9000"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin123}"
BUCKET_NAME="${MINIO_BUCKET:-mangwale}"

# S3 Configuration (for sync)
S3_ALIAS="s3aws"
S3_ENDPOINT="${S3_ENDPOINT:-s3.ap-south-1.amazonaws.com}"
S3_BUCKET="${S3_BUCKET:-mangwale}"
S3_ACCESS_KEY="${AWS_ACCESS_KEY_ID}"
S3_SECRET_KEY="${AWS_SECRET_ACCESS_KEY}"
S3_REGION="${S3_REGION:-ap-south-1}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           MinIO Setup for storage.mangwale.ai                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Wait for MinIO to be ready
echo -e "${YELLOW}[1/6]${NC} Waiting for MinIO to be ready..."
for i in {1..30}; do
    if docker exec $MINIO_CONTAINER curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} MinIO is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗${NC} MinIO failed to start"
        exit 1
    fi
    sleep 2
done

# Configure MinIO client
echo -e "${YELLOW}[2/6]${NC} Configuring MinIO client..."
docker exec $MC_CONTAINER mc alias set $MINIO_ALIAS $MINIO_ENDPOINT $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} MinIO client configured"
else
    echo -e "${RED}✗${NC} Failed to configure MinIO client"
    exit 1
fi

# Create bucket if it doesn't exist
echo -e "${YELLOW}[3/6]${NC} Creating bucket '${BUCKET_NAME}'..."
if docker exec $MC_CONTAINER mc ls $MINIO_ALIAS/$BUCKET_NAME > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠${NC} Bucket '${BUCKET_NAME}' already exists"
else
    docker exec $MC_CONTAINER mc mb $MINIO_ALIAS/$BUCKET_NAME > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Bucket '${BUCKET_NAME}' created"
    else
        echo -e "${RED}✗${NC} Failed to create bucket"
        exit 1
    fi
fi

# Set bucket policy to public read
echo -e "${YELLOW}[4/6]${NC} Setting bucket policy to public read..."
docker exec $MC_CONTAINER mc anonymous set download $MINIO_ALIAS/$BUCKET_NAME > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Bucket policy set to public read"
else
    echo -e "${YELLOW}⚠${NC} Failed to set bucket policy (may need manual configuration)"
fi

# Configure S3 alias for sync (if credentials provided)
if [ -n "$S3_ACCESS_KEY" ] && [ -n "$S3_SECRET_KEY" ]; then
    echo -e "${YELLOW}[5/6]${NC} Configuring S3 alias for sync..."
    docker exec $MC_CONTAINER mc alias set $S3_ALIAS https://$S3_ENDPOINT $S3_ACCESS_KEY $S3_SECRET_KEY > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} S3 alias configured"
        
        # Test S3 connection
        if docker exec $MC_CONTAINER mc ls $S3_ALIAS/$S3_BUCKET > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} S3 connection verified"
        else
            echo -e "${YELLOW}⚠${NC} S3 bucket '${S3_BUCKET}' not accessible (may not exist or wrong credentials)"
        fi
    else
        echo -e "${YELLOW}⚠${NC} Failed to configure S3 alias (credentials may be missing)"
    fi
else
    echo -e "${YELLOW}[5/6]${NC} Skipping S3 alias configuration (credentials not provided)"
    echo -e "${YELLOW}⚠${NC} Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to enable S3 sync"
fi

# Create directory structure
echo -e "${YELLOW}[6/6]${NC} Creating directory structure..."
DIRECTORIES=("product" "store" "store/cover" "category" "banner" "delivery-man" "meta")
for DIR in "${DIRECTORIES[@]}"; do
    docker exec $MC_CONTAINER mc mb --ignore-existing $MINIO_ALIAS/$BUCKET_NAME/$DIR > /dev/null 2>&1
done
echo -e "${GREEN}✓${NC} Directory structure created"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ MinIO Setup Complete                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "📊 MinIO Configuration:"
echo "  • Endpoint: http://search-minio:9000"
echo "  • Console: http://localhost:9010"
echo "  • Bucket: ${BUCKET_NAME}"
echo "  • Public URL: https://storage.mangwale.ai/${BUCKET_NAME}/"
echo ""
echo "📁 Directory Structure:"
for DIR in "${DIRECTORIES[@]}"; do
    echo "  • ${BUCKET_NAME}/${DIR}/"
done
echo ""
echo "🔄 Next Steps:"
echo "  1. Run sync script to sync images from S3:"
echo "     ./scripts/sync-s3-to-minio-production.sh"
echo "  2. Test image access:"
echo "     curl https://storage.mangwale.ai/${BUCKET_NAME}/product/test.jpg"
echo ""
