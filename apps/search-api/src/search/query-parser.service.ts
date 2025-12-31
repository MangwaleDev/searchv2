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
  // Known brand names that should trigger store-first intent
  private readonly knownBrands = [
    // Fast Food Chains (International)
    'dominos', 'domino', 'mcdonalds', 'mcdonald', 'mcd', 'kfc',
    'pizzahut', 'pizza hut', 'burgerking', 'burger king', 'bk',
    'tacobell', 'taco bell', 'subway', 'wendys', 'wendy',
    'arbys', 'arby', 'popeyes', 'popeye', 'sonic',
    
    // Coffee Chains
    'starbucks', 'coffeeday', 'ccd', 'barista', 'costa',
    'timhortons', 'dunkin', 'dunkindonuts',
    
    // Indian Brands & Chains
    'haldirams', 'haldiram', 'bikanervala', 'bikanerv ala',
    'nathu', 'nathus', 'gianis', 'karachis', 'monginis',
    'paradise', 'bawarchi', 'kareem', 'pista house',
    
    // Ice Cream
    'baskin', 'baskinrobbins', 'haagen', 'haagenday', 'hagen daz',
    'naturals', 'kwality', 'amul', 'vadilal',
    
    // South Indian
    'saravana', 'saravana bhavan', 'adyar', 'murugan',
    'sagar', 'udupi', 'mtr', 'vidyarthi', 'shanti', 'darshini',
    
    // North Indian
    'pind balluchi', 'punjabi', 'barbeque nation', 'bbq nation',
    'mainland china', 'golden dragon', 'bercos',
    
    // Others
    'wow', 'wow momos', 'faaso', 'faasos', 'behrouz',
    'oven story', 'box8', 'freshmenu', 'biryani blues'
  ];
  
  // Store-type keywords
  private readonly storeKeywords = [
    'restaurant', 'restro', 'cafe', 'hotel', 'menu',
    'bakery', 'sweet', 'sweets', 'mart', 'shop', 'store',
    'kitchen', 'foods', 'bar', 'lounge', 'dhaba', 'corner',
    // NEW keywords
    'parlor', 'parlour', 'house', 'court', 'junction', 'plaza',
    'center', 'centre', 'point', 'hub', 'spot', 'place',
    'shack', 'joint', 'eatery', 'diner', 'bistro', 'grill',
    'takeaway', 'takeout', 'outlet', 'branch', 'chain',
    'palace', 'inn', 'tavern', 'canteen', 'mess'
  ];

  parse(raw: string): ParsedSearchIntent {
    const normalized = (raw || '').trim();
    if (!normalized) {
      return { intent: 'generic', raw: normalized };
    }

    const lowered = normalized.toLowerCase();
    const normalizedLower = lowered.replace(/[^a-z0-9\s]/g, '');

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

    // Check for known brands (exact or partial match)
    const hasKnownBrand = this.knownBrands.some((brand) => 
      normalizedLower.includes(brand.replace(/\s+/g, ''))
    );
    
    // Check for store keywords (exact and partial matches for incomplete typing)
    const hasStoreKeyword = this.storeKeywords.some((kw) => lowered.includes(kw));
    
    // NEW: Check for partial matches of store keywords (minimum 3 chars typed)
    // Example: "sww" or "swe" should match "sweets", "mar" should match "mart"
    const hasPartialStoreKeyword = this.storeKeywords.some((kw) => {
      if (kw.length >= 4) {
        // For keywords 4+ chars, check if query contains first 3+ chars
        const prefix = kw.substring(0, 3);
        return lowered.includes(prefix) && lowered.length >= 3;
      }
      return false;
    });
    
    // Detect brand-like patterns
    const hasTitleCase = /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(normalized);
    const hasMultipleCaps = (normalized.match(/[A-Z]/g) || []).length >= 2;
    
    // Check for all-caps short brands (KFC, MCD, CCD, BBQ)
    const hasAllCapsShort = /\b[A-Z]{2,4}\b/.test(normalized);
    
    // Check if last word is a known brand (handles "pizza dominos")
    const words = normalizedLower.split(/\s+/);
    const lastWord = words[words.length - 1];
    const firstWord = words[0];
    const hasBrandAtEnd = this.knownBrands.some(brand => 
      lastWord === brand.replace(/\s+/g, '') || firstWord === brand.replace(/\s+/g, '')
    );
    
    // NEW: Check if query contains multiple words with one being a store-like word
    // Example: "ganesh sww" = two words, second starts with "sw" (likely "sweets")
    const tokenCount = normalized.split(/\s+/).length;
    const hasMultiWordWithStoreHint = tokenCount >= 2 && (
      hasPartialStoreKeyword || 
      // Check if any word starts with common store prefixes
      words.some(word => word.length >= 3 && (
        word.startsWith('swe') || word.startsWith('swa') || // sweets/sweet
        word.startsWith('sw') && word.length <= 4 || // "sww" or "swe" (typos/incomplete)
        word.startsWith('mar') || // mart
        word.startsWith('rest') || word.startsWith('caf') || // restaurant/cafe
        word.startsWith('bak') || word.startsWith('kit') // bakery/kitchen
      ))
    );
    
    // NEW: Detect if first word is a proper name (Title Case) and second word is incomplete store type
    // Example: "Ganesh sww" - first word capitalized, second word looks like incomplete "sweet/sweets"
    const hasProperNamePattern = tokenCount >= 2 && /^[A-Z][a-z]+/.test(normalized) && (
      hasPartialStoreKeyword || hasMultiWordWithStoreHint
    );
    
    // Store-first if:
    // 1. Has known brand name
    // 2. Has store keyword (exact or partial)
    // 3. Short query (1-3 words) with Title Case or multiple capitals
    // 4. Has all-caps short pattern (KFC, MCD)
    // 5. Brand name at beginning or end of query
    // 6. Multi-word query with store-like hint
    // 7. Proper name pattern (Name + incomplete store word)
    if (
      hasKnownBrand || 
      hasStoreKeyword || 
      hasPartialStoreKeyword ||
      hasBrandAtEnd ||
      hasAllCapsShort ||
      hasMultiWordWithStoreHint ||
      hasProperNamePattern ||
      (tokenCount <= 3 && (hasTitleCase || hasMultipleCaps))
    ) {
      return {
        intent: 'store_first',
        raw: normalized,
        storeQuery: normalized,
      };
    }

    return { intent: 'generic', raw: normalized };
  }
}
