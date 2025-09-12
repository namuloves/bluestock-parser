const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

const scrapeWithApifyPuppeteer = async (url, siteName) => {
    console.log(`🚀 Using Apify Puppeteer Scraper for ${siteName}: ${url}`);
    
    try {
        // This uses Puppeteer Scraper which has better control
        const input = {
            startUrls: [{ url }],
            globs: [{ glob: url }],
            pseudoUrls: [],
            linkSelector: '',
            pageFunction: `
                async function pageFunction(context) {
                    const { page, request, log } = context;
                    
                    log.info('Waiting for page to load...');
                    
                    // Wait longer for content
                    await page.waitForTimeout(5000);
                    
                    // Try to wait for product content
                    try {
                        await page.waitForSelector('h1', { timeout: 10000 });
                    } catch (e) {
                        log.warning('No h1 found, continuing...');
                    }
                    
                    // Extract all text content to see what we're getting
                    const pageTitle = await page.title();
                    const pageUrl = page.url();
                    
                    log.info('Page title: ' + pageTitle);
                    log.info('Page URL: ' + pageUrl);
                    
                    // Extract product data
                    const data = await page.evaluate(() => {
                        // Try multiple selectors for each field
                        const getText = (selectors) => {
                            for (const selector of selectors) {
                                const el = document.querySelector(selector);
                                if (el && el.textContent) {
                                    return el.textContent.trim();
                                }
                            }
                            return '';
                        };
                        
                        const getImages = () => {
                            const images = [];
                            // Try different image selectors
                            const imgSelectors = [
                                'img[data-testid*="product"]',
                                '.product-image img',
                                '.product-gallery img',
                                '[class*="gallery"] img',
                                '[class*="image"] img',
                                'picture img',
                                'img'
                            ];
                            
                            for (const selector of imgSelectors) {
                                document.querySelectorAll(selector).forEach(img => {
                                    const src = img.src || img.dataset.src || img.dataset.lazySrc;
                                    if (src && !src.includes('data:image') && !images.includes(src)) {
                                        images.push(src);
                                    }
                                });
                                if (images.length > 0) break;
                            }
                            return images.slice(0, 10); // Limit to 10 images
                        };
                        
                        // Extract structured data if available
                        let jsonLdData = {};
                        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                        for (const script of scripts) {
                            try {
                                const data = JSON.parse(script.textContent);
                                if (data['@type'] === 'Product' || data.product) {
                                    jsonLdData = data.product || data;
                                    break;
                                }
                            } catch (e) {}
                        }
                        
                        return {
                            // Try to get from structured data first
                            name: jsonLdData.name || getText(['h1', '[data-testid*="product-name"]', '.product-name', '[class*="product-title"]']),
                            brand: jsonLdData.brand?.name || getText(['[data-testid*="brand"]', '.brand', '[class*="designer"]', '[class*="brand"]']),
                            price: jsonLdData.offers?.price || getText(['[data-testid*="price"]', '.price', '[class*="price-current"]', '[class*="price"]']),
                            description: jsonLdData.description || getText(['.product-description', '[data-testid*="description"]', '[class*="description"]']),
                            images: getImages(),
                            pageTitle: document.title,
                            pageUrl: window.location.href,
                            hasJsonLd: Object.keys(jsonLdData).length > 0
                        };
                    });
                    
                    // Take screenshot for debugging
                    const screenshot = await page.screenshot({ fullPage: false });
                    
                    return {
                        url: request.url,
                        ...data,
                        screenshot: screenshot.toString('base64').substring(0, 100) + '...' // Just for verification
                    };
                }
            `,
            proxyConfiguration: {
                useApifyProxy: true,
                apifyProxyGroups: ['RESIDENTIAL']
            },
            maxRequestRetries: 2,
            maxPagesPerCrawl: 1,
            maxConcurrency: 1,
            pageLoadTimeoutSecs: 60,
            maxRequestsPerMinute: 30,
            preNavigationHooks: `[
                async ({ page, request }, gotoOptions) => {
                    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    gotoOptions.waitUntil = ['domcontentloaded', 'networkidle2'];
                }
            ]`,
            postNavigationHooks: `[
                async ({ page }) => {
                    // Scroll to trigger lazy loading
                    await page.evaluate(() => {
                        window.scrollTo(0, document.body.scrollHeight / 2);
                    });
                }
            ]`
        };

        // Use Puppeteer Scraper instead of Web Scraper
        const run = await client.actor("apify/puppeteer-scraper").call(input);
        
        // Fetch results
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        if (!items || items.length === 0) {
            throw new Error('No data scraped from Apify Puppeteer');
        }
        
        const result = items[0];
        console.log('📊 Apify Puppeteer result:', {
            name: result.name,
            brand: result.brand,
            price: result.price,
            images: result.images?.length || 0,
            hasJsonLd: result.hasJsonLd
        });
        
        // Format the result properly
        return {
            name: result.name || '',
            brand: result.brand || '',
            price: result.price || 0,
            originalPrice: 0,
            images: result.images || [],
            description: result.description || '',
            url: url,
            sizes: [],
            colors: [],
            inStock: true
        };
        
    } catch (error) {
        console.error('❌ Apify Puppeteer error:', error.message);
        throw error;
    }
};

module.exports = { scrapeWithApifyPuppeteer };