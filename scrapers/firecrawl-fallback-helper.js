/**
 * Helper function to add Firecrawl fallback to any scraper
 *
 * Usage:
 * const result = await withFirecrawlFallback(
 *   url,
 *   () => yourMainScraper(url),
 *   firecrawlParser,
 *   { detectCategory }
 * );
 */

async function withFirecrawlFallback(url, mainScraperFn, firecrawlParser, options = {}) {
  const { detectCategory } = options;

  try {
    // Try main scraper first
    console.log('🔍 Attempting main scraper...');
    const result = await mainScraperFn();

    if (result && (result.success !== false)) {
      console.log('✅ Main scraper succeeded');
      return result;
    }

    throw new Error('Main scraper returned unsuccessful result');
  } catch (mainError) {
    console.log('⚠️ Main scraper failed:', mainError.message);

    // Try Firecrawl if available
    if (!firecrawlParser?.apiKey) {
      console.log('⚠️ Firecrawl not available, returning error');
      throw mainError; // Re-throw original error
    }

    console.log('🔥 Trying Firecrawl fallback...');

    try {
      const firecrawlResult = await firecrawlParser.scrape(url);

      if (firecrawlResult.success) {
        console.log('✅ Firecrawl fallback succeeded');

        // Add category if function provided
        if (detectCategory && firecrawlResult.product) {
          firecrawlResult.product.category = detectCategory(
            firecrawlResult.product.product_name || '',
            firecrawlResult.product.description || '',
            firecrawlResult.product.brand || '',
            null
          );
        }

        return {
          success: true,
          product: firecrawlResult.product
        };
      }

      throw new Error(firecrawlResult.error || 'Firecrawl failed');
    } catch (firecrawlError) {
      console.log('❌ Firecrawl fallback also failed:', firecrawlError.message);

      // Re-throw original main scraper error
      throw mainError;
    }
  }
}

module.exports = { withFirecrawlFallback };
