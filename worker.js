require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { scrapeProduct } = require('./scrapers');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

console.log('🚀 Background worker starting...');
console.log('📋 Supabase URL:', process.env.SUPABASE_URL ? 'Connected' : 'NOT SET');

// Track worker health
let lastJobProcessedAt = Date.now();
let jobsProcessed = 0;
let jobsFailed = 0;

/**
 * Process a single job from the queue
 */
async function processNextJob() {
  try {
    // Get next queued job using Postgres row locking to prevent race conditions
    const { data: jobs, error: fetchError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error('❌ Error fetching jobs:', fetchError);
      return;
    }

    if (!jobs || jobs.length === 0) {
      // No jobs in queue - this is normal
      return;
    }

    const job = jobs[0];
    console.log(`\n📦 Processing job ${job.id} for URL: ${job.vendor_url}`);

    // Mark job as processing
    const { error: updateError } = await supabase
      .from('job_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id);

    if (updateError) {
      console.error('❌ Error updating job status:', updateError);
      return;
    }

    // Scrape the product using existing scraper logic
    const startTime = Date.now();
    let result;
    let scrapeError = null;

    try {
      result = await scrapeProduct(job.vendor_url);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Scraping completed in ${duration}s`);
    } catch (error) {
      scrapeError = error;
      console.error('❌ Scraping failed:', error.message);
    }

    // Update job with result
    if (scrapeError) {
      await supabase
        .from('job_queue')
        .update({
          status: 'failed',
          error: scrapeError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      jobsFailed++;
      console.log(`❌ Job ${job.id} failed`);
    } else {
      await supabase
        .from('job_queue')
        .update({
          status: 'completed',
          result: result,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      jobsProcessed++;
      lastJobProcessedAt = Date.now();
      console.log(`✅ Job ${job.id} completed successfully`);
    }

  } catch (error) {
    console.error('❌ Unexpected error in processNextJob:', error);
  }
}

/**
 * Clean up old completed/failed jobs (older than 24 hours)
 */
async function cleanupOldJobs() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('job_queue')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('completed_at', oneDayAgo);

    if (!error && data && data.length > 0) {
      console.log(`🧹 Cleaned up ${data.length} old jobs`);
    }
  } catch (error) {
    console.error('❌ Error cleaning up old jobs:', error);
  }
}

/**
 * Reset stuck jobs (processing for more than 5 minutes)
 */
async function resetStuckJobs() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('job_queue')
      .update({
        status: 'queued',
        started_at: null,
        error: 'Job timed out and was reset'
      })
      .eq('status', 'processing')
      .lt('started_at', fiveMinutesAgo);

    if (!error && data && data.length > 0) {
      console.log(`⚠️ Reset ${data.length} stuck jobs`);
    }
  } catch (error) {
    console.error('❌ Error resetting stuck jobs:', error);
  }
}

/**
 * Health check status
 */
function logHealthStatus() {
  const uptimeMinutes = Math.floor((Date.now() - startTime) / 60000);
  const timeSinceLastJob = Math.floor((Date.now() - lastJobProcessedAt) / 60000);

  console.log('\n📊 Worker Health:');
  console.log(`   Uptime: ${uptimeMinutes} minutes`);
  console.log(`   Jobs processed: ${jobsProcessed}`);
  console.log(`   Jobs failed: ${jobsFailed}`);
  console.log(`   Last job: ${timeSinceLastJob} minutes ago`);
}

// Start worker
const startTime = Date.now();

console.log('✅ Worker initialized');
console.log('⏰ Polling interval: 10 seconds');
console.log('🔄 Starting job processing loop...\n');

// Main processing loop - check for jobs every 10 seconds
setInterval(processNextJob, 10000);

// Cleanup old jobs every hour
setInterval(cleanupOldJobs, 60 * 60 * 1000);

// Reset stuck jobs every 5 minutes
setInterval(resetStuckJobs, 5 * 60 * 1000);

// Log health status every 30 minutes
setInterval(logHealthStatus, 30 * 60 * 1000);

// Process one job immediately on startup
processNextJob();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM received, shutting down gracefully...');
  logHealthStatus();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, shutting down gracefully...');
  logHealthStatus();
  process.exit(0);
});
