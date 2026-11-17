const fs = require('fs');
const file = 'backend/_worker.js';
let code = fs.readFileSync(file, 'utf8');

const target = `      // 0. MEDIA PROXY`;
const newRoute = `      // BULK PRESENCE API (Privacy-Aware)
      if (path === "/api/presence/bulk" && request.method === "GET") {
        const viewerId = url.searchParams.get("viewerId");
        const idsParam = url.searchParams.get("userIds");
        if (!viewerId || !idsParam) return new Response(JSON.stringify({ success: false, error: "viewerId and userIds required" }), { status: 400, headers: cors });

        const userIds = idsParam.split(',');
        
        // 1. Fetch Privacy Settings and Last Seen from Neon
        const placeholders = userIds.map((_, i) => \`$\${i + 1}\`).join(',');
        const settingsQuery = \`
          SELECT p.id, p.hide_online_status, p.last_seen_at, s.who_can_see_online
          FROM profiles p
          LEFT JOIN user_settings s ON s.user_id = p.id
          WHERE p.id IN (\${placeholders})
        \`;
        const settingsRes = await queryDatabase(settingsQuery, userIds);
        
        // 2. Fetch Online Status from Redis in Bulk (MGET)
        const redisKeys = userIds.map(id => \`online:\${id}\`);
        const redisRes = await redisCommand(["MGET", ...redisKeys]);
        const redisStatuses = redisRes.result || [];

        // 3. Combine and enforce Privacy
        const result = {};
        userIds.forEach((id, index) => {
          const dbRow = settingsRes.rows.find(r => r.id === id) || {};
          const isOnlineInRedis = redisStatuses[index] === "true";
          
          let canSee = true;
          if (dbRow.hide_online_status) canSee = false;
          if (dbRow.who_can_see_online === 'nobody') canSee = false;
          // Note: 'matches' logic can be added later by checking the matches table

          if (canSee) {
            result[id] = { is_online: isOnlineInRedis, last_seen_at: dbRow.last_seen_at };
          } else {
            result[id] = { is_online: false, last_seen_at: null }; // Hidden
          }
        });

        return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 0. MEDIA PROXY`;

if (!code.includes('/api/presence/bulk')) {
  code = code.replace(target, newRoute);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Bulk Presence API with Privacy Rules added!");
} else {
  console.log("ℹ️ Bulk Presence API already exists.");
}
