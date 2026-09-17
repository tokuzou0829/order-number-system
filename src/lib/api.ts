const DEFAULT_API_BASE = "http://localhost:4000";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || DEFAULT_API_BASE
).replace(/\/$/, "");

export const WS_BASE = API_BASE.replace(/^http:/, "ws:").replace(
  /^https:/,
  "wss:",
);
