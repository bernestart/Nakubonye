import { useEffect, useState } from 'react';

// Hook to broadcast your own presence (Heartbeat)
export function useMyPresence(userId) {
  useEffect(() => {
    if (!userId) return;

    const pingOnline = async () => {
      try {
        await fetch("https://nakubonye.bernestart.workers.dev/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, isOnline: true })
        });
      } catch (e) { console.error("Presence ping failed", e); }
    };

    const pingOffline = async () => {
      try {
        await fetch("https://nakubonye.bernestart.workers.dev/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, isOnline: false })
        });
      } catch (e) {}
    };

    pingOnline();
    const interval = setInterval(pingOnline, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') pingOffline();
      else pingOnline();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      pingOffline();
    };
  }, [userId]);
}

// ---------------------------------------------------------
// GLOBAL PRESENCE BATCHER (Meta-Scale)
// ---------------------------------------------------------
const presenceStore = {
  cache: {},
  listeners: new Set(),
  addListener(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  notify() { this.listeners.forEach(fn => fn(this.cache)); },
  set(id, data) { this.cache[id] = { ...data, _ts: Date.now() }; this.notify(); }
};

let fetchQueue = new Set();
let fetchTimeout = null;
let currentMyId = null;

function queueFetch(userId, myId) {
  currentMyId = myId;
  // If we have cache < 30s old, skip
  if (presenceStore.cache[userId] && Date.now() - presenceStore.cache[userId]._ts < 30000) return;
  
  fetchQueue.add(userId);
  
  if (fetchTimeout) return;
  
  // Batch requests for 150ms to gather all avatars on screen
  fetchTimeout = setTimeout(async () => {
    const ids = Array.from(fetchQueue);
    fetchQueue.clear();
    fetchTimeout = null;
    if (ids.length === 0 || !currentMyId) return;
    
    try {
      const idsString = ids.join(',');
      const res = await fetch(`https://nakubonye.bernestart.workers.dev/api/presence/bulk?viewerId=${currentMyId}&userIds=${idsString}`);
      const json = await res.json();
      if (json.success) {
        Object.entries(json.data).forEach(([id, data]) => presenceStore.set(id, data));
      }
    } catch (e) { console.error("Bulk presence fetch failed", e); }
  }, 150); 
}

// Hook to fetch presence for a single user via the global batcher
export function usePresence(userId, myId) {
  const [data, setData] = useState(presenceStore.cache[userId] || null);

  useEffect(() => {
    if (!userId || !myId) return;
    
    queueFetch(userId, myId);
    
    const unsub = presenceStore.addListener((cache) => {
      if (cache[userId]) setData(cache[userId]);
    });
    
    return unsub;
  }, [userId, myId]);

  return data;
}
