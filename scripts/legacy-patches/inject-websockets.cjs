const fs = require('fs');
const file = 'backend/_worker.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Add the ChatRoom Durable Object class at the very top
const chatRoomClass = `export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.sessions = [];
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.sessions.push(server);
    server.accept();

    server.addEventListener('close', () => {
      this.sessions = this.sessions.filter(s => s !== server);
    });

    server.addEventListener('message', (event) => {
      // Broadcast message to everyone else in the room
      this.sessions.forEach(s => {
        if (s !== server) {
          try { s.send(event.data); } catch (e) {}
        }
      });
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {`;

// Replace the original export default with the new one containing the class
code = code.replace('export default {', chatRoomClass);

// 2. Add the WebSocket route inside the try block (right after MEDIA PROXY)
const wsRoute = `      // WEBSOCKET ROUTE (Real-Time Chat)
      if (path.startsWith("/api/ws/")) {
        const roomId = path.split("/api/ws/")[1];
        const id = env.CHAT_ROOMS.idFromName(roomId);
        const obj = env.CHAT_ROOMS.get(id);
        return obj.fetch(request);
      }

      // 0. MEDIA PROXY`;

code = code.replace('      // 0. MEDIA PROXY', wsRoute);

fs.writeFileSync(file, code);
console.log("✅ SUCCESS: Durable Object ChatRoom injected into backend!");
