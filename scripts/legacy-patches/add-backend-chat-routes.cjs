const fs = require('fs');
const file = 'backend/_worker.js';
let code = fs.readFileSync(file, 'utf8');

// We will inject the new routes right before the "COMMUNITY MESSAGES (CHAT)" route
const target = `      // 5. COMMUNITY MESSAGES (CHAT)`;

const newRoutes = `      // 4.5 DIRECT MESSAGES (DM)
      if (path === "/api/messages" && request.method === "POST") {
        const body = await request.json();
        const insertQuery = \`
          INSERT INTO messages (conversation_id, sender_id, content, media_url, media_type, media_name, reply_to_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        \`;
        const data = await queryDatabase(insertQuery, [
          body.conversation_id, body.sender_id, body.content, body.media_url, body.media_type, body.media_name, body.reply_to_id
        ]);
        
        const newMsg = data.rows[0];
        // Broadcast to DM WebSocket
        try {
          const id = env.CHAT_ROOMS.idFromName("dm-" + body.conversation_id);
          const obj = env.CHAT_ROOMS.get(id);
          await obj.fetch("https://dummy.com/", { method: "POST", body: JSON.stringify(newMsg) });
        } catch (e) { console.error(e); }

        return new Response(JSON.stringify({ success: true, data: newMsg }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 4.6 GROUP MESSAGES
      if (path === "/api/group/messages" && request.method === "POST") {
        const body = await request.json();
        const insertQuery = \`
          INSERT INTO group_messages (group_id, sender_id, content, media_url, media_type, media_name, reply_to_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        \`;
        const data = await queryDatabase(insertQuery, [
          body.group_id, body.sender_id, body.content, body.media_url, body.media_type, body.media_name, body.reply_to_id
        ]);
        
        const newMsg = data.rows[0];
        // Broadcast to Group WebSocket
        try {
          const id = env.CHAT_ROOMS.idFromName("group-" + body.group_id);
          const obj = env.CHAT_ROOMS.get(id);
          await obj.fetch("https://dummy.com/", { method: "POST", body: JSON.stringify(newMsg) });
        } catch (e) { console.error(e); }

        return new Response(JSON.stringify({ success: true, data: newMsg }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 5. COMMUNITY MESSAGES (CHAT)`;

if (code.includes(target)) {
  code = code.replace(target, newRoutes);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Backend routes for DM and Group added!");
} else {
  console.log("⚠️ Could not find the exact injection point in _worker.js");
}
