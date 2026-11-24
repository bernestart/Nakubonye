// ==============================================================================
// SUPABASE BLACK HOLE (Temporary bridge during T1 -> T2 migration)
// Any call made here silently returns empty data instead of crashing the app.
// Do NOT use this for T1 screens (Feed, Chat, Messages, ProfileView).
// ==============================================================================

const fakeResponse = { data: [], error: null, count: 0 };

const makeChain = () => {
  const handler = {
    get: (target, prop) => {
      // 1. Handle Storage URLs
      if (prop === 'getPublicUrl') return () => ({ data: { publicUrl: '' } });
      
      // 2. Handle Promise/Await resolution
      if (prop === 'then') return (resolve) => resolve(fakeResponse);
      
      // 3. Handle Supabase channel/removeChannel
      if (prop === 'subscribe' || prop === 'on' || prop === 'unsubscribe') return () => proxy;
      if (prop === 'removeChannel' || prop === 'removeAllChannels') return () => {};

      // 4. Handle `.data` access if someone does `const { data } = await supabase...`
      if (prop === 'data') return [];
      if (prop === 'error') return null;

      // 5. Any other function (.from, .select, .eq, .is, .update, etc) returns the chain
      return () => proxy;
    }
  };
  
  const proxy = new Proxy(function() {}, handler);
  return proxy;
};

const globalProxy = makeChain();

export const supabase = {
  from: () => globalProxy,
  rpc: () => globalProxy,
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
  channel: () => globalProxy,
  removeChannel: () => {},
  removeAllChannels: () => {},
  storage: { from: () => globalProxy }
};
