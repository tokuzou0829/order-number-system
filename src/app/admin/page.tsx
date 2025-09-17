"use client";

import React, { useEffect, useState } from "react";

type Order = {
  id: number;
  status: "waiting" | "calling";
};

const API_BASE = "https://cfws.tokuzou.moe";

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchState() {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/state`, { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = await res.json();
      setOrders(json.orders || []);
    } catch (e: any) {
      setError(String(e.message || e));
    }
  }

  async function resetOrders() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/reset`, { method: "POST" });
      if (!res.ok) throw new Error(`reset failed ${res.status}`);
      await fetchState();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function addOrder() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/add`, { method: "POST" });
      if (!res.ok) throw new Error(`add failed ${res.status}`);
      await fetchState();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function toggleOrder(id: number) {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(`toggle failed ${res.status}`);
      await fetchState();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchState();
    const t = setInterval(fetchState, 1500);
    return () => clearInterval(t);
  }, []);

  const waiting = orders.filter((o) => o.status === "waiting");
  const calling = orders.filter((o) => o.status === "calling");

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">管理画面</h1>
            <p className="text-sm text-slate-600">オーダーの全リセット、一覧表示・操作</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={addOrder}
              disabled={loading}
              className="px-3 py-2 rounded bg-green-500 text-white hover:bg-green-600"
            >
              新しいオーダー追加
            </button>

            <button
              onClick={resetOrders}
              disabled={loading}
              className="px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600"
            >
              {loading ? "処理中..." : "オーダー全リセット"}
            </button>
          </div>
        </header>

        {error && <div className="mb-4 text-red-600">エラー: {error}</div>}

        <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-3">調理中 (waiting)</h2>
            {waiting.length === 0 ? (
              <div className="text-sm text-slate-500">調理中のオーダーはありません</div>
            ) : (
              <ul className="space-y-2">
                {waiting.map((o) => (
                  <li key={o.id} className="flex items-center justify-between">
                    <div className="font-mono">#{o.id}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleOrder(o.id)}
                        disabled={loading}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-sm"
                      >
                        呼び出しにする
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-3">呼び出し中 (calling)</h2>
            {calling.length === 0 ? (
              <div className="text-sm text-slate-500">呼び出し中のオーダーはありません</div>
            ) : (
              <ul className="space-y-2">
                {calling.map((o) => (
                  <li key={o.id} className="flex items-center justify-between">
                    <div className="font-mono">#{o.id}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleOrder(o.id)}
                        disabled={loading}
                        className="px-2 py-1 bg-amber-600 text-white rounded text-sm"
                      >
                        完了にする
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        <footer className="mt-6 text-sm text-slate-500">
          注: サーバーは <code>{API_BASE}</code> に接続します。開発時は ws-server を起動してください。
        </footer>
      </div>
    </div>
  );
}
