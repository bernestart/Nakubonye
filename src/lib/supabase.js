// ==============================================================================
// SUPABASE BLACK HOLE (Temporary bridge during T1 -> T2 migration)
// Any call made here silently returns empty data instead of crashing the app.
// ==============================================================================
const fakeResponse = { data: [], error: null, count: 0 };
const makeChain = () => {
  const handler = {
    get: (target, prop) => {
      if (prop === 'getPublicUrl') return () => ({ data: { publicUrl: '' } });
      if (prop === 'then') return (resolve) => resolve(fakeResponse);
      if (prop === 'subscribe' || prop === 'on' || prop === 'unsubscribe') return () => proxy;
      if (prop === 'removeChannel' || prop === 'removeAllChannels') return () => {};
      if (prop === 'data') return [];
      if (prop === 'error') return null;
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
