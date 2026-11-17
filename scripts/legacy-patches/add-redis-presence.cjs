const fs = require('fs');
const file = 'backend/_worker.js';
let code = fs.readFileSync(file, 'utf8');

// Inject the Redis Helper right below the DB helper
const dbHelperRegex = /async function queryDatabase[\s\S]*?return await res\.json\(\);\s*\}/;
const redisHelper = `

    async function redisCommand(commandArray) {
      try {
        const res = await fetch(env.UPSTASH_REDIS_URL, {
          method: 'POST',
          headers: { Authorization: \`Bearer \${env.UPSTASH_REDIS_TOKEN}\`, 'Content-Type': 'application/json' },
          body: JSON.stringify(commandArray)
        });
        return await res.json();
      } catch (e) { return { error: e.message }; }
    }`;

if (!code.includes('redisCommand')) {
  code = code.replace(dbHelperRegex, (match) => match + redisHelper);
}

// Inject Presence and Typing routes before MEDIA PROXY
const target = `      // 0. MEDIA PROXY`;
const newRoutes = `      // ONLINE PRESENCE (Redis)
      if (path === "/api/presence" && request.method === "POST") {
        const body = await request.json();
        if (body.isOnline) {
          await redisCommand(["SET", \`online:\${body.userId}\`, "true", "EX", 300]); 
        } else {
          await redisCommand(["DEL", \`online:\${body.userId}\`]);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // TYPING INDICATOR (Redis)
      if (path === "/api/typing" && request.method === "POST") {
        const body = await request.json();
        if (body.isTyping) {
          await redisCommand(["SET", \`typing:\${body.roomId}:\${body.userId}\`, "true", "EX", 3]);
        } else {
          await redisCommand(["DEL", \`typing:\${body.roomId}:\${body.userId}\`]);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 0. MEDIA PROXY`;

if (!code.includes('/api/presence')) {
  code = code.replace(target, newRoutes);
}

fs.writeFileSync(file, code);
console.log("✅ SUCCESS: Presence and Typing routes added to Cloudflare Worker!");
