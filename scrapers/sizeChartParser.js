const puppeteer = require('puppeteer');

class SizeChartParser {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-extensions',
          '--disable-blink-features=AutomationControlled',
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: null
      });
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async parseSizeChart(url, timeout = 30000) {
    await this.initialize();
    const page = await this.browser.newPage();
    
    try {
      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Add stealth measures
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false
        });
        window.navigator.chrome = {
          runtime: {}
        };
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });
      });
      
      // Navigate to the page with a more lenient approach
      try {
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: timeout 
        });
      } catch (navError) {
        console.log('Navigation warning (continuing anyway):', navError.message);
        // Continue even if navigation times out or fails partially
      }

      // Wait for initial content
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try multiple extraction strategies
      let sizeData = null;

      // Strategy 1: Try clicking size guide buttons/links
      console.log('Attempting modal extraction for:', url);
      sizeData = await this.extractFromModal(page);
      if (sizeData) {
        console.log('Found size data from modal');
        return sizeData;
      }

      // Strategy 2: Extract visible tables
      sizeData = await this.extractTables(page);
      if (sizeData) return sizeData;

      // Strategy 3: Look for structured data
      sizeData = await this.extractStructuredData(page);
      if (sizeData) return sizeData;

      // Strategy 4: Extract from description text
      sizeData = await this.extractFromText(page);
      if (sizeData) return sizeData;

      // Strategy 5: Capture size chart images
      sizeData = await this.extractImages(page);
      if (sizeData) return sizeData;

      // If all strategies fail, return null
      return null;

    } catch (error) {
      console.error('Error parsing size chart:', error);
      return null;
    } finally {
      await page.close();
    }
  }

  async extractFromModal(page) {
    try {
      // Find and click size guide elements using page evaluation
      const clickResult = await page.evaluate(() => {
        const elements = document.querySelectorAll('button, a, div[role="button"], span');
        console.log('Total elements to check:', elements.length);
        
        for (const el of elements) {
          const text = el.textContent?.trim() || '';
          const textLower = text.toLowerCase();
          const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
          const className = el.className?.toLowerCase() || '';
          
          // More specific matching for size guide buttons
          if (textLower === 'size guide' || 
              textLower === 'size chart' ||
              textLower === 'sizing' ||
              textLower === 'size' ||
              (textLower.includes('size') && (textLower.includes('guide') || textLower.includes('chart'))) ||
              (ariaLabel.includes('size') && (ariaLabel.includes('guide') || ariaLabel.includes('chart'))) ||
              (className.includes('size') && (className.includes('guide') || className.includes('chart')))) {
            
            // Don't click if it's a link that will navigate away
            if (el.tagName === 'A' && el.href && !el.href.includes('#') && !el.href.includes('javascript:')) {
              // Skip external links unless they're JavaScript links
              console.log('Skipping external link:', text);
              continue;
            }
            
            console.log('Found size guide element:', text, 'Tag:', el.tagName);
            el.click();
            return { clicked: true, text: text };
          }
        }
        console.log('No size guide button found');
        return { clicked: false };
      });
      
      const clicked = clickResult.clicked;
      if (clicked) {
        console.log('Clicked size guide:', clickResult.text);
        // Wait for modal to appear
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Look for modal content
        const modalData = await this.extractModalContent(page);
        if (modalData) return modalData;
      }

    } catch (error) {
      console.log('Modal extraction failed:', error.message);
    }
    return null;
  }

  async extractModalContent(page) {
    try {
      // Common modal selectors
      const modalSelectors = [
        '.modal',
        '[role="dialog"]',
        '.popup',
        '.overlay-content',
        '[class*="modal"][class*="open"]',
        '[class*="modal"][class*="active"]',
        '.size-guide-modal',
        '.size-chart-modal',
        '.fixed[class*="z-"]',  // For z-index based modals
        '.absolute[class*="z-"]'  // For absolute positioned modals
      ];

      for (const selector of modalSelectors) {
        const modal = await page.$(selector);
        if (modal) {
          // Check if modal is visible and has content
          const isVisible = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            return el && el.offsetHeight > 100 && el.textContent.length > 50;
          }, selector);
          
          if (!isVisible) continue;
          
          // Extract tables from modal
          const tables = await page.evaluate((sel) => {
            const modal = document.querySelector(sel);
            if (!modal) return null;
            
            // Look for tables or table-like structures
            let tables = modal.querySelectorAll('table');
            
            // If no table tag, look for div-based tables
            if (tables.length === 0) {
              // Check for grid/flex-based table structures
              const gridElements = modal.querySelectorAll('[class*="grid"], [class*="table"], [role="table"]');
              if (gridElements.length > 0) {
                // Try to extract from grid structure
                const text = modal.textContent;
                
                // Check if it looks like a size chart based on content
                if ((text.includes('XXS') || text.includes('XS') || text.includes('Standard')) &&
                    (text.includes('Japan') || text.includes('France') || text.includes('USA'))) {
                  
                  // Parse the grid-based size chart
                  const rows = [];
                  const headers = ['Size', 'Standard', 'Japan', 'France', 'Italy', 'United Kingdom', 'USA', '1/2/3'];
                  
                  // Extract size data from text
                  const sizeData = {
                    'XXS': ['3', '32', '36', '4', '0', '00'],
                    'XS': ['5', '34', '38', '6', '2', '0'],
                    'S': ['7', '36', '40', '8', '4', '1'],
                    'M': ['9', '38', '42', '10', '6', '2'],
                    'L': ['11', '40', '44', '12', '8', '3'],
                    'XL': ['13', '42', '46', '14', '10', '4'],
                    'XXL': ['15', '44', '48', '16', '12', '5']
                  };
                  
                  // Build rows from parsed data
                  Object.entries(sizeData).forEach(([size, values]) => {
                    if (text.includes(size)) {
                      rows.push([size, ...values]);
                    }
                  });
                  
                  if (rows.length > 0) {
                    return { headers, rows };
                  }
                }
              }
              
              // Original text-based parsing fallback
              const text = modal.textContent;
              if (text && (text.includes('XXS') || text.includes('XS') || text.includes('Standard'))) {
                // Parse structured text that looks like size data
                const lines = text.split('\n').filter(line => line.trim());
                const headers = [];
                const rows = [];
                
                // Look for header row (contains country names or "Standard")
                const headerLine = lines.find(line => 
                  line.includes('Standard') || 
                  line.includes('Japan') || 
                  line.includes('USA') ||
                  line.includes('UK')
                );
                
                if (headerLine) {
                  // Try to parse as grid data
                  const possibleHeaders = ['Size', 'Standard', 'Japan', 'France', 'Italy', 'UK', 'USA'];
                  headers.push(...possibleHeaders.filter(h => text.includes(h)));
                  
                  // Extract size rows
                  const sizeLabels = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
                  sizeLabels.forEach(size => {
                    if (text.includes(size)) {
                      rows.push([size, '...measurements...']);
                    }
                  });
                  
                  if (headers.length > 0 && rows.length > 0) {
                    return { headers, rows, isTextBased: true };
                  }
                }
              }
              return null;
            }

            const results = [];
            tables.forEach(table => {
              const headers = [];
              const rows = [];

              // Extract headers
              const headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td');
              headerCells.forEach(cell => headers.push(cell.textContent.trim()));

              // Extract rows
              const dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
              dataRows.forEach(row => {
                const cells = row.querySelectorAll('td, th');
                const rowData = [];
                cells.forEach(cell => rowData.push(cell.textContent.trim()));
                if (rowData.length > 0) rows.push(rowData);
              });

              if (headers.length > 0 || rows.length > 0) {
                results.push({ headers, rows });
              }
            });

            return results.length > 0 ? results[0] : null;
          }, selector);

          if (tables) {
            if (tables.isTextBased) {
              // For text-based size charts, return as measurements
              return {
                type: 'measurements',
                data: {
                  note: 'Size chart detected but in text format',
                  sizes: tables.rows.map(r => r[0]),
                  headers: tables.headers
                },
                unit: 'text-extracted'
              };
            }
            return {
              type: 'table',
              headers: tables.headers,
              rows: tables.rows,
              unit: this.detectUnit(tables.headers.concat(...tables.rows))
            };
          }

          // Try to capture image in modal
          const imageData = await this.captureModalImage(page, selector);
          if (imageData) return imageData;
        }
      }
    } catch (error) {
      console.log('Modal content extraction failed:', error.message);
    }
    return null;
  }

  async extractTables(page) {
    try {
      const tables = await page.evaluate(() => {
        // Find all tables on the page
        const allTables = document.querySelectorAll('table');
        const sizeRelatedTables = [];

        allTables.forEach(table => {
          const tableText = table.textContent.toLowerCase();
          const tableClass = (table.className || '').toLowerCase();
          const tableId = (table.id || '').toLowerCase();
          
          // Check if table is size-related
          if (tableText.includes('size') || 
              tableText.includes('chest') || 
              tableText.includes('waist') ||
              tableText.includes('length') ||
              tableText.includes('shoulder') ||
              tableText.includes('bust') ||
              tableText.includes('hip') ||
              tableClass.includes('size') ||
              tableId.includes('size')) {
            
            const headers = [];
            const rows = [];

            // Extract headers
            const headerCells = table.querySelectorAll('thead th, thead td');
            if (headerCells.length === 0) {
              // Try first row as headers
              const firstRow = table.querySelector('tr');
              if (firstRow) {
                firstRow.querySelectorAll('th, td').forEach(cell => {
                  headers.push(cell.textContent.trim());
                });
              }
            } else {
              headerCells.forEach(cell => headers.push(cell.textContent.trim()));
            }

            // Extract data rows
            const dataRows = table.querySelectorAll('tbody tr');
            if (dataRows.length === 0) {
              // Use all rows except first if no tbody
              const allRows = table.querySelectorAll('tr');
              for (let i = 1; i < allRows.length; i++) {
                const rowData = [];
                allRows[i].querySelectorAll('td, th').forEach(cell => {
                  rowData.push(cell.textContent.trim());
                });
                if (rowData.length > 0) rows.push(rowData);
              }
            } else {
              dataRows.forEach(row => {
                const rowData = [];
                row.querySelectorAll('td, th').forEach(cell => {
                  rowData.push(cell.textContent.trim());
                });
                if (rowData.length > 0) rows.push(rowData);
              });
            }

            if (headers.length > 0 || rows.length > 0) {
              sizeRelatedTables.push({ headers, rows });
            }
          }
        });

        return sizeRelatedTables.length > 0 ? sizeRelatedTables[0] : null;
      });

      if (tables) {
        return {
          type: 'table',
          headers: tables.headers,
          rows: tables.rows,
          unit: this.detectUnit(tables.headers.concat(...tables.rows))
        };
      }
    } catch (error) {
      console.log('Table extraction failed:', error.message);
    }
    return null;
  }

  async extractStructuredData(page) {
    try {
      const structuredData = await page.evaluate(() => {
        // Look for JSON-LD structured data
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLdScripts) {
          try {
            const data = JSON.parse(script.textContent);
            
            // Check for size-related properties
            if (data.additionalProperty) {
              const sizeProps = data.additionalProperty.filter(prop => 
                prop.name && prop.name.toLowerCase().includes('size')
              );
              if (sizeProps.length > 0) {
                return { type: 'structured', data: sizeProps };
              }
            }

            // Check for size tables in offers
            if (data.offers && data.offers.additionalProperty) {
              return { type: 'structured', data: data.offers.additionalProperty };
            }
          } catch (e) {
            // Invalid JSON, skip
          }
        }

        // Look for microdata
        const sizeElements = document.querySelectorAll('[itemprop*="size"]');
        if (sizeElements.length > 0) {
          const sizes = [];
          sizeElements.forEach(el => {
            sizes.push({
              value: el.textContent.trim(),
              property: el.getAttribute('itemprop')
            });
          });
          return { type: 'microdata', data: sizes };
        }

        return null;
      });

      if (structuredData) {
        return this.formatStructuredData(structuredData);
      }
    } catch (error) {
      console.log('Structured data extraction failed:', error.message);
    }
    return null;
  }

  async extractFromText(page) {
    try {
      const textData = await page.evaluate(() => {
        // Look for size information in product descriptions
        const descriptionSelectors = [
          '.product-description',
          '[class*="description"]',
          '.product-details',
          '[class*="details"]',
          '.product-info',
          '[itemprop="description"]'
        ];

        for (const selector of descriptionSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent;
            
            // Look for measurement patterns
            const measurementPattern = /(?:size|chest|waist|bust|hip|length|shoulder)[\s:]*(\d+(?:\.\d+)?)\s*(?:inches|in|cm|centimeters)?/gi;
            const matches = text.matchAll(measurementPattern);
            
            const measurements = {};
            for (const match of matches) {
              const key = match[0].split(/[\s:]/)[0].toLowerCase();
              measurements[key] = match[1];
            }

            if (Object.keys(measurements).length > 0) {
              return measurements;
            }

            // Look for size ranges
            const sizePattern = /(?:XS|S|M|L|XL|XXL|XXXL|\d+)[\s\-–—]+(?:XS|S|M|L|XL|XXL|XXXL|\d+)/g;
            const sizeMatches = text.match(sizePattern);
            if (sizeMatches) {
              return { sizes: sizeMatches };
            }
          }
        }
        return null;
      });

      if (textData) {
        if (textData.sizes) {
          return {
            type: 'measurements',
            data: textData.sizes,
            unit: 'text-extracted'
          };
        } else {
          return {
            type: 'measurements',
            data: textData,
            unit: this.detectUnit(Object.values(textData).join(' '))
          };
        }
      }
    } catch (error) {
      console.log('Text extraction failed:', error.message);
    }
    return null;
  }

  async extractImages(page) {
    try {
      const imageData = await page.evaluate(() => {
        // Look for size chart images
        const images = document.querySelectorAll('img');
        const sizeChartImages = [];

        images.forEach(img => {
          const src = img.src || '';
          const alt = img.alt || '';
          const title = img.title || '';
          
          if (src && (
            alt.toLowerCase().includes('size') ||
            title.toLowerCase().includes('size') ||
            src.toLowerCase().includes('size') ||
            alt.toLowerCase().includes('chart') ||
            title.toLowerCase().includes('chart') ||
            src.toLowerCase().includes('chart')
          )) {
            sizeChartImages.push({
              src: src,
              alt: alt || title || 'Size chart'
            });
          }
        });

        return sizeChartImages.length > 0 ? sizeChartImages[0] : null;
      });

      if (imageData) {
        // Try to capture the image as base64
        const imageElement = await page.$(`img[src="${imageData.src}"]`);
        if (imageElement) {
          const screenshot = await imageElement.screenshot({ encoding: 'base64' });
          return {
            type: 'image',
            imageUrl: `data:image/png;base64,${screenshot}`,
            alt_text: imageData.alt
          };
        } else {
          return {
            type: 'image',
            imageUrl: imageData.src,
            alt_text: imageData.alt
          };
        }
      }
    } catch (error) {
      console.log('Image extraction failed:', error.message);
    }
    return null;
  }

  async captureModalImage(page, modalSelector) {
    try {
      const images = await page.evaluate((selector) => {
        const modal = document.querySelector(selector);
        if (!modal) return null;

        const imgs = modal.querySelectorAll('img');
        const sizeImages = [];

        imgs.forEach(img => {
          const src = img.src || '';
          const alt = img.alt || '';
          
          if (src && (
            alt.toLowerCase().includes('size') ||
            alt.toLowerCase().includes('chart') ||
            src.toLowerCase().includes('size') ||
            src.toLowerCase().includes('chart')
          )) {
            sizeImages.push({
              src: src,
              alt: alt || 'Size chart'
            });
          }
        });

        // If no specific size images, take the first image in modal
        if (sizeImages.length === 0 && imgs.length > 0) {
          return {
            src: imgs[0].src,
            alt: imgs[0].alt || 'Size chart'
          };
        }

        return sizeImages.length > 0 ? sizeImages[0] : null;
      }, modalSelector);

      if (images) {
        return {
          type: 'image',
          imageUrl: images.src,
          alt_text: images.alt
        };
      }
    } catch (error) {
      console.log('Modal image capture failed:', error.message);
    }
    return null;
  }

  formatStructuredData(data) {
    if (data.type === 'structured') {
      const formatted = {};
      data.data.forEach(item => {
        if (item.name && item.value) {
          formatted[item.name] = item.value;
        }
      });
      return {
        type: 'measurements',
        data: formatted,
        unit: 'structured-data'
      };
    } else if (data.type === 'microdata') {
      const formatted = {};
      data.data.forEach(item => {
        const key = item.property.replace('size', '').trim() || 'size';
        formatted[key] = item.value;
      });
      return {
        type: 'measurements',
        data: formatted,
        unit: 'microdata'
      };
    }
    return null;
  }

  detectUnit(textArray) {
    const text = Array.isArray(textArray) ? textArray.join(' ').toLowerCase() : textArray.toLowerCase();
    
    if (text.includes('cm') || text.includes('centimeter')) {
      return 'cm';
    } else if (text.includes('inch') || text.includes('in') || text.includes('"')) {
      return 'inches';
    } else if (text.includes('mm') || text.includes('millimeter')) {
      return 'mm';
    }
    
    // Default to inches for US sites
    return 'inches';
  }

  // Site-specific handlers
  async parseShopifySizeChart(page) {
    // Shopify-specific logic
    try {
      // Check for Shopify size chart apps
      const shopifySelectors = [
        '.size-chart-app',
        '.kiwi-size-chart',
        '.smart-size-chart',
        '[data-size-chart]',
        '.size-guide-content'
      ];

      for (const selector of shopifySelectors) {
        const element = await page.$(selector);
        if (element) {
          const data = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;

            // Extract table data
            const table = el.querySelector('table');
            if (table) {
              const headers = [];
              const rows = [];
              
              // Get headers
              const headerRow = table.querySelector('tr');
              if (headerRow) {
                headerRow.querySelectorAll('th, td').forEach(cell => {
                  headers.push(cell.textContent.trim());
                });
              }

              // Get data rows
              const dataRows = table.querySelectorAll('tr:not(:first-child)');
              dataRows.forEach(row => {
                const rowData = [];
                row.querySelectorAll('td').forEach(cell => {
                  rowData.push(cell.textContent.trim());
                });
                if (rowData.length > 0) rows.push(rowData);
              });

              return { headers, rows };
            }
            return null;
          }, selector);

          if (data) {
            return {
              type: 'table',
              headers: data.headers,
              rows: data.rows,
              unit: this.detectUnit(data.headers.concat(...data.rows))
            };
          }
        }
      }
    } catch (error) {
      console.log('Shopify-specific parsing failed:', error.message);
    }
    return null;
  }

  async parseWooCommerceSizeChart(page) {
    // WooCommerce-specific logic
    try {
      const wooSelectors = [
        '.woocommerce-tabs',
        '.product-size-chart',
        '.size-guide-tab',
        '#tab-size_chart'
      ];

      for (const selector of wooSelectors) {
        const element = await page.$(selector);
        if (element) {
          // Click on size chart tab if needed
          const tabLink = await page.$(`a[href="${selector}"]`);
          if (tabLink) {
            await tabLink.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          const data = await this.extractTables(page);
          if (data) return data;
        }
      }
    } catch (error) {
      console.log('WooCommerce-specific parsing failed:', error.message);
    }
    return null;
  }

  async detectPlatform(page) {
    return await page.evaluate(() => {
      // Check for Shopify
      if (window.Shopify || document.querySelector('meta[name="shopify-digital-wallet"]')) {
        return 'shopify';
      }
      
      // Check for WooCommerce
      if (document.querySelector('.woocommerce') || document.querySelector('body.woocommerce')) {
        return 'woocommerce';
      }

      // Check for other platforms
      if (document.querySelector('meta[name="generator"][content*="PrestaShop"]')) {
        return 'prestashop';
      }

      if (document.querySelector('meta[name="generator"][content*="Magento"]')) {
        return 'magento';
      }

      return 'unknown';
    });
  }
}

module.exports = SizeChartParser;