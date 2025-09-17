"use client";

import React, { useEffect, useRef, useState } from "react";

type Order = {
  id: number;
  status: "waiting" | "calling";
};

export default function ViewerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  // fullscreen & audio state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function connect() {
    const url = `wss://cfws.tokuzou.moe`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
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

  const calling = orders.filter((o) => o.status === "calling");
  const waiting = orders.filter((o) => o.status === "waiting");

  // show all waiting items (no truncation). Keep it simple: render the full waiting list.

  // Track previous calling list to detect new calls
  const prevCallingRef = useRef<number[]>([]);
  useEffect(() => {
    const prev = prevCallingRef.current;
    const current = calling.map((c) => c.id);
    // detect newly added ids
    const newIds = current.filter((id) => !prev.includes(id));
    if (newIds.length > 0) {
      // play sound for each new id (staggered slightly)
      newIds.forEach((id, idx) => {
        setTimeout(() => {
          playBeep();
        }, idx * 300);
      });
      // small visual flash
      flashScreen();
    }
    prevCallingRef.current = current;
  }, [calling]);

  // Audio helpers
  function initAudio() {
    if (audioCtxRef.current) return;
    try {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctor();
      setSoundEnabled(true);
    } catch (e) {
      // Audio API not available
      setSoundEnabled(false);
    }
  }

  function playBeep() {
    if (!soundEnabled) {
      // try to init once (may be blocked until user gesture)
      try {
        initAudio();
      } catch {}
    }
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(800, now);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.8, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.7);
  }

  // visual flash when new call occurs
  const flashRef = useRef<HTMLDivElement | null>(null);
  function flashScreen() {
    const el = flashRef.current;
    if (!el) return;
    el.animate(
      [
        { opacity: 0 },
        { opacity: 0.18 },
        { opacity: 0 },
      ],
      { duration: 500, easing: "ease-out" }
    );
  }

  // Fullscreen helpers
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-slate-900 p-4 relative">
      {/* flash overlay */}
      <div
        ref={flashRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-white"
        style={{ opacity: 0 }}
      />

      <div className="w-full">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">ご注文番号</h1>
            <p className="text-sm text-slate-600 mt-1">番号が表示されたらお渡し口までお越しください</p>
          </div>

            <div className="flex items-center gap-3">
            {!isFullscreen && (
              <>
                <button
                  onClick={() => {
                    initAudio();
                  }}
                  className={`px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-900`}
                >
                  {soundEnabled ? "音声 有効" : "音声 有効化"}
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-900"
                >
                  {isFullscreen ? "フルスクリーン解除" : "フルスクリーン表示"}
                </button>
              </>
            )}
          </div>
        </header>

        <main className="flex flex-col gap-6 md:flex-row items-stretch">
          <section className="flex-1 bg-white rounded-lg p-6 flex flex-col items-center justify-center shadow">
            {calling.length > 0 ? (
              <div className="w-full text-center space-y-4">
                <div className="flex flex-wrap justify-center gap-6">
                  {calling.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col items-center justify-center bg-[#1e2670] text-black rounded-3xl shadow-xl px-8 py-6"
                      style={{ minWidth: 160 }}
                    >
                      <div className="text-6xl md:text-[6.5rem] font-extrabold font-mono leading-none text-white">{`#${c.id}`}</div>
                      <div className="mt-1 text-xl md:text-2xl text-white">お呼び出し中</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-sm text-white/80">
                  呼び出し中の番号をすべて表示しています
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-5xl md:text-7xl font-extrabold font-mono">お待ちください</div>
                <div className="mt-3 text-xl">順番にご案内します</div>
              </div>
            )}
          </section>

          <aside className="w-full md:w-1/3 bg-white rounded-lg p-4 shadow overflow-auto" style={{ minHeight: 800 }}>
            <h2 className="text-2xl font-semibold mb-4">調理中の番号</h2>
            {waiting.length === 0 ? (
              <div className="text-lg text-slate-600">調理中のオーダーはありません</div>
            ) : (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {waiting.map((o) => (
                    <div
                      key={o.id}
                      className="bg-slate-100 rounded-md p-3 text-center font-mono text-lg md:text-2xl text-slate-900"
                      aria-hidden
                    >
                      {`#${o.id}`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 text-sm text-white/70">
              注: 管理画面で番号を操作するとここに反映されます。複数同時呼び出しに対応しています。
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
