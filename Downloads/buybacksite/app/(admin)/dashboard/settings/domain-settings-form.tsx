"use client";

import { useState } from "react";
import { DomainStatus } from "@prisma/client";

interface Props {
  tenantId: string;
  initial: { customDomain: string; domainStatus: DomainStatus } | null;
  subdomain: string;
}

const statusColors: Record<DomainStatus, string> = {
  PENDING: "text-gray-500",
  VERIFYING: "text-yellow-600",
  ACTIVE: "text-green-600",
  ERROR: "text-red-600",
};

export function DomainSettingsForm({ tenantId, initial, subdomain }: Props) {
  const [customDomain, setCustomDomain] = useState(initial?.customDomain ?? "");
  const [status, setStatus] = useState<DomainStatus>(initial?.domainStatus ?? DomainStatus.PENDING);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/settings/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, customDomain }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setStatus(data.domainStatus);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1">Default subdomain</p>
        <p className="text-sm font-mono text-blue-600">{subdomain}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Custom Domain <span className="text-gray-400">(optional)</span></label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
            placeholder="chicagophonebuyback.com"
          />
          {customDomain && (
            <p className={`text-xs mt-1 font-medium ${statusColors[status]}`}>
              Status: {status.charAt(0) + status.slice(1).toLowerCase()}
            </p>
          )}
        </div>

        {customDomain && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 space-y-1">
            <p className="font-medium">DNS setup required:</p>
            <p>Add a CNAME record: <code className="bg-amber-100 px-1 rounded">@ → proxy.{process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buybacksite.com"}</code></p>
            <p>Changes can take up to 24h to propagate.</p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving..." : "Save Domain"}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </form>
    </div>
  );
}
