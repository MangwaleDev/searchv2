#!/bin/bash
###############################################################################
# S3 to MinIO Sync Script for Production
# Syncs images from AWS S3 to MinIO for fast local access
# Run this script periodically (via cron) to keep MinIO in sync with S3
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MINIO_CONTAINER="search-minio-mc"
MINIO_ALIAS="myminio"
S3_ALIAS="s3aws"
BUCKET_NAME="${MINIO_BUCKET:-mangwale}"
S3_BUCKET="${S3_BUCKET:-mangwale}"

# Directories to sync
DIRECTORIES=("product" "store" "store/cover" "category" "banner" "delivery-man" "meta")

# Log file
LOG_FILE="/var/log/s3-minio-sync.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[$DATE] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$DATE] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          S3 → MinIO Sync for storage.mangwale.ai             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

log "=== Starting S3 → MinIO Sync ==="

# Check if containers are running
if ! docker ps | grep -q $MINIO_CONTAINER; then
    log_error "MinIO MC container ($MINIO_CONTAINER) is not running"
    exit 1
fi

# Check S3 alias
if ! docker exec $MINIO_CONTAINER mc alias list | grep -q $S3_ALIAS; then
    log_error "S3 alias ($S3_ALIAS) not configured. Run setup-minio.sh first"
    exit 1
fi

# Check MinIO alias
if ! docker exec $MINIO_CONTAINER mc alias list | grep -q $MINIO_ALIAS; then
    log_error "MinIO alias ($MINIO_ALIAS) not configured. Run setup-minio.sh first"
    exit 1
fi

# Sync each directory
TOTAL_SYNCED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0

for DIR in "${DIRECTORIES[@]}"; do
    echo -e "${YELLOW}Syncing: ${DIR}${NC}"
    log "Syncing directory: ${DIR}"
    
    # If the source prefix does not exist in S3, skip this directory gracefully
    if ! docker exec $MINIO_CONTAINER mc stat $S3_ALIAS/$S3_BUCKET/$DIR/ >/dev/null 2>&1; then
        echo -e "${BLUE}  ℹ Skipping ${DIR} (source prefix does not exist in S3)${NC}"
        log "Skipping ${DIR} - source prefix $S3_ALIAS/$S3_BUCKET/$DIR/ does not exist in S3"
        TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
        echo ""
        continue
    fi

    # Count files before sync
    S3_COUNT=$(docker exec $MINIO_CONTAINER mc ls --recursive $S3_ALIAS/$S3_BUCKET/$DIR/ 2>/dev/null | wc -l || echo "0")
    MINIO_COUNT_BEFORE=$(docker exec $MINIO_CONTAINER mc ls --recursive $MINIO_ALIAS/$BUCKET_NAME/$DIR/ 2>/dev/null | wc -l || echo "0")
    
    # Sync from S3 to MinIO (only new/changed files)
    SYNC_OUTPUT=$(docker exec $MINIO_CONTAINER mc mirror \
        --overwrite=false \
        --remove=false \
        --exclude "*.tmp" \
        --exclude "*.lock" \
        $S3_ALIAS/$S3_BUCKET/$DIR/ \
        $MINIO_ALIAS/$BUCKET_NAME/$DIR/ 2>&1) || {
        log_error "Failed to sync ${DIR}"
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        continue
    }
    
    # Count files after sync
    MINIO_COUNT_AFTER=$(docker exec $MINIO_CONTAINER mc ls --recursive $MINIO_ALIAS/$BUCKET_NAME/$DIR/ 2>/dev/null | wc -l || echo "0")
    SYNCED_COUNT=$((MINIO_COUNT_AFTER - MINIO_COUNT_BEFORE))
    
    if [ $SYNCED_COUNT -gt 0 ]; then
        echo -e "${GREEN}  ✓ Synced ${SYNCED_COUNT} new files${NC}"
        log "Synced ${SYNCED_COUNT} new files in ${DIR}"
        TOTAL_SYNCED=$((TOTAL_SYNCED + SYNCED_COUNT))
    else
        echo -e "${BLUE}  ℹ No new files to sync${NC}"
        log "No new files in ${DIR}"
    fi
    
    # Show summary
    echo "  S3: ${S3_COUNT} files | MinIO: ${MINIO_COUNT_AFTER} files"
    echo ""
done

log "=== Sync Complete ==="
log "Total files synced: ${TOTAL_SYNCED}"
log "Skipped directories: ${TOTAL_SKIPPED}"
log "Failed directories: ${TOTAL_FAILED}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ Sync Complete                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "📊 Summary:"
echo "  • Files synced: ${TOTAL_SYNCED}"
if [ $TOTAL_SKIPPED -gt 0 ]; then
    echo "  • Skipped directories: ${TOTAL_SKIPPED} (not in S3)"
fi
if [ $TOTAL_FAILED -gt 0 ]; then
    echo -e "  • ${RED}Failed directories: ${TOTAL_FAILED}${NC}"
else
    echo "  • Failed directories: 0"
fi
echo "  • Log file: ${LOG_FILE}"
echo ""
echo "🔄 To set up automatic syncing, add to crontab:"
echo "   # Sync every 6 hours"
echo "   0 */6 * * * /root/searchv2/scripts/sync-s3-to-minio-production.sh"
echo ""
