/**
 * WebSocket order server with simple HTTP control endpoints
 *
 * WebSocket protocol (JSON messages) retained:
 * - { type: "subscribe" }            => server replies with { type: "state", orders: [...] }
 * - { type: "add" }                  => server creates new order { id, status: "waiting" } and broadcasts state
 * - { type: "toggle", id: number }   => server toggles order:
 *       waiting -> calling
 *       calling -> removed (completed)
 *   then broadcasts state
 *
 * HTTP endpoints (port 4000):
 * - GET  /state      => { orders: [...] }
 * - POST /reset      => resets orders to empty, returns { ok: true }
 * - POST /add        => creates a new order, returns created order
 * - POST /toggle     => body { id } toggles same as WS toggle
 *
 * CORS: simple wildcard allowed for browser admin UI usage.
 *
 * Run: node server/ws-server.js
 * Note: requires `ws` package (npm/yarn/pnpm add ws)
 */

const http = require("http");
const WebSocket = require("ws");

const PORT = 4000;

let orders = [];
let nextId = 1;

function broadcastState(wss) {
  const msg = JSON.stringify({ type: "state", orders });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// HTTP server to provide simple control endpoints for admin UI
const server = http.createServer((req, res) => {
  // basic CORS headers for browser usage
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/state") {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ orders }));
    return;
  }

  if (req.method === "POST" && req.url === "/reset") {
    orders = [];
    nextId = 1;
    // broadcast new empty state after reset
    broadcastState(wss);
    res.writeHead(200, headers);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/add") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const order = { id: nextId++, status: "waiting" };
      orders.push(order);
      broadcastState(wss);
      res.writeHead(200, headers);
      res.end(JSON.stringify(order));
    });
    return;
  }

  if (req.method === "POST" && req.url === "/toggle") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const id = Number(parsed && parsed.id);
        const idx = orders.findIndex((o) => o.id === id);
        if (idx === -1) {
          res.writeHead(404, headers);
          res.end(JSON.stringify({ error: "not found" }));
          return;
        }
        const o = orders[idx];
        if (o.status === "waiting") {
          o.status = "calling";
        } else {
          // calling -> complete -> remove
          orders.splice(idx, 1);
        }
        broadcastState(wss);
        res.writeHead(200, headers);
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, headers);
        res.end(JSON.stringify({ error: "invalid body" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

// attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

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
        broadcastState(wss);
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
        broadcastState(wss);
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  ws.on("close", () => {
    // no-op
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT} (WebSocket on same port)`);
});
