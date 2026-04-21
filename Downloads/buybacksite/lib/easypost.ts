/**
 * Shared EasyPost helper.
 * Used by:
 *  - app/api/quote/order/route.ts  — generate label at order creation time
 *  - app/api/orders/[id]/label/route.ts — admin re-generate label
 */

export interface EasyPostAddress {
  name: string;
  street1: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export interface LabelResult {
  labelUrl: string;
  trackingNumber: string;
  carrier: string;
  mock?: boolean;
}

interface EasyPostRate {
  id: string;
  carrier: string;
  service: string;
  rate: string;
  delivery_days: number | null;
}

interface EasyPostShipment {
  id: string;
  rates: EasyPostRate[];
  postage_label?: { label_url: string };
  tracking_code?: string;
  selected_rate?: EasyPostRate;
}

async function epFetch<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const apiKey = process.env.EASYPOST_API_KEY;
  if (!apiKey) throw new Error("EASYPOST_API_KEY is not configured");

  const res = await fetch(`https://api.easypost.com/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? `EasyPost error ${res.status}`
    );
  }

  return res.json() as Promise<T>;
}

async function createEpAddress(addr: EasyPostAddress) {
  return epFetch<{ id: string }>("/addresses", "POST", {
    address: { ...addr, country: addr.country ?? "US" },
  });
}

/**
 * Generate a prepaid return label FROM the seller TO the shop.
 * Returns a mock label when EASYPOST_API_KEY is not set.
 */
export async function generateShippingLabel(
  from: EasyPostAddress,
  to: EasyPostAddress
): Promise<LabelResult> {
  // ── Mock mode (no API key) ────────────────────────────────────────────────
  if (!process.env.EASYPOST_API_KEY) {
    return {
      labelUrl: "https://easypost.com/mock-label.pdf",
      trackingNumber: `MOCK${Date.now().toString(36).toUpperCase()}`,
      carrier: "USPS (mock)",
      mock: true,
    };
  }

  // ── Live mode ─────────────────────────────────────────────────────────────
  const [fromAddr, toAddr] = await Promise.all([
    createEpAddress(from),
    createEpAddress(to),
  ]);

  const shipment = await epFetch<EasyPostShipment>("/shipments", "POST", {
    shipment: {
      from_address: { id: fromAddr.id },
      to_address:   { id: toAddr.id },
      parcel: { length: 6, width: 3, height: 1, weight: 8 }, // standard phone box (oz)
    },
  });

  const rates = shipment.rates ?? [];
  const uspsRates = rates.filter((r) => r.carrier === "USPS");
  const sorted = (uspsRates.length ? uspsRates : rates).sort(
    (a, b) => parseFloat(a.rate) - parseFloat(b.rate)
  );
  const cheapest = sorted[0];
  if (!cheapest) throw new Error("No shipping rates available for this address");

  const bought = await epFetch<EasyPostShipment>(
    `/shipments/${shipment.id}/buy`,
    "POST",
    { rate: { id: cheapest.id } }
  );

  return {
    labelUrl:       bought.postage_label?.label_url ?? "",
    trackingNumber: bought.tracking_code ?? "",
    carrier:        bought.selected_rate?.carrier ?? cheapest.carrier,
  };
}
