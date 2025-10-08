/**
 * Currency Detection Service
 * Multi-layered approach to detect currency from HTML, URL, and price text
 */

class CurrencyDetector {
  constructor() {
    // Currency patterns for text matching
    this.currencyPatterns = {
      'DKK': /\bkr\.?\b|DKK|danske kroner/i,
      'SEK': /\bSEK\b|svenska kronor/i,
      'NOK': /\bNOK\b|norske kroner/i,
      'EUR': /€|EUR\b|euro/i,
      'GBP': /£|GBP\b|pounds?/i,
      'USD': /\$|USD\b|dollars?/i,
      'CAD': /CAD\b|C\$/i,
      'AUD': /AUD\b|A\$/i,
      'CHF': /CHF|Fr\.|Swiss franc/i,
      'JPY': /¥|JPY\b|yen/i,
      'CNY': /¥|CNY\b|yuan|RMB/i,
      'KRW': /₩|KRW\b|won/i,
      'SGD': /SGD\b|S\$/i,
      'HKD': /HKD\b|HK\$/i
    };

    // TLD to currency mapping
    this.tldCurrencyMap = {
      '.dk': 'DKK',
      '.se': 'SEK',
      '.no': 'NOK',
      '.fi': 'EUR',
      '.de': 'EUR',
      '.fr': 'EUR',
      '.es': 'EUR',
      '.it': 'EUR',
      '.nl': 'EUR',
      '.be': 'EUR',
      '.at': 'EUR',
      '.pt': 'EUR',
      '.ie': 'EUR',
      '.uk': 'GBP',
      '.gb': 'GBP',
      '.ch': 'CHF',
      '.ca': 'CAD',
      '.au': 'AUD',
      '.nz': 'NZD',
      '.jp': 'JPY',
      '.cn': 'CNY',
      '.kr': 'KRW',
      '.sg': 'SGD',
      '.hk': 'HKD',
      '.in': 'INR'
    };

    // Language/region to currency mapping
    this.langCurrencyMap = {
      'da-DK': 'DKK',
      'sv-SE': 'SEK',
      'nb-NO': 'NOK',
      'nn-NO': 'NOK',
      'fi-FI': 'EUR',
      'de-DE': 'EUR',
      'de-AT': 'EUR',
      'de-CH': 'CHF',
      'fr-FR': 'EUR',
      'fr-BE': 'EUR',
      'fr-CH': 'CHF',
      'fr-CA': 'CAD',
      'es-ES': 'EUR',
      'it-IT': 'EUR',
      'nl-NL': 'EUR',
      'nl-BE': 'EUR',
      'en-GB': 'GBP',
      'en-US': 'USD',
      'en-CA': 'CAD',
      'en-AU': 'AUD',
      'en-NZ': 'NZD',
      'en-SG': 'SGD',
      'en-HK': 'HKD',
      'en-IN': 'INR',
      'ja-JP': 'JPY',
      'zh-CN': 'CNY',
      'ko-KR': 'KRW'
    };

    // Site-specific configurations
    this.siteConfigs = {
      'stelstores.com': {
        currency: 'DKK',
        requiresConversion: true,
        pricePattern: /(\d+(?:[.,]\d+)*)\s*kr\.?/i
      },
      'ganni.com': {
        currency: 'DKK',
        requiresConversion: true
      },
      'stine-goya.com': {
        currency: 'DKK',
        requiresConversion: true
      },
      'norseprojects.com': {
        currency: 'EUR',
        requiresConversion: true
      },
      'weekday.com': {
        currency: 'EUR',
        requiresConversion: true
      },
      'arket.com': {
        currency: 'EUR',
        requiresConversion: true
      }
    };
  }

  /**
   * Main detection method - uses multiple strategies
   */
  detect(html, url, priceText) {
    console.log('🔍 Detecting currency for URL:', url);
    console.log('📝 Price text:', priceText);

    // 1. Check site-specific config first
    const siteConfig = this.getSiteConfig(url);
    if (siteConfig?.currency) {
      console.log(`✅ Site config match: ${siteConfig.currency}`);
      return {
        currency: siteConfig.currency,
        confidence: 'high',
        source: 'site_config'
      };
    }

    // 2. Try to extract from structured data (JSON-LD)
    const jsonLdCurrency = this.extractFromJsonLd(html);
    if (jsonLdCurrency) {
      console.log(`✅ JSON-LD match: ${jsonLdCurrency}`);
      return {
        currency: jsonLdCurrency,
        confidence: 'high',
        source: 'json_ld'
      };
    }

    // 3. Check meta tags
    const metaCurrency = this.extractFromMetaTags(html);
    if (metaCurrency) {
      console.log(`✅ Meta tag match: ${metaCurrency}`);
      return {
        currency: metaCurrency,
        confidence: 'high',
        source: 'meta_tags'
      };
    }

    // 4. Check HTML lang attribute
    const langCurrency = this.extractFromLangAttribute(html);
    if (langCurrency) {
      console.log(`✅ Language match: ${langCurrency}`);
      return {
        currency: langCurrency,
        confidence: 'medium',
        source: 'html_lang'
      };
    }

    // 5. Detect from price text patterns
    if (priceText) {
      const textCurrency = this.detectFromPriceText(priceText);
      if (textCurrency) {
        console.log(`✅ Price text match: ${textCurrency}`);
        return {
          currency: textCurrency,
          confidence: 'medium',
          source: 'price_text'
        };
      }
    }

    // 6. Fallback to TLD detection
    const tldCurrency = this.detectFromTld(url);
    if (tldCurrency) {
      console.log(`✅ TLD match: ${tldCurrency}`);
      return {
        currency: tldCurrency,
        confidence: 'low',
        source: 'tld'
      };
    }

    // Default to USD
    console.log('⚠️ No currency detected, defaulting to USD');
    return {
      currency: 'USD',
      confidence: 'none',
      source: 'default'
    };
  }

