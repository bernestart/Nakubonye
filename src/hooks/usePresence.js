import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// Hook to broadcast your own presence
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

    // Initial ping
    pingOnline();
    
    // Heartbeat every 60 seconds (Redis key expires in 300s)
    const interval = setInterval(pingOnline, 60000);

    // When app goes to background or closes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') pingOffline();
      else pingOnline();
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      pingOffline();
    };
  }, [userId]);
}

// Hook to fetch presence for a list of users (Bulk)
export function useBulkPresence(viewerId, userIds) {
  const [presenceMap, setPresenceMap] = useState({});

  useEffect(() => {
    if (!viewerId || !userIds || userIds.length === 0) return;

    const fetchPresence = async () => {
      try {
        const idsString = userIds.join(',');
        const res = await fetch(`https://nakubonye.bernestart.workers.dev/api/presence/bulk?viewerId=${viewerId}&userIds=${idsString}`);
        const json = await res.json();
        if (json.success) setPresenceMap(json.data);
      } catch (e) { console.error("Bulk presence failed", e); }
    };

    fetchPresence();
    // Refresh presence every 30 seconds while viewing
    const interval = setInterval(fetchPresence, 30000);
    return () => clearInterval(interval);
  }, [viewerId, userIds.join(',')]);

  return presenceMap;
}
