const { ApifyClient } = require('apify-client');
const axios = require('axios');
const cheerio = require('cheerio');

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

async function scrapeMassimoDuttiWithApify(url) {
    console.log('🤖 Using Apify for Massimo Dutti with enhanced selectors');
    
    try {
        const input = {
            startUrls: [{ url }],
            globs: [{ glob: url }],
            pseudoUrls: [],
            linkSelector: '',
            pageFunction: `
                async function pageFunction(context) {
                    const { page, request, log } = context;
                    
                    log.info('Waiting for page to fully load...');
                    
                    // Wait for the page to settle
                    await page.waitForTimeout(8000);
                    
                    // Try to scroll to trigger lazy loading
                    await page.evaluate(() => {
                        window.scrollTo(0, document.body.scrollHeight / 2);
                    });
                    await page.waitForTimeout(2000);
                    
                    // Extract all data
                    const data = await page.evaluate(() => {
                        // Helper to get text
                        const getText = (selectors) => {
                            if (typeof selectors === 'string') selectors = [selectors];
                            for (const selector of selectors) {
                                const el = document.querySelector(selector);
                                if (el && el.textContent) {
                                    return el.textContent.trim();
                                }
                            }
                            return '';
                        };
                        
                        // Get product name - Massimo Dutti specific selectors
                        const name = getText([
                            'h1[class*="product-name"]',
                            'h1[class*="product-detail"]',
                            '.product-detail-info__product-name',
                            '[data-testid="product-name"]',
                            'h1.product-name',
                            'h1'
                        ]);
                        
                        // Get price
                        const price = getText([
                            '[class*="price-now"]',
                            '[class*="current-price"]',
                            '.product-detail-info__price-now',
                            '[data-testid="product-price"]',
                            '.price',
                            '[class*="price"]'
                        ]);
                        
                        // Get original price
                        const originalPrice = getText([
                            '[class*="price-old"]',
                            '[class*="original-price"]',
                            '.product-detail-info__price-old',
                            '[data-testid="product-original-price"]',
                            '.old-price'
                        ]);
                        
                        // Get images - comprehensive search
                        const images = [];
                        
                        // Try various image container selectors
                        const imageContainers = [
                            '.product-detail-images',
                            '.product-images',
                            '.media-gallery',
                            '.product-media',
                            '[class*="gallery"]',
                            '[class*="carousel"]',
                            '.swiper-wrapper',
                            'main'
                        ];
                        
                        for (const container of imageContainers) {
                            const containerEl = document.querySelector(container);
                            if (containerEl) {
                                // Look for images within the container
                                const imgElements = containerEl.querySelectorAll('img');
                                imgElements.forEach(img => {
                                    let src = img.src || img.dataset.src || img.dataset.lazySrc || img.getAttribute('data-src');
                                    if (src && src.startsWith('http') && !src.includes('placeholder')) {
                                        // Clean and enhance image URL
                                        src = src.replace(/w=\\d+/, 'w=1200').replace(/h=\\d+/, 'h=1600');
                                        if (!images.includes(src)) {
                                            images.push(src);
                                        }
                                    }
                                });
                                
                                // Also check for picture elements
                                const pictureElements = containerEl.querySelectorAll('picture source');
                                pictureElements.forEach(source => {
                                    const srcset = source.getAttribute('srcset');
                                    if (srcset && srcset.startsWith('http')) {
                                        const src = srcset.split(' ')[0]; // Get first URL from srcset
                                        if (!images.includes(src)) {
                                            images.push(src);
                                        }
                                    }
                                });
                            }
                            
                            if (images.length > 0) break;
                        }
                        
                        // If still no images, try a broader search
                        if (images.length === 0) {
                            document.querySelectorAll('img').forEach(img => {
                                const src = img.src || img.dataset.src;
                                if (src && src.includes('massimodutti') && src.includes('product') && !src.includes('logo')) {
                                    if (!images.includes(src)) {
                                        images.push(src);
                                    }
                                }
                            });
                        }
                        
                        // Get color
                        const color = getText([
                            '[class*="color-name"]',
                            '.product-detail-info__color-name',
                            '[data-testid="selected-color"]',
                            '.color-name'
                        ]);
                        
                        // Get sizes
                        const sizes = [];
                        const sizeElements = document.querySelectorAll('[class*="size-selector"] button, [class*="size-option"], .size-option');
                        sizeElements.forEach(el => {
                            const size = el.textContent.trim();
                            if (size && !sizes.includes(size)) {
                                sizes.push(size);
                            }
                        });
                        
                        // Get description
                        const description = getText([
                            '[class*="product-description"]',
                            '.product-detail-info__description',
                            '[data-testid="product-description"]',
                            '.description'
                        ]);
                        
                        // Get brand (usually Massimo Dutti)
                        const brand = getText([
                            '[class*="brand"]',
                            '.brand-name'
                        ]) || 'Massimo Dutti';
                        
                        return {
                            name,
                            brand,
                            price,
                            originalPrice,
                            description,
                            color,
                            images: images.slice(0, 10), // Limit to 10 images
                            sizes,
                            pageTitle: document.title,
                            url: window.location.href
                        };
                    });
                    
                    log.info('Extracted data:', JSON.stringify(data, null, 2));
                    return data;
                }
            `.trim(),
            proxyConfiguration: {
                useApifyProxy: true,
                apifyProxyGroups: ['RESIDENTIAL']
            },
            maxPagesPerCrawl: 1,
            maxRequestRetries: 2,
            maxConcurrency: 1,
            pageLoadTimeoutSecs: 60,
            dynamicContentWaitSecs: 10,
            debugLog: true
        };

        // Run the Actor
        const run = await client.actor("apify/puppeteer-scraper").call(input);
        
        // Get the results
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        if (!items || items.length === 0) {
            throw new Error('No data returned from Apify');
        }
        
        const data = items[0];
        console.log('📊 Raw Apify data:', {
            name: data.name,
            images: data.images?.length || 0,
            price: data.price
        });
        
        // Parse price
        const parsePrice = (priceStr) => {
            if (!priceStr) return 0;
            const match = priceStr.match(/[\d,]+\.?\d*/);
            return match ? parseFloat(match[0].replace(',', '')) : 0;
        };
        
        const currentPrice = parsePrice(data.price);
        const origPrice = parsePrice(data.originalPrice) || currentPrice;
        
        return {
            name: data.name || data.pageTitle || 'Massimo Dutti Product',
            brand: data.brand || 'Massimo Dutti',
            price: currentPrice,
            originalPrice: origPrice,
            isOnSale: data.originalPrice && origPrice > currentPrice,
            images: data.images || [],
            url: data.url || url,
            description: data.description || '',
            color: data.color || '',
            sizes: data.sizes || [],
            inStock: data.sizes && data.sizes.length > 0,
            platform: 'massimodutti'
        };
        
    } catch (error) {
        console.error('Apify error:', error.message);
        throw error;
    }
}

async function scrapeMassimoDutti(url) {
    console.log('🛍️ Scraping Massimo Dutti:', url);
    
    // Skip direct scraping and go straight to Apify if token exists
    if (process.env.APIFY_API_TOKEN) {
        try {
            return await scrapeMassimoDuttiWithApify(url);
        } catch (error) {
            console.error('Apify scraping failed:', error.message);
        }
    }
    
    // Fallback
    console.log('📱 Using fallback data for Massimo Dutti');
    const urlParts = url.split('/');
    const productSlug = urlParts[urlParts.length - 1] || 'product';
    const productName = productSlug
        .replace(/-l\d+$/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    
    return {
        name: productName || 'Massimo Dutti Product',
        brand: 'Massimo Dutti',
        price: 0,
        originalPrice: 0,
        isOnSale: false,
        images: [],
        url,
        description: 'Visit Massimo Dutti website for full product details',
        color: '',
        sizes: [],
        inStock: true,
        platform: 'massimodutti',
        error: 'Bot protection detected. Please visit the website directly.'
    };
}

module.exports = { scrapeMassimoDutti };