  /**
   * Get site-specific configuration
   */
  getSiteConfig(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
      return this.siteConfigs[hostname] || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract currency from JSON-LD structured data
   */
  extractFromJsonLd(html) {
    try {
      // Find all JSON-LD scripts
      const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);

      if (jsonLdMatches) {
        for (const match of jsonLdMatches) {
          const jsonContent = match.replace(/<script[^>]*type="application\/ld\+json"[^>]*>|<\/script>/gi, '');
          try {
            const data = JSON.parse(jsonContent);

            // Check for Product schema
            if (data['@type'] === 'Product' && data.offers) {
              const offers = Array.isArray(data.offers) ? data.offers[0] : data.offers;
              if (offers.priceCurrency) {
                return offers.priceCurrency;
              }
            }

            // Check for array of items
            if (Array.isArray(data)) {
              for (const item of data) {
                if (item['@type'] === 'Product' && item.offers) {
                  const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                  if (offers.priceCurrency) {
                    return offers.priceCurrency;
                  }
                }
              }
            }
          } catch (e) {
            // Invalid JSON, continue
          }
        }
      }
    } catch (e) {
      console.error('Error extracting JSON-LD:', e);
    }
    return null;
  }

  /**
   * Extract currency from meta tags
   */
  extractFromMetaTags(html) {
    // OpenGraph currency
    let match = html.match(/<meta[^>]*property="product:price:currency"[^>]*content="([A-Z]{3})"/i);
    if (match) return match[1];

    match = html.match(/<meta[^>]*property="og:price:currency"[^>]*content="([A-Z]{3})"/i);
    if (match) return match[1];

    // Twitter card
    match = html.match(/<meta[^>]*name="twitter:data2"[^>]*content="([A-Z]{3})"/i);
    if (match && match[1].length === 3) return match[1];

    return null;
  }

  /**
   * Extract currency from HTML lang attribute
   */
  extractFromLangAttribute(html) {
    const match = html.match(/<html[^>]*lang="([a-z]{2}(?:-[A-Z]{2})?)"/i);
    if (match && match[1]) {
      return this.langCurrencyMap[match[1]] || null;
    }
    return null;
  }

  /**
   * Detect currency from price text
   */
  detectFromPriceText(priceText) {
    // Special handling for kr (need to distinguish between DKK, SEK, NOK)
    if (/\bkr\.?\b/i.test(priceText)) {
      // Look for more specific patterns
      if (/DKK/i.test(priceText)) return 'DKK';
      if (/SEK/i.test(priceText)) return 'SEK';
      if (/NOK/i.test(priceText)) return 'NOK';
      // Default kr to DKK (most common in fashion context)
      return 'DKK';
    }

    // Check other currency patterns
    for (const [currency, pattern] of Object.entries(this.currencyPatterns)) {
      if (pattern.test(priceText)) {
        return currency;
      }
    }

    return null;
  }

  /**
   * Detect currency from domain TLD
   */
  detectFromTld(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      // Check each TLD pattern
      for (const [tld, currency] of Object.entries(this.tldCurrencyMap)) {
        if (hostname.endsWith(tld)) {
          return currency;
        }
      }
    } catch {
      // Invalid URL
    }

    return null;
  }

  /**
   * Parse price value from text, handling different formats
   */
  parsePrice(priceText, currency) {
    // Remove currency symbols and text
    let cleanPrice = priceText
      .replace(/[A-Z]{3}/g, '') // Remove currency codes
      .replace(/[^\d.,\s-]/g, '') // Keep only numbers, dots, commas, spaces, and minus
      .trim();

    // Handle different decimal separators based on currency
    if (['EUR', 'DKK', 'SEK', 'NOK'].includes(currency)) {
      // European format: 1.234,56
      cleanPrice = cleanPrice.replace(/\./g, ''); // Remove thousand separators
      cleanPrice = cleanPrice.replace(',', '.'); // Convert decimal separator
    } else {
      // US/UK format: 1,234.56
      cleanPrice = cleanPrice.replace(/,/g, ''); // Remove thousand separators
    }

    const value = parseFloat(cleanPrice);
    return isNaN(value) ? 0 : value;
  }
}

// Singleton instance
let detectorInstance = null;

function getCurrencyDetector() {
  if (!detectorInstance) {
    detectorInstance = new CurrencyDetector();
  }
  return detectorInstance;
}

module.exports = {
  CurrencyDetector,
  getCurrencyDetector
};