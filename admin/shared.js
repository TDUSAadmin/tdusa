import { createClient } from '../vendor/supabase-client.js';

export function configuredClient() {
  const cfg = window.TDUSA_SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.publishableKey) throw new Error('Supabase is not configured. See the setup guide.');
  let url;
  try { url = new URL(cfg.url); } catch { throw new Error('Invalid Supabase URL.'); }
  if (url.protocol !== 'https:') throw new Error('Supabase must use HTTPS.');
  if (cfg.publishableKey.startsWith('sb_secret_')) throw new Error('Do not use a secret key in browser configuration.');
  return createClient(url.href, cfg.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
}

export async function checkAdmin(client) {
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return null;
  const { data, error } = await client.from('profiles').select('id,role').eq('id', user.id).maybeSingle();
  if (error || !data || data.role !== 'admin') return null;
  return user;
}
