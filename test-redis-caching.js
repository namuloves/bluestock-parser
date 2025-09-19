const UniversalParserV3Cached = require('./universal-parser-v3-cached');
const { getCache } = require('./cache/redis-cache');

async function testRedisCaching() {
  console.log('🚀 Testing Redis Caching System\n');
  console.log('=' .repeat(60));

  // Set verbose logging
  process.env.UNIVERSAL_LOG_LEVEL = 'verbose';

  // Enable Redis (in case it's disabled)
  process.env.REDIS_ENABLED = 'true';

  const parser = new UniversalParserV3Cached();
  const testUrl = 'https://www.uniqlo.com/us/en/products/E459565-000/00';

  console.log('\n📝 Test 1: First Request (Cache MISS expected)');
  console.log('-'.repeat(60));

  let startTime = Date.now();
  const firstResult = await parser.parse(testUrl);
  const firstTime = Date.now() - startTime;

  console.log(`✅ First request completed in ${firstTime}ms`);
  console.log(`   Name: ${firstResult.name?.substring(0, 40)}...`);
  console.log(`   Price: $${firstResult.price}`);
  console.log(`   Confidence: ${(firstResult.confidence * 100).toFixed(1)}%`);
  console.log(`   Cached: ${firstResult._cached ? 'Yes' : 'No'}`);

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n📝 Test 2: Second Request (Cache HIT expected)');
  console.log('-'.repeat(60));

  startTime = Date.now();
  const secondResult = await parser.parse(testUrl);
  const secondTime = Date.now() - startTime;

  console.log(`✅ Second request completed in ${secondTime}ms`);
  console.log(`   Name: ${secondResult.name?.substring(0, 40)}...`);
  console.log(`   Price: $${secondResult.price}`);
  console.log(`   Confidence: ${(secondResult.confidence * 100).toFixed(1)}%`);
  console.log(`   Cached: ${secondResult._cached ? 'Yes' : 'No'}`);
  console.log(`   Cache time: ${secondResult._cacheTime}`);

  // Calculate speedup
  const speedup = (firstTime / secondTime).toFixed(1);
  console.log(`\n⚡ Speed improvement: ${speedup}x faster from cache!`);

  // Test cache metrics
  console.log('\n📝 Test 3: Cache Metrics');
  console.log('-'.repeat(60));

  const metrics = await parser.getCacheMetrics();
  console.log('Parser Metrics:');
  console.log(`   Attempts: ${metrics.parser.attempts}`);
  console.log(`   Success rate: ${metrics.parser.successRate}`);
  console.log(`   API interceptions: ${metrics.parser.apiInterceptions}`);

  console.log('\nCache Metrics:');
  console.log(`   Enabled: ${metrics.cache.enabled}`);
  console.log(`   Connected: ${metrics.cache.connected}`);
  console.log(`   Hits: ${metrics.cache.hits}`);
  console.log(`   Misses: ${metrics.cache.misses}`);
  console.log(`   Hit rate: ${metrics.cache.hitRate}`);
  console.log(`   Errors: ${metrics.cache.errors}`);

  // Test cache warming
  console.log('\n📝 Test 4: Cache Warming');
  console.log('-'.repeat(60));

  const popularProducts = [
    'https://www.ssense.com/en-us/men/product/adidas-originals/green-samba-og-sneakers/13567281',
    'https://www.uniqlo.com/us/en/products/E471974-000/00'
  ];

  const warmResults = await parser.warmCache(popularProducts);
  console.log('Warm cache results:', warmResults);

  // Test pattern-based cache clearing
  console.log('\n📝 Test 5: Cache Management');
  console.log('-'.repeat(60));

  // Clear Uniqlo cache entries
  const deleted = await parser.clearCache('uniqlo.com');
  console.log(`Cleared ${deleted} Uniqlo cache entries`);

  // Verify cache was cleared
  startTime = Date.now();
  const afterClearResult = await parser.parse(testUrl);
  const afterClearTime = Date.now() - startTime;

  console.log(`\nRe-fetch after cache clear took ${afterClearTime}ms`);
  console.log(`   Cached: ${afterClearResult._cached ? 'Yes' : 'No'} (should be No)`);

  // Final metrics
  console.log('\n📝 Final Cache Stats');
  console.log('-'.repeat(60));

  const finalMetrics = await parser.getCacheMetrics();
  console.log(`Total cache hits: ${finalMetrics.cache.hits}`);
  console.log(`Total cache misses: ${finalMetrics.cache.misses}`);
  console.log(`Final hit rate: ${finalMetrics.cache.hitRate}`);

  // Cleanup
  await parser.cleanup();

  console.log('\n✅ Redis caching test complete!\n');

  // Summary
  console.log('📊 Summary:');
  console.log('=' .repeat(60));
  console.log(`✅ Cache working: ${secondResult._cached ? 'Yes' : 'No'}`);
  console.log(`✅ Speed improvement: ${speedup}x faster`);
  console.log(`✅ Hit rate: ${finalMetrics.cache.hitRate}`);
  console.log(`✅ Redis connected: ${finalMetrics.cache.connected}`);

  process.exit(0);
}

testRedisCaching().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});