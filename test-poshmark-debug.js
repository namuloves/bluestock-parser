const axios = require('axios');
const cheerio = require('cheerio');

const testUrl = 'https://poshmark.com/listing/L-academie-Marianna-Enoa-Midi-Dress-in-Red-Light-Pink-689def60c71ba137f903554a';

async function debugPoshmark() {
  console.log('🔍 Debugging Poshmark scraper...\n');
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    };
    
    const response = await axios.get(testUrl, { headers, timeout: 30000 });
    console.log('✅ Page fetched, status:', response.status);
    
    const $ = cheerio.load(response.data);
    
    // Check for Next.js data
    const nextDataScript = $('#__NEXT_DATA__');
    if (nextDataScript.length) {
      console.log('Found Next.js data!');
      try {
        const nextData = JSON.parse(nextDataScript.html());
        const listing = nextData?.props?.pageProps?.listing || nextData?.props?.pageProps?.data;
        
        if (listing) {
          console.log('\n📦 Listing data from Next.js:');
          console.log('Title:', listing.title);
          console.log('Brand:', listing.brand || listing.brand_name);
          console.log('Price:', listing.price || listing.display_price);
          console.log('Size:', listing.size || listing.size_name);
          console.log('Color:', listing.color || listing.color_name);
          console.log('Seller:', listing.seller?.username || listing.seller_name);
          console.log('Status:', listing.status || listing.availability);
          console.log('Pictures count:', listing.pictures?.length || listing.images?.length || 0);
          
          if (listing.pictures && listing.pictures.length > 0) {
            console.log('\nImage URLs:');
            listing.pictures.slice(0, 3).forEach((pic, i) => {
              console.log(`  ${i+1}:`, pic.url || pic.image_url || pic);
            });
          }
        } else {
          console.log('No listing data in Next.js props');
          console.log('Props structure:', Object.keys(nextData?.props?.pageProps || {}));
        }
      } catch (e) {
        console.log('Error parsing Next.js data:', e.message);
      }
    } else {
      console.log('No Next.js data found');
    }
    
    // Check HTML selectors
    console.log('\n🔍 HTML Selectors:');
    const selectors = {
      'Title h1': $('h1').first().text().trim(),
      'Price .price': $('.price').first().text().trim(),
      'Brand link': $('a[href*="/brand/"]').first().text().trim(),
      'Meta title': $('meta[property="og:title"]').attr('content'),
      'Meta image': $('meta[property="og:image"]').attr('content')
    };
    
    Object.entries(selectors).forEach(([key, value]) => {
      if (value) console.log(`${key}:`, value.substring(0, 100));
    });
    
    // Check for CloudFront protection
    if (response.data.includes('cloudfront') || response.data.includes('cf-ray')) {
      console.log('\n⚠️ CloudFront/Cloudflare detected - may need proxy');
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response headers:', error.response.headers);
    }
  }
}

debugPoshmark();