const { ApifyClient } = require('apify-client');

// Initialize the ApifyClient with your API token
// You'll need to add APIFY_API_TOKEN to your .env file
const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

const scrapeWithApify = async (url, siteName) => {
    console.log(`🚀 Using Apify Web Scraper for ${siteName}: ${url}`);
    
    try {
        // Prepare the Actor input based on the site
        const input = {
            startUrls: [{ url }],
            pageFunction: getPageFunctionForSite(siteName),
            proxyConfiguration: {
                useApifyProxy: true,
                apifyProxyGroups: ['RESIDENTIAL'] // Use residential proxies for better success
            },
            maxPagesPerCrawl: 1,
            maxRequestRetries: 3,
            maxConcurrency: 1,
            pageLoadTimeoutSecs: 60,
            dynamicContentWaitSecs: 10, // Wait for dynamic content
            debugLog: true
        };

        // Run the Actor and wait for it to finish
        const run = await client.actor("apify/web-scraper").call(input);
        
        // Fetch Actor results from the default dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        if (!items || items.length === 0) {
            throw new Error('No data scraped from Apify');
        }
        
        const product = items[0];
        console.log('✅ Successfully scraped with Apify:', product.name || 'Product');
        
        return product;
        
    } catch (error) {
        console.error('❌ Apify scraping error:', error.message);
        throw error;
    }
};

// Site-specific page functions for Apify Web Scraper
function getPageFunctionForSite(siteName) {
    const siteFunctions = {
        'netaporter': `
            async function pageFunction(context) {
                const { $, request } = context;
                
                // Wait for product content
                await context.page.waitForSelector('h1', { timeout: 30000 });
                
                // Try to extract from JSON-LD first
                let jsonLdData = {};
                $('script[type="application/ld+json"]').each((i, script) => {
                    try {
                        const data = JSON.parse($(script).html());
                        if (data['@type'] === 'Product') {
                            jsonLdData = data;
                        }
                    } catch (e) {}
                });
                
                return {
                    url: request.url,
                    name: $('h1.ProductDetails24__name, h1[data-testid="product-name"], h1').first().text().trim() || jsonLdData.name || '',
                    brand: $('span.ProductDetails24__designer, [data-testid="product-designer"]').first().text().trim() || jsonLdData.brand?.name || '',
                    price: $('.PriceWithSchema9__value--sale, .PriceWithSchema9__value').first().text().trim() || jsonLdData.offers?.price || '',
                    originalPrice: $('.PriceWithSchema9__value--previous').first().text().trim() || '',
                    description: $('.ProductDetails24__description, .AccordionPanel24__content').first().text().trim() || jsonLdData.description || '',
                    images: $('.ImageCarousel24__image img, .Slideshow__image img').map((i, img) => $(img).attr('src') || $(img).attr('data-src')).get().filter(Boolean),
                    sizes: $('.SizeSelector24__size-button').map((i, el) => $(el).text().trim()).get(),
                    color: $('.ProductDetails24__color').first().text().trim() || '',
                    inStock: true
                };
            }
        `,
        'mytheresa': `
            async function pageFunction(context) {
                const { $, request } = context;
                
                // Wait for product content
                await context.page.waitForSelector('h1', { timeout: 30000 });
                
                // Try to extract from JSON-LD first
                let jsonLdData = {};
                $('script[type="application/ld+json"]').each((i, script) => {
                    try {
                        const data = JSON.parse($(script).html());
                        if (data['@type'] === 'Product') {
                            jsonLdData = data;
                        }
                    } catch (e) {}
                });
                
                return {
                    url: request.url,
                    name: $('h1.product-name, [data-testid="product-title"], h1').first().text().trim() || jsonLdData.name || '',
                    brand: $('.product-designer, [data-testid="product-brand"]').first().text().trim() || jsonLdData.brand?.name || '',
                    price: $('.pricing__price--current, [data-testid="current-price"]').first().text().trim() || jsonLdData.offers?.price || '',
                    originalPrice: $('.pricing__price--original').first().text().trim() || '',
                    description: $('.product-description__content').first().text().trim() || jsonLdData.description || '',
                    images: $('.product-gallery__image img').map((i, img) => $(img).attr('src') || $(img).attr('data-src')).get().filter(Boolean),
                    sizes: $('.size-selector__size-button').map((i, el) => $(el).text().trim()).get(),
                    color: $('.product__color').first().text().trim() || '',
                    inStock: true
                };
            }
        `,
        'ssense': `
            async function pageFunction(context) {
                const { $, request } = context;
                
                await context.page.waitForSelector('h1', { timeout: 30000 });
                
                return {
                    url: request.url,
                    name: $('h1.product-name__title, h1').first().text().trim(),
                    brand: $('.product-name__brand').first().text().trim(),
                    price: $('.price__amount--current').first().text().trim(),
                    originalPrice: $('.price__amount--original').first().text().trim() || '',
                    description: $('.product-description__text').first().text().trim(),
                    images: $('.product-images__image img').map((i, img) => $(img).attr('src')).get().filter(Boolean),
                    sizes: $('.size-selector__option').map((i, el) => $(el).text().trim()).get(),
                    color: $('.product-color').first().text().trim() || '',
                    inStock: true
                };
            }
        `
    };
    
    // Return the function for the specific site, or a generic one
    return siteFunctions[siteName.toLowerCase()] || siteFunctions['netaporter'];
}

module.exports = { scrapeWithApify };