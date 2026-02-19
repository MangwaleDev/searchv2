import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * ImageService - Constructs full URLs for images stored in S3/MinIO or local storage
 * 
 * This service mirrors the PHP backend's `get_full_url()` helper logic.
 * Images in the database are stored as filenames only (e.g., "2025-01-05-677a14ece41f6.png")
 * and this service constructs the full URL based on storage configuration.
 * 
 * FALLBACK STRATEGY:
 * - Primary: MinIO (fast, local)
 * - Fallback: S3 (always available)
 * - Response includes BOTH URLs so frontend can fallback if MinIO is down
 * 
 * Storage Types:
 * - "s3": AWS S3 storage
 * - "minio": MinIO self-hosted storage (S3-compatible)
 * - "public" or null: Local storage at /storage/app/public/{path}/{filename}
 * 
 * Configuration (via .env):
 * - STORAGE_TYPE=s3|minio|public (default: s3)
 * - S3_URL=https://mangwale.s3.ap-south-1.amazonaws.com
 * - MINIO_URL=http://localhost:9000 (or your MinIO endpoint)
 * - MINIO_BUCKET=mangwale
 */
@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);
  
  // Storage configuration
  private readonly storageType: 's3' | 'minio' | 'public';
  private readonly s3Url: string;
  private readonly minioUrl: string;
  private readonly bucket: string;
  private readonly enableFallback: boolean;
  
  // Path prefixes for different entity types (matching PHP backend)
  private readonly pathPrefixes: Record<string, string>;
  
  // Default placeholder images (optional)
  private readonly placeholders: Record<string, string> = {
    product: '/assets/admin/img/160x160/img2.jpg',
    store: '/assets/admin/img/160x160/img1.jpg',
    category: '/assets/admin/img/100x100/2.jpg',
    default: '/assets/admin/img/160x160/img2.jpg',
  };
  
  // Working image date ranges (images available in storage)
  // MinIO: kept wide so S3→MinIO synced images (including 2026+) are used
  // S3: Not accessible (403 errors)
  private readonly workingDateRanges = {
    minio: { start: '2025-01', end: '2027-12' },
    s3: { start: '2099-01', end: '2099-01' }, // S3 not accessible
  };

  constructor(private readonly config: ConfigService) {
    // Determine storage type (default to s3 for backward compatibility)
    this.storageType = (this.config.get<string>('STORAGE_TYPE') || 's3') as 's3' | 'minio' | 'public';
    
    // S3 configuration (always available as fallback)
    this.s3Url = this.config.get<string>('S3_URL') || 'https://mangwale.s3.ap-south-1.amazonaws.com';
    
    // MinIO configuration (for self-hosted S3-compatible storage)
    // Use MINIO_PUBLIC_URL for external access, fallback to MINIO_URL for internal
    this.minioUrl = this.config.get<string>('MINIO_PUBLIC_URL') || this.config.get<string>('MINIO_URL') || 'http://localhost:9000';
    
    // Bucket name (same for both S3 and MinIO)
    this.bucket = this.config.get<string>('MINIO_BUCKET') || this.config.get<string>('S3_BUCKET') || 'mangwale';
    
    // Enable fallback URLs (default: true when using MinIO)
    this.enableFallback = this.config.get<string>('IMAGE_FALLBACK_ENABLED') !== 'false';
    
    // Path prefixes matching PHP backend structure
    this.pathPrefixes = {
      product: this.config.get<string>('IMAGE_PATH_PRODUCT') || 'product',
      item: this.config.get<string>('IMAGE_PATH_PRODUCT') || 'product',  // alias
      store: this.config.get<string>('IMAGE_PATH_STORE') || 'store',
      store_logo: this.config.get<string>('IMAGE_PATH_STORE') || 'store',
      store_cover: this.config.get<string>('IMAGE_PATH_STORE_COVER') || 'store/cover',
      cover_photo: this.config.get<string>('IMAGE_PATH_STORE_COVER') || 'store/cover',
      category: this.config.get<string>('IMAGE_PATH_CATEGORY') || 'category',
      delivery_man: this.config.get<string>('IMAGE_PATH_DELIVERY_MAN') || 'delivery-man',
    };
    
    const activeUrl = this.storageType === 'minio' ? this.minioUrl : this.s3Url;
    this.logger.log(`ImageService initialized: storage=${this.storageType}, primary=${activeUrl}, fallback=${this.enableFallback ? this.s3Url : 'disabled'}`);
  }
  
  /**
   * Get the base URL for images based on storage type
   */
  private getBaseUrl(forceS3: boolean = false): string {
    if (forceS3) {
      return this.s3Url;
    }
    
    switch (this.storageType) {
      case 'minio':
        return `${this.minioUrl}/${this.bucket}`;
      case 's3':
        return this.s3Url;
      case 'public':
        return '/storage/app/public';
      default:
        return this.s3Url;
    }
  }

  /**
   * Get full URL for an image
   */
  getFullUrl(
    filename: string | null | undefined, 
    entityType: string = 'product',
    forceS3: boolean = false
  ): string | null {
    if (!filename) {
      return null;
    }
    
    const pathPrefix = this.pathPrefixes[entityType] || this.pathPrefixes['product'];
    const baseUrl = this.getBaseUrl(forceS3);
    
    return `${baseUrl}/${pathPrefix}/${filename}`;
  }
  
  /**
   * Check if an image filename is likely available in storage
   * Based on known working date ranges
   */
  isImageLikelyAvailable(filename: string | null | undefined, storage: 'minio' | 's3' = 'minio'): boolean {
    if (!filename) return false;
    
    // Extract date prefix (e.g., "2025-06" from "2025-06-23-68593a1cda324.png")
    const dateMatch = filename.match(/^(\d{4}-\d{2})/);
    if (!dateMatch) return false;
    
    const datePrefix = dateMatch[1];
    const range = this.workingDateRanges[storage];
    const isAvailable = datePrefix >= range.start && datePrefix <= range.end;
    
    // DEBUG logging removed for performance
    return isAvailable;
  }
  
  /**
   * Get the best available image URL with smart fallback
   * Returns { primary, fallback, status } indicating availability
   * Respects STORAGE_TYPE setting while checking actual availability
   */
  getSmartImageUrl(
    filename: string | null | undefined,
    entityType: string = 'product'
  ): { primary: string | null; fallback: string | null; status: 'available' | 'fallback' | 'missing' } {
    if (!filename) {
      return { primary: null, fallback: null, status: 'missing' };
    }
    
    const minioAvailable = this.isImageLikelyAvailable(filename, 'minio');
    const s3Available = this.isImageLikelyAvailable(filename, 's3');
    
    const pathPrefix = this.pathPrefixes[entityType] || this.pathPrefixes['product'];
    const minioUrl = `${this.minioUrl}/${this.bucket}/${pathPrefix}/${filename}`;
    const s3Url = `${this.s3Url}/${pathPrefix}/${filename}`;
    
    // Respect STORAGE_TYPE setting - prefer configured storage first
    if (this.storageType === 's3') {
      // S3 mode: prefer S3, fallback to MinIO
      if (s3Available) {
        return { 
          primary: s3Url, 
          fallback: minioAvailable ? minioUrl : null, 
          status: 'available' 
        };
      } else if (minioAvailable) {
        return { 
          primary: minioUrl, 
          fallback: s3Url, 
          status: 'fallback' 
        };
      }
    } else {
      // MinIO mode: prefer MinIO, fallback to S3
      if (minioAvailable) {
        return { 
          primary: minioUrl, 
          fallback: s3Available ? s3Url : null, 
          status: 'available' 
        };
      } else if (s3Available) {
        return { 
          primary: s3Url, 
          fallback: null, 
          status: 'fallback' 
        };
      }
    }
    
    // Neither storage has the image - return based on configured type
    return { 
      primary: this.storageType === 's3' ? s3Url : minioUrl, 
      fallback: this.storageType === 's3' ? minioUrl : s3Url, 
      status: 'missing' 
    };
  }

  /**
   * Get S3 fallback URL (always uses S3)
   */
  getS3FallbackUrl(filename: string | null | undefined, entityType: string = 'product'): string | null {
    if (!filename) return null;
    const pathPrefix = this.pathPrefixes[entityType] || this.pathPrefixes['product'];
    return `${this.s3Url}/${pathPrefix}/${filename}`;
  }

  /**
   * Transform an item object to include full image URLs
   * Uses smart URL generation with fallback based on image availability
   */
  transformItemImages(item: Record<string, any>): Record<string, any> {
    if (!item) return item;
    
    // Remove _source and _score fields by creating a new object
    const transformed: Record<string, any> = {};
    for (const key in item) {
      if (key !== '_source' && key !== '_score' && Object.prototype.hasOwnProperty.call(item, key)) {
        transformed[key] = item[key];
      }
    }
    // Also copy from Object.keys to ensure all enumerable properties
    Object.keys(item).forEach(key => {
      if (key !== '_source' && key !== '_score' && !(key in transformed)) {
        transformed[key] = item[key];
      }
    });

    // Normalise veg flag for API consumers:
    // - Always expose as 0/1 instead of boolean true/false
    if (typeof transformed.veg !== 'undefined') {
      const rawVeg = transformed.veg;
      const isVeg =
        rawVeg === true ||
        rawVeg === 1 ||
        rawVeg === '1' ||
        rawVeg === 'veg' ||
        rawVeg === 'true';

      transformed.veg = isVeg ? 1 : 0;
    }
    
    // Main image - use smart URL generation with cache-bust so updated images show
    if (item.image) {
      const smartUrl = this.getSmartImageUrl(item.image, 'product');
      const cacheBust = this.getCacheBustValue(item.updated_at, item.id);
      transformed.image_full_url = smartUrl.primary ? this.appendCacheBust(smartUrl.primary, cacheBust) : smartUrl.primary;
      transformed.image_fallback_url = smartUrl.fallback ? this.appendCacheBust(smartUrl.fallback, cacheBust) : smartUrl.fallback;
      transformed.image_status = smartUrl.status;
    }

    // Additional images array (with cache-bust so updated images show)
    if (item.images && Array.isArray(item.images)) {
      const cacheBust = this.getCacheBustValue(item.updated_at, item.id);
      transformed.images_full_url = item.images.map((img: any) => {
        let primary: string | null = null;
        if (typeof img === 'string') {
          primary = this.getSmartImageUrl(img, 'product').primary;
        } else if (img && typeof img === 'object') {
          primary = this.getSmartImageUrl(img.img, 'product').primary;
        }
        return primary ? this.appendCacheBust(primary, cacheBust) : null;
      }).filter(Boolean);
    }

    return transformed;
  }

  /** Cache-bust value from updated_at (or id) so browsers/CDN fetch updated images */
  private getCacheBustValue(updatedAt: unknown, id: unknown): string {
    if (updatedAt) {
      let t = NaN;
      if (typeof updatedAt === 'string') t = new Date(updatedAt).getTime();
      else if (updatedAt instanceof Date) t = updatedAt.getTime();
      else t = Number(updatedAt);
      if (!isNaN(t)) return String(Math.floor(t / 1000));
    }
    return id != null ? String(id) : '';
  }

  private appendCacheBust(url: string, cacheBust: string): string {
    if (!cacheBust) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${cacheBust}`;
  }

  /**
   * Transform a store object to include full image URLs
   * Uses smart URL generation with fallback based on image availability
   */
  transformStoreImages(store: Record<string, any>): Record<string, any> {
    if (!store) return store;

    const transformed = { ...store };
    const cacheBust = this.getCacheBustValue(store.updated_at, store.id);

    // Logo - use smart URL generation with cache-bust
    if (store.logo) {
      const smartUrl = this.getSmartImageUrl(store.logo, 'store_logo');
      transformed.logo_full_url = smartUrl.primary ? this.appendCacheBust(smartUrl.primary, cacheBust) : smartUrl.primary;
      transformed.logo_fallback_url = smartUrl.fallback ? this.appendCacheBust(smartUrl.fallback, cacheBust) : smartUrl.fallback;
      transformed.logo_status = smartUrl.status;
    }

    // Cover photo - use smart URL generation with cache-bust
    if (store.cover_photo) {
      const smartUrl = this.getSmartImageUrl(store.cover_photo, 'cover_photo');
      transformed.cover_photo_full_url = smartUrl.primary ? this.appendCacheBust(smartUrl.primary, cacheBust) : smartUrl.primary;
      transformed.cover_photo_fallback_url = smartUrl.fallback ? this.appendCacheBust(smartUrl.fallback, cacheBust) : smartUrl.fallback;
      transformed.cover_photo_status = smartUrl.status;
    }

    // Sometimes stores also have an image field
    if (store.image) {
      const smartUrl = this.getSmartImageUrl(store.image, 'store');
      transformed.image_full_url = smartUrl.primary ? this.appendCacheBust(smartUrl.primary, cacheBust) : smartUrl.primary;
    }

    return transformed;
  }

  /**
   * Transform a category object to include full image URLs
   * Uses smart URL generation with fallback based on image availability
   */
  transformCategoryImages(category: Record<string, any>): Record<string, any> {
    if (!category) return category;

    const transformed = { ...category };
    const cacheBust = this.getCacheBustValue(category.updated_at, category.id);

    if (category.image) {
      const smartUrl = this.getSmartImageUrl(category.image, 'category');
      transformed.image_full_url = smartUrl.primary ? this.appendCacheBust(smartUrl.primary, cacheBust) : smartUrl.primary;
      transformed.image_fallback_url = smartUrl.fallback ? this.appendCacheBust(smartUrl.fallback, cacheBust) : smartUrl.fallback;
      transformed.image_status = smartUrl.status;
    }

    return transformed;
  }

  /**
   * Transform search results (items) with full image URLs
   */
  transformItemsWithImages(items: Record<string, any>[]): Record<string, any>[] {
    if (!items || !Array.isArray(items)) return items;
    return items.map(item => this.transformItemImages(item));
  }

  /**
   * Transform search results (stores) with full image URLs
   */
  transformStoresWithImages(stores: Record<string, any>[]): Record<string, any>[] {
    if (!stores || !Array.isArray(stores)) return stores;
    return stores.map(store => this.transformStoreImages(store));
  }

  /**
   * Transform search results (categories) with full image URLs
   */
  transformCategoriesWithImages(categories: Record<string, any>[]): Record<string, any>[] {
    if (!categories || !Array.isArray(categories)) return categories;
    return categories.map(category => this.transformCategoryImages(category));
  }
}
