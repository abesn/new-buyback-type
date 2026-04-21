"use client";

import { useState, useEffect, useCallback } from "react";
import type { SyncStatus } from "@/lib/pricing";

interface Props {
  initialStatus: SyncStatus;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
      <div
        className="h-full bg-blue-500 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SyncPanel({ initialStatus }: Props) {
  const [status, setStatus] = useState<SyncStatus>(initialStatus);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/prices");
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);

  // Poll while running
  useEffect(() => {
    if (!status.running) return;
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [status.running, poll]);

  const handleSync = async () => {
    setTriggering(true);
    setError("");
    try {
      const res = await fetch("/api/sync/prices", { method: "POST", body: JSON.stringify({}) });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to start sync");
      }
      await poll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTriggering(false);
    }
  };

  const pct =
    status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold text-gray-900">Market Price Sync</h2>
            {status.running && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Running
              </span>
            )}
            {!status.running && status.finishedAt && (
              <span className="text-xs text-gray-400">
                Last sync {new Date(status.finishedAt).toLocaleString()}
              </span>
            )}
          </div>

          {status.running && (
            <div className="space-y-1.5">
              <ProgressBar value={status.done} max={status.total} />
              <p className="text-xs text-gray-500">
                {status.done} / {status.total} variants ({pct}%)
                {status.errors > 0 && (
                  <span className="text-red-500 ml-2">{status.errors} errors</span>
                )}
              </p>
            </div>
          )}

          {!status.running && !status.finishedAt && (
            <p className="text-xs text-gray-400">Never synced. Run to populate market prices.</p>
          )}

          {!status.running && status.finishedAt && (
            <p className="text-xs text-gray-500">
              {status.done} variants synced
              {status.errors > 0 && (
                <span className="text-red-500 ml-2">· {status.errors} errors</span>
              )}
            </p>
          )}

          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          {status.lastError && !status.running && (
            <p className="text-xs text-red-500 mt-1 truncate">Last error: {status.lastError}</p>
          )}
        </div>

        <button
          onClick={handleSync}
          disabled={status.running || triggering}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <svg className={`w-4 h-4 ${status.running ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {status.running ? "Syncing..." : "Sync Now"}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
        Fetches recent sold eBay listings for all active device variants and recalculates buyback prices for all tenants.
        Set <code className="font-mono bg-gray-100 px-1 rounded">EBAY_APP_ID</code> in your environment to use live data; otherwise mock prices are used.
      </div>
    </div>
  );
}
