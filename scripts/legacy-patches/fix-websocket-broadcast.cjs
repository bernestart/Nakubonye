const fs = require('fs');
const file = 'backend/_worker.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Update ChatRoom to handle POST broadcasts
const oldChatRoom = `export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.sessions = [];
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }`;

const newChatRoom = `export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.sessions = [];
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    
    // If it's a POST, it's a broadcast from the API
    if (request.method === 'POST' && upgradeHeader !== 'websocket') {
      const message = await request.text();
      this.sessions.forEach(s => {
        try { s.send(message); } catch (e) {}
      });
      return new Response("Broadcasted", { status: 200 });
    }

    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }`;

if (code.includes(oldChatRoom)) {
  code = code.replace(oldChatRoom, newChatRoom);
  console.log("✅ Updated ChatRoom to handle broadcasts");
}

// 2. Update the POST route to trigger the broadcast
const oldInsert = `          const data = await queryDatabase(insertQuery, [
            body.communityId, body.senderId, body.content, body.mediaUrl, body.mediaType, body.mediaName, body.voiceDuration
          ]);
          return new Response(JSON.stringify({ success: true, data: data.rows[0] }), { headers: { ...cors, "Content-Type": "application/json" } });`;

const newInsert = `          const data = await queryDatabase(insertQuery, [
            body.communityId, body.senderId, body.content, body.mediaUrl, body.mediaType, body.mediaName, body.voiceDuration
          ]);
          
          const newMessage = data.rows[0];
          newMessage.display_name = "User"; // Placeholder, you can join profiles later
          
          // META-SCALE: Broadcast to WebSocket Room
          try {
            const roomId = body.communityId.toString();
            const id = env.CHAT_ROOMS.idFromName(roomId);
            const obj = env.CHAT_ROOMS.get(id);
            await obj.fetch("https://dummy.com/", {
              method: "POST",
              body: JSON.stringify(newMessage)
            });
          } catch (wsErr) {
            console.error("Broadcast failed", wsErr);
          }

          return new Response(JSON.stringify({ success: true, data: newMessage }), { headers: { ...cors, "Content-Type": "application/json" } });`;

if (code.includes(oldInsert)) {
  code = code.replace(oldInsert, newInsert);
  console.log("✅ Updated POST route to broadcast messages");
} else {
  console.log("⚠️ Could not find exact POST route. It might already be patched or have different spacing.");
}

fs.writeFileSync(file, code);
