#!/usr/bin/env node

/**
 * Supabase Storage Cleanup Script
 *
 * This script helps clean up Supabase storage after migrating to Bunny CDN.
 * Run with: node cleanup-supabase-storage.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for admin operations

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listBuckets() {
  console.log('📦 Fetching all storage buckets...\n');

  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    console.error('❌ Error listing buckets:', error);
    return null;
  }

  console.log(`Found ${buckets.length} bucket(s):\n`);

  for (const bucket of buckets) {
    console.log(`📁 Bucket: ${bucket.name}`);
    console.log(`   ID: ${bucket.id}`);
    console.log(`   Public: ${bucket.public}`);
    console.log(`   Created: ${bucket.created_at}`);

    // Get file count and size info
    const { data: files, error: filesError } = await supabase.storage
      .from(bucket.name)
      .list('', { limit: 1000 });

    if (!filesError && files) {
      console.log(`   Files: ${files.length} files in root`);
    }
    console.log('');
  }

  return buckets;
}

async function listFilesInBucket(bucketName, path = '') {
  console.log(`\n📂 Listing files in bucket: ${bucketName} (path: ${path || '/'})`);

  const { data: files, error } = await supabase.storage
    .from(bucketName)
    .list(path, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

  if (error) {
    console.error(`❌ Error listing files:`, error);
    return [];
  }

  console.log(`Found ${files.length} items:\n`);

  let totalSize = 0;
  for (const file of files) {
    const size = file.metadata?.size || 0;
    totalSize += size;
    const sizeKB = (size / 1024).toFixed(2);
    const icon = file.id ? '📄' : '📁';
    console.log(`${icon} ${file.name} (${sizeKB} KB)`);
  }

  const totalMB = (totalSize / 1024 / 1024).toFixed(2);
  console.log(`\nTotal size: ${totalMB} MB`);

  return files;
}

async function deleteAllFilesInBucket(bucketName) {
  console.log(`\n🗑️  Deleting all files in bucket: ${bucketName}`);
  console.log('⚠️  This action cannot be undone!');

  // Get all files recursively
  const allFiles = [];

  async function listRecursive(path = '') {
    const { data: items, error } = await supabase.storage
      .from(bucketName)
      .list(path, { limit: 1000 });

    if (error) {
      console.error(`Error listing path ${path}:`, error);
      return;
    }

    for (const item of items) {
      const fullPath = path ? `${path}/${item.name}` : item.name;

      if (item.id) {
        // It's a file
        allFiles.push(fullPath);
      } else {
        // It's a folder, recurse into it
        await listRecursive(fullPath);
      }
    }
  }

  await listRecursive();

  console.log(`\nFound ${allFiles.length} files to delete`);

  if (allFiles.length === 0) {
    console.log('✅ Bucket is already empty');
    return;
  }

  // Delete in batches of 100 (Supabase limit)
  const batchSize = 100;
  let deleted = 0;

  for (let i = 0; i < allFiles.length; i += batchSize) {
    const batch = allFiles.slice(i, i + batchSize);
    console.log(`Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allFiles.length / batchSize)}...`);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .remove(batch);

    if (error) {
      console.error(`❌ Error deleting batch:`, error);
    } else {
      deleted += batch.length;
      console.log(`✅ Deleted ${deleted}/${allFiles.length} files`);
    }
  }

  console.log(`\n✅ Successfully deleted ${deleted} files from ${bucketName}`);
}

async function deleteBucket(bucketName) {
  console.log(`\n🗑️  Deleting bucket: ${bucketName}`);

  const { data, error } = await supabase.storage.deleteBucket(bucketName);

  if (error) {
    console.error(`❌ Error deleting bucket:`, error);
    return false;
  }

  console.log(`✅ Successfully deleted bucket: ${bucketName}`);
  return true;
}

async function main() {
  console.log('🧹 Supabase Storage Cleanup Tool\n');
  console.log('=' .repeat(60));

  const buckets = await listBuckets();

  if (!buckets || buckets.length === 0) {
    console.log('✅ No buckets found. Storage is already clean!');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n🔍 Choose an action:\n');
  console.log('1. List files in a specific bucket');
  console.log('2. Delete all files in a bucket (keeps the bucket)');
  console.log('3. Delete all files AND delete the bucket');
  console.log('4. Exit\n');

  const action = process.argv[2];
  const bucketName = process.argv[3];

  if (!action) {
    console.log('Usage:');
    console.log('  node cleanup-supabase-storage.js list <bucket-name>');
    console.log('  node cleanup-supabase-storage.js clear <bucket-name>');
    console.log('  node cleanup-supabase-storage.js delete <bucket-name>');
    console.log('  node cleanup-supabase-storage.js clear-all');
    return;
  }

  if (action === 'list') {
    if (!bucketName) {
      console.error('❌ Please specify a bucket name');
      return;
    }
    await listFilesInBucket(bucketName);
  } else if (action === 'clear') {
    if (!bucketName) {
      console.error('❌ Please specify a bucket name');
      return;
    }
    await deleteAllFilesInBucket(bucketName);
  } else if (action === 'delete') {
    if (!bucketName) {
      console.error('❌ Please specify a bucket name');
      return;
    }
    await deleteAllFilesInBucket(bucketName);
    await deleteBucket(bucketName);
  } else if (action === 'clear-all') {
    console.log('\n⚠️  WARNING: This will delete ALL files from ALL buckets!');
    console.log('⚠️  Buckets will remain but will be empty.');
    console.log('\nBuckets to clear:');
    buckets.forEach(b => console.log(`  - ${b.name}`));
    console.log('\nProceeding in 3 seconds... Press Ctrl+C to cancel\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    for (const bucket of buckets) {
      await deleteAllFilesInBucket(bucket.name);
    }

    console.log('\n✅ All buckets cleared!');
  } else {
    console.error('❌ Invalid action. Use: list, clear, delete, or clear-all');
  }
}

main().catch(console.error);
