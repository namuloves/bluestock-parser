/**
 * Image URL Migration Script
 *
 * Migrates existing product image URLs to use Bunny CDN for improved performance.
 * This script updates both the main products table and any related image fields.
 */

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

class ImageMigration {
  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'https://qkaeoxsttjahdziqcgsk.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    // CDN configuration
    this.pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL || 'bluestock.b-cdn.net';
    this.batchSize = 50; // Process products in batches
    this.dryRun = true; // Safety: start with dry run
  }

  /**
   * Transform a single image URL to use CDN
   */
  transformImageUrl(imageUrl, options = {}) {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return imageUrl;
    }

    // Skip if already a CDN URL
    if (imageUrl.includes(this.pullZoneUrl) || imageUrl.includes('b-cdn.net')) {
      return imageUrl;
    }

    try {
      const url = new URL(imageUrl);

      // For Supabase URLs, use direct CDN transformation
      if (imageUrl.includes('supabase.co')) {
        const path = imageUrl.split('supabase.co')[1];
        const params = new URLSearchParams({
          width: options.width || '800',
          quality: options.quality || '85',
          auto_webp: 'true'
        });
        return `https://${this.pullZoneUrl}${path}?${params}`;
      }

      // For external URLs, use direct CDN pull
      const encodedUrl = encodeURIComponent(imageUrl);
      const params = new URLSearchParams({
        width: options.width || '800',
        quality: options.quality || '85',
        format: options.format || 'auto'
      });

      return `https://${this.pullZoneUrl}/${encodedUrl}?${params}`;

    } catch (error) {
      console.warn(`⚠️ Could not transform URL: ${imageUrl}`, error.message);
      return imageUrl; // Return original on error
    }
  }

  /**
   * Transform array of image URLs
   */
  transformImageUrls(imageUrls) {
    if (!Array.isArray(imageUrls)) {
      return [];
    }

    return imageUrls.map(url => this.transformImageUrl(url));
  }

  /**
   * Get statistics about current image URLs
   */
  async getImageStats() {
    console.log('📊 Analyzing current image URLs...');

    try {
      // Get all products with images
      const { data: products, error } = await this.supabase
        .from('products')
        .select('id, image_urls, vendor_url, parsed_at')
        .not('image_urls', 'is', null)
        .order('parsed_at', { ascending: false });

      if (error) throw error;

      const stats = {
        total_products: products.length,
        products_with_images: 0,
        total_image_urls: 0,
        cdn_urls: 0,
        original_urls: 0,
        supabase_urls: 0,
        external_urls: 0,
        empty_arrays: 0
      };

      products.forEach(product => {
        if (product.image_urls && Array.isArray(product.image_urls)) {
          if (product.image_urls.length === 0) {
            stats.empty_arrays++;
            return;
          }

          stats.products_with_images++;
          stats.total_image_urls += product.image_urls.length;

          product.image_urls.forEach(url => {
            if (typeof url === 'string') {
              if (url.includes('b-cdn.net') || url.includes(this.pullZoneUrl)) {
                stats.cdn_urls++;
              } else if (url.includes('supabase.co')) {
                stats.supabase_urls++;
              } else {
                stats.external_urls++;
              }
              stats.original_urls++;
            }
          });
        }
      });

      return stats;

    } catch (error) {
      console.error('❌ Error getting image stats:', error);
      throw error;
    }
  }

  /**
   * Preview migration changes (dry run)
   */
  async previewMigration(limit = 10) {
    console.log(`🔍 Previewing migration changes (showing ${limit} examples)...`);

    try {
      const { data: products, error } = await this.supabase
        .from('products')
        .select('id, product_name, image_urls, vendor_url')
        .not('image_urls', 'is', null)
        .limit(limit);

      if (error) throw error;

      const previews = [];

      products.forEach(product => {
        if (product.image_urls && Array.isArray(product.image_urls) && product.image_urls.length > 0) {
          const originalUrls = product.image_urls.filter(url =>
            typeof url === 'string' && !url.includes('b-cdn.net')
          );

          if (originalUrls.length > 0) {
            const transformedUrls = this.transformImageUrls(originalUrls);

            previews.push({
              id: product.id,
              name: product.product_name,
              original_count: originalUrls.length,
              before: originalUrls[0], // Show first URL as example
              after: transformedUrls[0]
            });
          }
        }
      });

      return previews;

    } catch (error) {
      console.error('❌ Error previewing migration:', error);
      throw error;
    }
  }

  /**
   * Migrate image URLs in batches
   */
  async migrateImageUrls(options = {}) {
    const { batchSize = this.batchSize, dryRun = this.dryRun } = options;

    console.log(`🚀 Starting image URL migration...`);
    console.log(`📦 Batch size: ${batchSize}`);
    console.log(`🏃 Dry run: ${dryRun ? 'YES (no changes will be made)' : 'NO (will update database)'}`);

    let processed = 0;
    let updated = 0;
    let errors = 0;
    let offset = 0;

    try {
      while (true) {
        // Get batch of products
        const { data: products, error } = await this.supabase
          .from('products')
          .select('id, image_urls, vendor_url')
          .not('image_urls', 'is', null)
          .range(offset, offset + batchSize - 1)
          .order('parsed_at', { ascending: false });

        if (error) throw error;

        if (products.length === 0) {
          console.log('✅ All products processed');
          break;
        }

        // Process batch
        for (const product of products) {
          processed++;

          if (product.image_urls && Array.isArray(product.image_urls) && product.image_urls.length > 0) {
            const originalUrls = product.image_urls;
            const needsUpdate = originalUrls.some(url =>
              typeof url === 'string' && !url.includes('b-cdn.net')
            );

            if (needsUpdate) {
              const transformedUrls = this.transformImageUrls(originalUrls);

              if (!dryRun) {
                try {
                  const { error: updateError } = await this.supabase
                    .from('products')
                    .update({ image_urls: transformedUrls })
                    .eq('id', product.id);

                  if (updateError) {
                    console.error(`❌ Error updating product ${product.id}:`, updateError);
                    errors++;
                  } else {
                    updated++;
                    if (updated % 10 === 0) {
                      console.log(`📈 Updated ${updated} products so far...`);
                    }
                  }
                } catch (updateError) {
                  console.error(`❌ Error updating product ${product.id}:`, updateError);
                  errors++;
                }
              } else {
                updated++; // Count what would be updated in dry run
              }
            }
          }
        }

        offset += batchSize;

        // Show progress
        console.log(`📊 Progress: ${processed} processed, ${updated} ${dryRun ? 'would be updated' : 'updated'}, ${errors} errors`);

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`\n🎉 Migration ${dryRun ? 'preview' : ''} complete!`);
      console.log(`📊 Final stats:`);
      console.log(`   - Products processed: ${processed}`);
      console.log(`   - Products ${dryRun ? 'to be updated' : 'updated'}: ${updated}`);
      console.log(`   - Errors: ${errors}`);

      return {
        processed,
        updated,
        errors,
        dryRun
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Rollback migration (restore original URLs)
   * Note: This requires keeping a backup of original URLs
   */
  async rollbackMigration() {
    console.log('⚠️ Rollback functionality not implemented yet');
    console.log('💡 Recommendation: Run with dryRun=true first to preview changes');
  }

  /**
   * Test CDN accessibility for a sample of URLs
   */
  async testCdnAccessibility(sampleSize = 5) {
    console.log(`🧪 Testing CDN accessibility with ${sampleSize} sample URLs...`);

    try {
      const { data: products, error } = await this.supabase
        .from('products')
        .select('image_urls')
        .not('image_urls', 'is', null)
        .limit(sampleSize);

      if (error) throw error;

      const testResults = [];

      for (const product of products) {
        if (product.image_urls && product.image_urls.length > 0) {
          const originalUrl = product.image_urls[0];
          const cdnUrl = this.transformImageUrl(originalUrl);

          try {
            // Test both original and CDN URLs
            const axios = require('axios');

            const [originalResponse, cdnResponse] = await Promise.allSettled([
              axios.head(originalUrl, { timeout: 5000 }),
              axios.head(cdnUrl, { timeout: 5000 })
            ]);

            testResults.push({
              original_url: originalUrl,
              cdn_url: cdnUrl,
              original_status: originalResponse.status === 'fulfilled' ? originalResponse.value.status : 'ERROR',
              cdn_status: cdnResponse.status === 'fulfilled' ? cdnResponse.value.status : 'ERROR'
            });

          } catch (error) {
            testResults.push({
              original_url: originalUrl,
              cdn_url: cdnUrl,
              original_status: 'ERROR',
              cdn_status: 'ERROR',
              error: error.message
            });
          }
        }
      }

      return testResults;

    } catch (error) {
      console.error('❌ Error testing CDN accessibility:', error);
      throw error;
    }
  }
}

module.exports = ImageMigration;

// CLI interface when run directly
if (require.main === module) {
  const migration = new ImageMigration();

  async function main() {
    try {
      const command = process.argv[2] || 'stats';

      switch (command) {
        case 'stats':
          const stats = await migration.getImageStats();
          console.log('\n📊 Image URL Statistics:');
          console.table(stats);
          break;

        case 'preview':
          const limit = parseInt(process.argv[3]) || 10;
          const previews = await migration.previewMigration(limit);
          console.log('\n🔍 Migration Preview:');
          console.table(previews);
          break;

        case 'migrate':
          const dryRun = process.argv[3] !== '--for-real';
          const result = await migration.migrateImageUrls({ dryRun });
          console.log('\n✅ Migration result:', result);
          break;

        case 'test':
          const sampleSize = parseInt(process.argv[3]) || 5;
          const testResults = await migration.testCdnAccessibility(sampleSize);
          console.log('\n🧪 CDN Test Results:');
          console.table(testResults);
          break;

        default:
          console.log(`
🖼️  Image Migration Tool

Usage: node utils/imageMigration.js <command>

Commands:
  stats                    Show current image URL statistics
  preview [limit]          Preview migration changes (default: 10)
  migrate [--for-real]     Run migration (default: dry run)
  test [sample_size]       Test CDN accessibility (default: 5)

Examples:
  node utils/imageMigration.js stats
  node utils/imageMigration.js preview 20
  node utils/imageMigration.js migrate        # Dry run
  node utils/imageMigration.js migrate --for-real  # Actually migrate
  node utils/imageMigration.js test 10
          `);
      }

    } catch (error) {
      console.error('❌ Command failed:', error);
      process.exit(1);
    }
  }

  main();
}