import { Injectable } from '@nestjs/common';

export type SearchIntentType = 'specific_item_specific_store' | 'store_first' | 'generic';

export interface ParsedSearchIntent {
  intent: SearchIntentType;
  raw: string;
  itemQuery?: string;
  storeQuery?: string;
}

@Injectable()
export class QueryParserService {
  parse(raw: string): ParsedSearchIntent {
    const normalized = (raw || '').trim();
    if (!normalized) {
      return { intent: 'generic', raw: normalized };
    }

    const lowered = normalized.toLowerCase();

    // Patterns for "item from store" style queries
    const patterns = [
      /(.+?)\s+from\s+(.+)/i,
      /(.+?)\s+at\s+(.+)/i,
      /(.+?)\s+in\s+(.+)/i,
      /(.+?)\s+from\s+(.+?)\s+restaurant/i,
      /(.+?)\s+from\s+(.+?)\s+cafe/i,
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match && match[1] && match[2]) {
        const itemQuery = match[1].trim();
        const storeQuery = match[2].trim();
        if (itemQuery && storeQuery) {
          return {
            intent: 'specific_item_specific_store',
            raw: normalized,
            itemQuery,
            storeQuery,
          };
        }
      }
    }

    // Store-first hints: queries ending with menu/restaurant/cafe or very short brand-like tokens
    const storeKeywords = [
      'restaurant', 'restro', 'cafe', 'hotel', 'menu', 'bakery', 'sweet', 'sweets',
      'mart', 'shop', 'store', 'kitchen', 'foods', 'bar', 'lounge', 'dhaba', 'corner'
    ];
    const hasStoreKeyword = storeKeywords.some((kw) => lowered.includes(kw));
    
    // Detect brand-like patterns (Title Case, multiple capitals)
    const hasTitleCase = /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(normalized);
    const hasMultipleCaps = (normalized.match(/[A-Z]/g) || []).length >= 2;
    
    const tokenCount = normalized.split(/\s+/).length;
    
    // Store-first if:
    // 1. Has store keyword
    // 2. Short query (1-3 words) that looks like a brand name
    // 3. Title case pattern (likely a proper noun/brand)
    if (hasStoreKeyword || (tokenCount <= 3 && (hasTitleCase || hasMultipleCaps))) {
      return {
        intent: 'store_first',
        raw: normalized,
        storeQuery: normalized,
      };
    }

    return { intent: 'generic', raw: normalized };
  }
}
