"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";

type OrderStatus = "waiting" | "calling" | "completed";

type Order = {
  id: number;
  status: OrderStatus;
  createdAt: string;
  providedAt: string | null;
  completedAt: string | null;
  providedInSeconds: number | null;
};

const statusLabels: Record<OrderStatus, string> = {
  waiting: "調理中",
  calling: "呼び出し中",
  completed: "完了",
};

const statusClasses: Record<OrderStatus, string> = {
  waiting: "bg-slate-100 text-slate-700",
  calling: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}分${remainder}秒`;
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [stateResponse, historyResponse] = await Promise.all([
        fetch(`${API_BASE}/state`, { cache: "no-store" }),
        fetch(`${API_BASE}/history`, { cache: "no-store" }),
      ]);
      if (!stateResponse.ok) throw new Error(`state: ${stateResponse.status}`);
      if (!historyResponse.ok) throw new Error(`history: ${historyResponse.status}`);

      const [stateJson, historyJson] = await Promise.all([
        stateResponse.json(),
        historyResponse.json(),
      ]);
      setOrders(stateJson.orders || []);
      setHistory(historyJson.orders || []);
    } catch (error: unknown) {
      setError(errorMessage(error));
    }
  }, []);

  async function resetOrders() {
    if (!window.confirm("稼働中のオーダーと全履歴をリセットしますか？")) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/reset`, { method: "POST" });
      if (!response.ok) throw new Error(`reset failed: ${response.status}`);
      await fetchData();
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function addOrder() {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/add`, { method: "POST" });
      if (!response.ok) throw new Error(`add failed: ${response.status}`);
      await fetchData();
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function toggleOrder(id: number) {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error(`toggle failed: ${response.status}`);
      await fetchData();
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const timer = window.setInterval(fetchData, 1500);
    return () => window.clearInterval(timer);
  }, [fetchData]);

  const waiting = orders.filter((order) => order.status === "waiting");
  const calling = orders.filter((order) => order.status === "calling");
  const provided = history.filter((order) => order.providedInSeconds !== null);
  const averageSeconds = useMemo(() => {
    if (provided.length === 0) return null;
    return Math.round(
      provided.reduce((sum, order) => sum + (order.providedInSeconds ?? 0), 0) /
        provided.length,
    );
  }, [provided]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">管理画面</h1>
            <p className="text-sm text-slate-600">オーダー操作・提供時間・全履歴</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={addOrder}
              disabled={loading}
              className="rounded bg-green-600 px-3 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              新しいオーダー追加
            </button>
            <button
              onClick={resetOrders}
              disabled={loading}
              className="rounded bg-red-600 px-3 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "処理中..." : "オーダー・履歴を全リセット"}
            </button>
          </div>
        </header>

        {error && <div className="mb-4 rounded bg-red-50 p-3 text-red-700">エラー: {error}</div>}

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">発行数</div>
            <div className="mt-1 text-3xl font-bold">{history.length}</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">提供済み</div>
            <div className="mt-1 text-3xl font-bold">{provided.length}</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">平均提供時間</div>
            <div className="mt-1 text-3xl font-bold">{formatDuration(averageSeconds)}</div>
          </div>
        </section>

        <main className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <OrderSection
            title="調理中"
            emptyText="調理中のオーダーはありません"
            orders={waiting}
            buttonLabel="提供・呼び出しにする"
            buttonClass="bg-blue-600 hover:bg-blue-700"
            loading={loading}
            onToggle={toggleOrder}
          />
          <OrderSection
            title="呼び出し中"
            emptyText="呼び出し中のオーダーはありません"
            orders={calling}
            buttonLabel="完了にする"
            buttonClass="bg-amber-600 hover:bg-amber-700"
            loading={loading}
            onToggle={toggleOrder}
          />
        </main>

        <section className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold">オーダー履歴</h2>
            <p className="mt-1 text-sm text-slate-500">全リセットを実行するまでサーバーに保存されます</p>
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">履歴はありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3">番号</th>
                    <th className="px-4 py-3">状態</th>
                    <th className="px-4 py-3">発行時刻</th>
                    <th className="px-4 py-3">提供時刻</th>
                    <th className="px-4 py-3">提供まで</th>
                    <th className="px-4 py-3">完了時刻</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-semibold">#{order.id}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClasses[order.status]}`}>
                          {statusLabels[order.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatTimestamp(order.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatTimestamp(order.providedAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatDuration(order.providedInSeconds)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatTimestamp(order.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-6 text-sm text-slate-500">
          サーバー: <code>{API_BASE}</code>
        </footer>
      </div>
    </div>
  );
}

function OrderSection({
  title,
  emptyText,
  orders,
  buttonLabel,
  buttonClass,
  loading,
  onToggle,
}: {
  title: string;
  emptyText: string;
  orders: Order[];
  buttonLabel: string;
  buttonClass: string;
  loading: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {orders.length === 0 ? (
        <div className="text-sm text-slate-500">{emptyText}</div>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-3 rounded border border-slate-100 p-2">
              <div>
                <div className="font-mono font-semibold">#{order.id}</div>
                <div className="text-xs text-slate-500">発行 {formatTimestamp(order.createdAt)}</div>
              </div>
              <button
                onClick={() => onToggle(order.id)}
                disabled={loading}
                className={`rounded px-3 py-2 text-sm text-white disabled:opacity-50 ${buttonClass}`}
              >
                {buttonLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
