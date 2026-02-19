#!/bin/bash
###############################################################################
# Add S3 → MinIO sync to crontab (run every 6 hours)
# Run this script once: ./scripts/install-crontab-s3-sync.sh
#
# Do NOT paste "0 */6 * * * ..." at the shell prompt — that runs a command
# named "0" and causes "0: command not found". Use this script or crontab -e.
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_SCRIPT="${SCRIPT_DIR}/sync-s3-to-minio-production.sh"
CRON_LINE="0 */6 * * * ${SYNC_SCRIPT}"

if [ ! -x "$SYNC_SCRIPT" ]; then
    echo "Error: Sync script not found or not executable: $SYNC_SCRIPT"
    exit 1
fi

# Check if this exact line already exists
if crontab -l 2>/dev/null | grep -Fq "$SYNC_SCRIPT"; then
    echo "Crontab already contains an entry for the S3→MinIO sync script."
    echo "Current crontab:"
    crontab -l | grep -F "$SYNC_SCRIPT" || true
    exit 0
fi

# Append the new line (preserve existing crontab)
(crontab -l 2>/dev/null || true; echo "$CRON_LINE") | crontab -

echo "Added to crontab (sync every 6 hours):"
echo "  $CRON_LINE"
echo ""
echo "Verify with: crontab -l"
