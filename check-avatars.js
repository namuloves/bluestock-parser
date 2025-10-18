#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Checking user avatars...\n');

  // Check if there's a users table with avatar_url
  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, avatar_url')
    .limit(10);

  if (error) {
    console.error('Error querying users table:', error.message);
    return;
  }

  if (!users || users.length === 0) {
    console.log('No users found or users table does not exist');
    return;
  }

  console.log(`Found ${users.length} users:\n`);

  for (const user of users) {
    const hasSupabaseAvatar = user.avatar_url?.includes('supabase.co');
    const status = hasSupabaseAvatar ? '📸 Supabase' : (user.avatar_url ? '✅ Other' : '❌ Missing');

    console.log(`${status} ${user.username || user.id}`);
    if (user.avatar_url) {
      console.log(`   ${user.avatar_url.substring(0, 80)}${user.avatar_url.length > 80 ? '...' : ''}`);
    }
    console.log('');
  }
})();
