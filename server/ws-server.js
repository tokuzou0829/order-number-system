/**
 * WebSocket order server with JSON-file persistence.
 *
 * An order stays in the log from creation until an admin reset. Active orders
 * (waiting/calling) are broadcast to the operation and customer screens, while
 * completed orders remain available from GET /history.
 */

const fs = require("fs");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT) || 4000;
const DATA_FILE = process.env.ORDER_DATA_FILE
  ? path.resolve(process.env.ORDER_DATA_FILE)
  : path.join(__dirname, "data", "orders.json");

const emptyStore = () => ({ version: 1, nextId: 1, orders: [] });

function loadStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!Array.isArray(parsed.orders)) throw new Error("orders must be an array");

    const maxId = parsed.orders.reduce(
      (max, order) => Math.max(max, Number(order.id) || 0),
      0,
    );

    return {
      version: 1,
      nextId: Math.max(Number(parsed.nextId) || 1, maxId + 1),
      orders: parsed.orders,
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`Could not load ${DATA_FILE}; starting with an empty log.`, error);
    }
    return emptyStore();
  }
}

let store = loadStore();

function saveStore() {
  const directory = path.dirname(DATA_FILE);
  const temporaryFile = `${DATA_FILE}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporaryFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryFile, DATA_FILE);
}

function activeOrders() {
  return store.orders.filter(
    (order) => order.status === "waiting" || order.status === "calling",
  );
}

function publicHistory() {
  return [...store.orders].sort((a, b) => b.id - a.id);
}

function createOrder() {
  const order = {
    id: store.nextId++,
    status: "waiting",
    createdAt: new Date().toISOString(),
    providedAt: null,
    completedAt: null,
    providedInSeconds: null,
  };
  store.orders.push(order);
  saveStore();
  return order;
}

function toggleOrder(id) {
  const order = store.orders.find(
    (candidate) => candidate.id === id && candidate.status !== "completed",
  );
  if (!order) return null;

  const now = new Date();
  if (order.status === "waiting") {
    order.status = "calling";
    order.providedAt = now.toISOString();
    order.providedInSeconds = Math.max(
      0,
      Math.round((now.getTime() - new Date(order.createdAt).getTime()) / 1000),
    );
  } else {
    order.status = "completed";
    order.completedAt = now.toISOString();
  }
  saveStore();
  return order;
}

function broadcastState(wss) {
  const message = JSON.stringify({ type: "state", orders: activeOrders() });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

function jsonResponse(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
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
    jsonResponse(res, 200, headers, { orders: activeOrders() });
    return;
  }

  if (req.method === "GET" && req.url === "/history") {
    jsonResponse(res, 200, headers, { orders: publicHistory() });
    return;
  }

  if (req.method === "POST" && req.url === "/reset") {
    try {
      store = emptyStore();
      saveStore();
      broadcastState(wss);
      jsonResponse(res, 200, headers, { ok: true });
    } catch (error) {
      console.error("Failed to reset order log", error);
      jsonResponse(res, 500, headers, { error: "failed to save order log" });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/add") {
    try {
      const order = createOrder();
      broadcastState(wss);
      jsonResponse(res, 200, headers, order);
    } catch (error) {
      console.error("Failed to create order", error);
      jsonResponse(res, 500, headers, { error: "failed to save order" });
    }
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
        const order = toggleOrder(Number(parsed.id));
        if (!order) {
          jsonResponse(res, 404, headers, { error: "not found" });
          return;
        }
        broadcastState(wss);
        jsonResponse(res, 200, headers, { ok: true, order });
      } catch (error) {
        console.error("Failed to update order", error);
        jsonResponse(res, 400, headers, { error: "invalid body or save failed" });
      }
    });
    return;
  }

  jsonResponse(res, 404, headers, { error: "not found" });
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "state", orders: activeOrders() }));

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (!message || typeof message.type !== "string") return;

      if (message.type === "subscribe") {
        ws.send(JSON.stringify({ type: "state", orders: activeOrders() }));
      } else if (message.type === "add") {
        createOrder();
        broadcastState(wss);
      } else if (message.type === "toggle" && typeof message.id === "number") {
        if (toggleOrder(message.id)) broadcastState(wss);
      }
    } catch (error) {
      console.error("Failed to handle WebSocket message", error);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT} (WebSocket on same port)`);
  console.log(`Order log: ${DATA_FILE}`);
});
