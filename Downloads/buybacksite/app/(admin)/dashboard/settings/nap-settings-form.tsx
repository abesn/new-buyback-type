"use client";

import { useState } from "react";

interface NapData {
  businessName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  serviceArea: string;
  googleMapsUrl: string;
}

interface Props {
  tenantId: string;
  initial: NapData | null;
}

export function NapSettingsForm({ tenantId, initial }: Props) {
  const [form, setForm] = useState<NapData>(
    initial ?? { businessName: "", streetAddress: "", city: "", state: "", zipCode: "", phone: "", serviceArea: "", googleMapsUrl: "" }
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof NapData, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/settings/nap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, ...form }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof NapData, placeholder?: string, optional?: boolean) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {optional && <span className="text-gray-400">(optional)</span>}
      </label>
      <input
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        required={!optional}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      {field("Business Name", "businessName", "Chicago Phone Buyback")}
      {field("Street Address", "streetAddress", "123 N Michigan Ave")}
      <div className="grid grid-cols-3 gap-3">
        {field("City", "city", "Chicago")}
        {field("State", "state", "IL")}
        {field("ZIP", "zipCode", "60601")}
      </div>
      {field("Phone", "phone", "(312) 555-0100")}
      {field("Service Area", "serviceArea", "Chicago metro, Cook County", true)}
      {field("Google Maps URL", "googleMapsUrl", "https://maps.google.com/?q=...", true)}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? "Saving..." : "Save Business Info"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </form>
  );
}
