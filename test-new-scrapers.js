const { scrapeProduct } = require("./scrapers/index");

// Test URLs for the new scrapers
const testUrls = [
  "https://www.urbanoutfitters.com/shop/uo-penny-denim-mini-skirt",
  "https://www.freepeople.com/shop/old-west-wrangler-maxi-dress",
  "https://www.revolve.com/lovers-and-friends-gillian-mini-dress/dp/LOVF-WD3379/",
  "https://www.net-a-porter.com/en-us/shop/product/bottega-veneta/bags/mini-bags/mini-jodie-intrecciato-leather-tote/46376663162806598",
  "https://www.asos.com/us/asos-design/asos-design-midi-skirt-in-soft-suiting/prd/204195815",
  "https://www.reformation.com/products/tagliatelle-linen-dress",
  "https://www.everlane.com/products/womens-organic-cotton-box-cut-tee-black",
  "https://www.anthropologie.com/shop/pilcro-denim-mini-skirt",
  "https://www.madewell.com/the-harlow-wide-leg-jean-in-tile-white-ND168.html",
  "https://www.aritzia.com/us/en/product/sculpt-knit-tank/82819.html"
];

async function testNewScrapers() {
  console.log("🧪 Testing all new scrapers\n");
  console.log("=".repeat(80));
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const url of testUrls) {
    const domain = new URL(url).hostname.replace("www.", "");
    console.log(`\n📍 Testing \${domain}`);
    console.log("-".repeat(60));
    
    try {
      const startTime = Date.now();
      const result = await scrapeProduct(url);
      const elapsed = Date.now() - startTime;
      
      if (result.error) {
        console.log(`❌ FAILED: \${result.error}`);
        results.failed.push({ domain, error: result.error });
      } else if (result.name && result.price) {
        console.log(`✅ SUCCESS!`);
        console.log(`   Name: \${result.name}`);
        console.log(`   Price: \${result.price}`);
        console.log(`   Brand: \${result.brand || "N/A"}`);
        console.log(`   Images: \${result.images ? result.images.length : 0}`);
        console.log(`   Sizes: \${result.sizes ? result.sizes.length : 0}`);
        console.log(`   Time: \${elapsed}ms`);
        results.success.push({ domain, name: result.name });
      } else {
        console.log(`⚠️  PARTIAL: Missing critical data`);
        console.log(`   Name: \${result.name || "❌ Missing"}`);
        console.log(`   Price: \${result.price || "❌ Missing"}`);
        results.failed.push({ domain, error: "Missing critical data" });
      }
    } catch (error) {
      console.log(`❌ ERROR: \${error.message}`);
      results.failed.push({ domain, error: error.message });
    }
  }
  
  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(80));
  console.log(`✅ Success: \${results.success.length}/\${testUrls.length}`);
  console.log(`❌ Failed: \${results.failed.length}/\${testUrls.length}`);
  
  if (results.success.length > 0) {
    console.log("\n✅ Working scrapers:");
    results.success.forEach(s => console.log(`   - \${s.domain}`));
  }
  
  if (results.failed.length > 0) {
    console.log("\n❌ Failed scrapers:");
    results.failed.forEach(f => console.log(`   - \${f.domain}: \${f.error.substring(0, 50)}`));
  }
  
  console.log(`\n📈 Success Rate: \${((results.success.length/testUrls.length)*100).toFixed(1)}%`);
}

testNewScrapers().catch(console.error);
