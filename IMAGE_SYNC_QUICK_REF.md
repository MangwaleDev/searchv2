# Image Sync - Quick Reference

## 📸 Image URL Patterns

### Items
```
Primary:  https://storage.mangwale.ai/mangwale/product/{filename}
Fallback: https://mangwale.s3.ap-south-1.amazonaws.com/product/{filename}
CDN:      https://cdn.mangwale.ai/product/{filename}
```

### Stores
```
Logo:     https://storage.mangwale.ai/mangwale/store/{filename}
Cover:    https://storage.mangwale.ai/mangwale/store/{filename}
Fallback: https://mangwale.s3.ap-south-1.amazonaws.com/store/{filename}
```

## 🚀 Quick Commands

### One-Click Full Sync
```bash
./scripts/complete-image-sync.sh
```

### Check Inventory
```bash
python3 scripts/image-sync-utility.py --check
```

### Validate Images
```bash
python3 scripts/image-sync-utility.py --validate --sample-size=10
```

### Sync to OpenSearch
```bash
python3 scripts/image-sync-utility.py --sync
```

## 📊 Statistics

- **Total Images**: 13,967
- **Items**: 10,593 with images
- **Stores**: 159 with logos/covers
- **Categories**: 151 with images

## 🔧 In Docker

```bash
# Copy utility
docker cp scripts/image-sync-utility.py search-embedding-service:/tmp/

# Run check
docker exec search-embedding-service python3 /tmp/image-sync-utility.py --check

# Run sync
docker exec search-embedding-service python3 /tmp/sync.py
```

## 📝 API Response Fields

```json
{
  "image_full_url": "Primary Minio URL",
  "image_fallback_url": "S3 fallback URL",
  "image_cdn_url": "CDN URL",
  "additional_images": [],
  "total_images": 1,
  "store_logo_url": "Store logo URL",
  "store_cover_url": "Store cover URL"
}
```

## 🎯 Frontend Usage

```javascript
// Use CDN first, fallback to Minio, then S3
<img 
  src={item.image_cdn_url || item.image_full_url} 
  onError={(e) => e.target.src = item.image_fallback_url}
/>
```

## 📚 Documentation

- **Full Guide**: `IMAGE_SYNC_COMPLETE_GUIDE.md`
- **Summary**: `IMAGE_SYNC_SUMMARY.md`
- **This File**: `IMAGE_SYNC_QUICK_REF.md`

## ✅ Status

All image paths from MySQL are properly synced to OpenSearch with Minio (primary) and S3 (fallback) URLs.
