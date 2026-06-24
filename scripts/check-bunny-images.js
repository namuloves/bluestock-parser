#!/usr/bin/env node

/**
 * Check Bunny CDN Storage for Images
 *
 * This script lists all images currently stored in Bunny CDN
 * to verify the migration was successful before Supabase deletion.
 */

require('dotenv').config();
const axios = require('axios');

const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || 'bluestock-assets';
const BUNNY_STORAGE_URL = `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}`;

if (!BUNNY_STORAGE_API_KEY) {
  console.error('❌ Missing BUNNY_STORAGE_API_KEY in .env file');
  process.exit(1);
}

async function listBunnyFiles(path = '') {
  try {
    const url = `${BUNNY_STORAGE_URL}/${path}`;
    console.log(`📂 Listing: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY
      }
    });

    return response.data;
  } catch (error) {
    console.error(`❌ Error listing ${path}:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return [];
  }
}

async function countFilesRecursively(path = '', depth = 0) {
  const items = await listBunnyFiles(path);
  let fileCount = 0;
  let totalSize = 0;

  const indent = '  '.repeat(depth);

  for (const item of items) {
    if (item.IsDirectory) {
      console.log(`${indent}📁 ${item.ObjectName}/`);
      const subPath = path ? `${path}/${item.ObjectName}` : item.ObjectName;
      const { files, size } = await countFilesRecursively(subPath, depth + 1);
      fileCount += files;
      totalSize += size;
    } else {
      const sizeKB = (item.Length / 1024).toFixed(2);
      console.log(`${indent}📄 ${item.ObjectName} (${sizeKB} KB)`);
      fileCount++;
      totalSize += item.Length;
    }
  }

  return { files: fileCount, size: totalSize };
}

async function main() {
  console.log('🐰 Bunny CDN Storage Checker\n');
  console.log('=' .repeat(60));
  console.log(`Storage Zone: ${BUNNY_STORAGE_ZONE}`);
  console.log('=' .repeat(60) + '\n');

  const startTime = Date.now();
  const { files, size } = await countFilesRecursively('');
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Total Files: ${files}`);
  console.log(`   Total Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Duration: ${duration}s`);
  console.log('='.repeat(60));

  if (files === 0) {
    console.log('\n⚠️  WARNING: No files found in Bunny CDN!');
    console.log('   This means the migration may not have completed.');
    console.log('   DO NOT delete Supabase storage until migration is verified!');
  } else {
    console.log('\n✅ Files found in Bunny CDN');
    console.log('   Migration appears to have occurred.');
  }
}

main().catch(console.error);
