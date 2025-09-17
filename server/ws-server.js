/**
 * Simple WebSocket order server
 *
 * Protocol (JSON messages):
 * - { type: "subscribe" }            => server replies with { type: "state", orders: [...] }
 * - { type: "add" }                  => server creates new order { id, status: "waiting" } and broadcasts state
 * - { type: "toggle", id: number }   => server toggles order:
 *       waiting -> calling
 *       calling -> removed (completed)
 *   then broadcasts state
 *
 * Run: node server/ws-server.js
 * Note: requires `ws` package (npm/yarn/pnpm add ws)
 */

const WebSocket = require("ws");

const PORT = 4000;
const wss = new WebSocket.Server({ port: PORT });

let orders = [];
let nextId = 1;

function broadcastState() {
  const msg = JSON.stringify({ type: "state", orders });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

wss.on("connection", (ws) => {
  // send current state on connect
  ws.send(JSON.stringify({ type: "state", orders }));

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (!msg || typeof msg.type !== "string") return;

      if (msg.type === "subscribe") {
        ws.send(JSON.stringify({ type: "state", orders }));
      } else if (msg.type === "add") {
        const order = { id: nextId++, status: "waiting" };
        orders.push(order);
        broadcastState();
      } else if (msg.type === "toggle" && typeof msg.id === "number") {
        const idx = orders.findIndex((o) => o.id === msg.id);
        if (idx === -1) return;
        const o = orders[idx];
        if (o.status === "waiting") {
          o.status = "calling";
        } else {
          // calling -> complete -> remove
          orders.splice(idx, 1);
        }
        broadcastState();
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  ws.on("close", () => {
    // no-op
  });
});

console.log(`WebSocket server listening on ws://0.0.0.0:${PORT}`);
