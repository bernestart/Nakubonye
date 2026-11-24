import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

let realClient = null;
// Only try to initialize if we actually have real keys
if (url && key && !url.includes('placeholder')) {
  try {
    realClient = createClient(url, key);
  } catch (e) {
    console.warn("Supabase failed to initialize, falling back to mock.", e);
  }
}

// Safe Mock Client to prevent crashes in the 145 files
const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
  },
  from: () => {
    const chain = {
      select: () => chain, insert: () => chain, update: () => chain, delete: () => chain,
      eq: () => chain, in: () => chain, or: () => chain, order: () => chain, limit: () => chain,
      single: async () => ({ data: null, error: null }),
      then: (resolve) => resolve({ data: [], error: null })
    };
    return chain;
  },
  rpc: async () => ({ data: [], error: null }),
  channel: () => ({ on: () => ({ subscribe: () => {} }) })
}

export const supabase = realClient || mockClient;

// ===== Realtime shim (added 2026-11-24) =====
// Realtime is dead (messages live in Neon + Cloudflare Durable Objects).
// These no-ops prevent crashes in ~12 files still calling supabase.channel()/.removeChannel().
// Safe: any call returns chainable noop, cleanup is noop, nothing subscribes.
try {
  const _noopChannel = {
    on: () => _noopChannel,
    subscribe: () => _noopChannel,
    unsubscribe: () => _noopChannel,
  }
  supabase.channel = () => _noopChannel
  supabase.removeChannel = () => {}
  supabase.removeAllChannels = () => {}
} catch (e) { console.warn("[supabase shim]", e) }
