require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function checkJobStatus(jobId) {
  console.log(`🔍 Checking status for job: ${jobId}\n`);

  const { data, error } = await supabase
    .from('scrape_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    console.error('❌ Error fetching job:', error.message);
    return;
  }

  if (!data) {
    console.log('❌ Job not found');
    return;
  }

  console.log('📊 Job Status:');
  console.log('  ID:', data.id);
  console.log('  Status:', data.status);
  console.log('  URL:', data.url);
  console.log('  Created:', data.created_at);
  console.log('  Updated:', data.updated_at);
  console.log('  Attempts:', data.attempts);
  console.log('  Error:', data.error);
  console.log('\n📦 Result:', data.result ? JSON.stringify(data.result, null, 2) : 'null');
}

const jobId = process.argv[2] || '97afe79c-50b6-4039-8656-4372b936bedf';
checkJobStatus(jobId);
