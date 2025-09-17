"use client";

import React, { useEffect, useRef, useState } from "react";

type Order = {
  id: number;
  status: "waiting" | "calling";
};

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  // connect to WS server
  function connect() {
    const url = `wss://cfws.tokuzou.moe`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "subscribe" }));
    });

    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "state" && Array.isArray(msg.orders)) {
          setOrders(msg.orders);
        }
      } catch {}
    });

    ws.addEventListener("close", () => {
      setConnected(false);
      if (reconnectTimer.current == null) {
        reconnectTimer.current = window.setTimeout(() => {
          reconnectTimer.current = null;
          connect();
        }, 1000);
      }
    });

    ws.addEventListener("error", () => {
      try {
        ws.close();
      } catch {}
    });
  }

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current != null) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      try {
        wsRef.current?.close();
      } catch {}
    };
  }, []);

  function send(msg: any) {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  function addOrder() {
    send({ type: "add" });
  }

  function toggleOrder(id: number) {
    send({ type: "toggle", id });
  }

  // layout: large circular buttons (admin style)
  return (
    <div className="min-h-screen p-6 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
      <header className="max-w-6xl mx-auto mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">オーダー管理（管理画面）</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            +ボタンで新しい番号を発行。ボタンは1回押すと「呼び出し中」、もう1回で完了して削除。
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={addOrder}
            className="btn-primary rounded-lg px-5 py-3 text-lg font-semibold shadow-lg"
            aria-label="+ オーダー発行"
          >
            + 発行
          </button>
          <div className="text-sm">
            接続:
            <span className={`ml-2 font-medium ${connected ? "text-primary" : "text-red-600"}`}>
              {connected ? "接続中" : "未接続"}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <section>
          <h2 className="text-xl font-medium mb-4">オーダー一覧</h2>

          <div
            className="
              grid
              grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8
              gap-6
              items-stretch
            "
          >
            {orders.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-12 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                オーダーはありません
              </div>
            )}

            {orders.map((o) => {
              const isCalling = o.status === "calling";
              return (
                <button
                  key={o.id}
                  onClick={() => toggleOrder(o.id)}
                  className={`
                    flex flex-col items-center justify-center
                    aspect-square
                    w-full
                    rounded-xl
                    shadow-md
                    focus:outline-none focus:ring-4
                    transition
                    ${isCalling ? "btn-calling hover-bg-primary-700" : "bg-white hover:bg-slate-50 dark:bg-slate-800"}
                    ${isCalling ? "border-primary" : "border-slate-200 dark:border-slate-700"}
                    border
                  `}
                  style={{ minHeight: 160 }}
                  aria-label={isCalling ? `呼び出し中 ${o.id}` : `待機 ${o.id}`}
                >
                  <div className="text-4xl md:text-5xl font-extrabold font-mono tracking-tight">{`#${o.id}`}</div>
                  <div className={`mt-2 text-sm md:text-base ${isCalling ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>
                    {isCalling ? "呼び出し中 — 押すと完了" : "待機中 — 押すと呼び出し"}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
