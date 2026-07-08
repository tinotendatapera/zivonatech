import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import WebSocket from 'ws';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  transport: WebSocket,
});

async function run() {
  const now = new Date().toISOString();
  const testUserId = '11111111-1111-4111-8111-111111111111';
  const targetUserId = '22222222-2222-4222-8222-222222222222';

  await supabase.from('profiles').upsert({ id: testUserId, username: 'verify-user-a', full_name: 'Verify User A' }, { onConflict: 'id' });
  await supabase.from('profiles').upsert({ id: targetUserId, username: 'verify-user-b', full_name: 'Verify User B' }, { onConflict: 'id' });

  await supabase.from('follows').delete().or(`follower_id.eq.${testUserId},followed_id.eq.${targetUserId}`);
  await supabase.from('user_blocks').delete().or(`blocker_id.eq.${testUserId},blocked_user_id.eq.${targetUserId}`);
  await supabase.from('notifications').delete().eq('user_id', targetUserId);
  await supabase.from('stories').delete().eq('user_id', testUserId);

  const { data: followData, error: followError } = await supabase.from('follows').insert({ follower_id: testUserId, followed_id: targetUserId }).select().single();
  console.log('follow_create', followError ? followError.message : 'ok', followData?.id ?? null);

  const { count: followerCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', targetUserId);
  const { count: followingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', testUserId);
  console.log('follow_counts', followerCount, followingCount);

  const { data: blockData, error: blockError } = await supabase.from('user_blocks').insert({ blocker_id: testUserId, blocked_user_id: targetUserId }).select().single();
  console.log('block_create', blockError ? blockError.message : 'ok', blockData?.id ?? null);

  const { data: blockedRows } = await supabase.from('user_blocks').select('id').or(`blocker_id.eq.${testUserId},blocked_user_id.eq.${targetUserId}`);
  console.log('block_lookup', blockedRows?.length ?? 0);

  const { data: storyData, error: storyError } = await supabase.from('stories').insert({ user_id: testUserId, content: 'verify-story', media_url: null, expires_at: new Date(Date.now() + 60 * 1000).toISOString() }).select().single();
  console.log('story_create', storyError ? storyError.message : 'ok', storyData?.id ?? null);

  const { data: storyRows } = await supabase.from('stories').select('id').gt('expires_at', now);
  console.log('story_visible', storyRows?.length ?? 0);

  await supabase.from('two_factor_secrets').upsert({ user_id: testUserId, secret: '1234567890abcdef', enabled: false, recovery_codes: ['abc'], created_at: now }, { onConflict: 'user_id' });
  const { data: twoFactorData } = await supabase.from('two_factor_secrets').select('recovery_codes').eq('user_id', testUserId).maybeSingle();
  console.log('2fa_recovery_column', twoFactorData?.recovery_codes ?? null);

  const { data: notifications } = await supabase.from('notifications').select('id').eq('user_id', targetUserId);
  console.log('notifications_created', notifications?.length ?? 0);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
