# 🎯 Search Management - Quick Reference

## 📍 Navigation Menu Location
**Admin Dashboard → Search Management**

## �� 7 Pages Available

### 1. Search Config
**URL**: `/admin/search-config`
**Purpose**: Configure modules and reindex
**Actions**: Reindex modules, view cluster health

### 2. Testing ✨ NEW
**URL**: `/admin/search-testing`
**Purpose**: Complete testing interface
**Features**:
- 3 tabs (Manual, Quick Tests, API Console)
- 9 automated test scenarios
- Real-time API monitoring
- Export curl/Postman

### 3. Analytics
**URL**: `/admin/search-analytics`
**Purpose**: Search performance metrics
**Metrics**: Total searches, response time, top queries

### 4. Trending
**URL**: `/admin/trending`
**Purpose**: Trending queries and products
**Shows**: Popular searches, location trends, product trends

### 5. Index Management ✨ NEW
**URL**: `/admin/search-indices`
**Purpose**: Manage OpenSearch indices
**Actions**: View health, reindex, delete, backup

### 6. Data Sync ✨ NEW
**URL**: `/admin/search-data-sync`
**Purpose**: Monitor MySQL→OpenSearch sync
**Actions**: Manual sync, auto-sync toggle, view progress

### 7. Query Logs ✨ NEW
**URL**: `/admin/search-logs`
**Purpose**: Search query history
**Actions**: View logs, filter by status, export

## 🚀 Quick Start

### To Test Search Features:
1. Go to `/admin/search-testing`
2. Click "Quick Tests" tab
3. Click any test scenario
4. View results instantly

### To Monitor API Calls:
1. Go to `/admin/search-testing`
2. Click "API Console" tab
3. Perform any search
4. See API call details

### To Check Index Health:
1. Go to `/admin/search-indices`
2. View health indicators (green/yellow/red)
3. Check document counts
4. Reindex if needed

### To Monitor Data Sync:
1. Go to `/admin/search-data-sync`
2. View sync status per module
3. Check items synced/pending
4. Trigger manual sync if needed

### To View Search History:
1. Go to `/admin/search-logs`
2. Filter by status (all/success/error)
3. Click eye icon for details
4. Export logs if needed

## 📊 Key Stats Visible

- **Testing Page**: API calls, response times, test results
- **Index Management**: Health status, doc counts, storage size
- **Data Sync**: Items synced, pending, progress %
- **Query Logs**: Query count, success rate, performance

## 🎯 Common Tasks

| Task | Page | Action |
|------|------|--------|
| Test search feature | Testing | Run automated test |
| Check API call | Testing | View API Console |
| Monitor index health | Index Management | View health table |
| Reindex module | Index Management | Click reindex button |
| Sync data | Data Sync | Click sync now |
| View query history | Query Logs | Browse table |
| Export API call | Testing | Copy curl command |

## 🔗 Production URLs

```
https://test.mangwale.ai/admin/search-testing
https://test.mangwale.ai/admin/search-indices
https://test.mangwale.ai/admin/search-data-sync
https://test.mangwale.ai/admin/search-logs
```

## ✅ Status
- All pages: **PRODUCTION READY**
- Status: **FULLY FUNCTIONAL** (with mock data)
- Backend API integration: **PENDING** (pages ready)

---
*Last Updated: January 2, 2026*
