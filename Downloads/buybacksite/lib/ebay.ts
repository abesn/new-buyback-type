/**
 * eBay Finding API client — fetches completed (sold) listings to establish
 * market prices for device variants.
 *
 * Docs: https://developer.ebay.com/devzone/finding/CallRef/findCompletedItems.html
 * Requires env var: EBAY_APP_ID (production App ID from developer.ebay.com)
 */

import { Carrier } from "@prisma/client";

const FINDING_API_URL =
  "https://svcs.ebay.com/services/search/FindingService/v1";

// eBay category IDs
const CATEGORY_SMARTPHONE = "9355";
const CATEGORY_TABLET = "171485";
const CATEGORY_LAPTOP = "175672";

export interface EbaySoldResult {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  sampleSize: number;
}

// ─── Search query builder ──────────────────────────────────────────────────────

const STORAGE_LABEL: Record<number, string> = {
  64: "64GB",
  128: "128GB",
  256: "256GB",
  512: "512GB",
  1024: "1TB",
};

const CARRIER_KEYWORD: Record<Carrier, string | null> = {
  UNLOCKED: "Unlocked",
  ATT: "AT&T",
  TMOBILE: "T-Mobile",
  VERIZON: "Verizon",
  SPRINT: "Sprint",
  OTHER: null,
};

/**
 * Build an eBay search query for a device variant.
 * Uses unlocked query for carrier-locked variants to get a reliable baseline
 * (carrier-locked devices are too sparsely listed to average cleanly).
 */
export function buildEbayQuery(
  modelName: string,
  storageGb: number,
  carrier: Carrier,
  categorySlug: "smartphone" | "tablet" | "laptop"
): { keywords: string; categoryId: string } {
  const storage = STORAGE_LABEL[storageGb] ?? `${storageGb}GB`;
  const carrierLabel = carrier === Carrier.UNLOCKED ? "Unlocked" : "Unlocked"; // normalise: use unlocked as baseline
  const keywords = `${modelName} ${storage} ${carrierLabel}`.trim();

  const categoryId =
    categorySlug === "tablet"
      ? CATEGORY_TABLET
      : categorySlug === "laptop"
      ? CATEGORY_LAPTOP
      : CATEGORY_SMARTPHONE;

  return { keywords, categoryId };
}

// ─── eBay Finding API call ─────────────────────────────────────────────────────

interface FindingApiItem {
  sellingStatus?: Array<{
    currentPrice?: Array<{ _?: string; __value__?: string }>;
  }>;
  condition?: Array<{ conditionId?: string[] }>;
}

interface FindingApiResponse {
  findCompletedItemsResponse?: Array<{
    ack?: string[];
    searchResult?: Array<{
      item?: FindingApiItem[];
    }>;
  }>;
}

/**
 * Fetch recent sold eBay listings and return aggregate pricing.
 * Returns null if the API is not configured or returns an error.
 */
export async function fetchEbaySoldPrices(
  keywords: string,
  categoryId: string
): Promise<EbaySoldResult | null> {
  const appId = process.env.EBAY_APP_ID;
  if (!appId) {
    console.warn("[eBay] EBAY_APP_ID not set — using mock prices");
    return mockEbayPrice(keywords);
  }

  const params = new URLSearchParams({
    "OPERATION-NAME": "findCompletedItems",
    "SERVICE-VERSION": "1.0.0",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "",
    keywords,
    categoryId,
    "itemFilter(0).name": "SoldItemsOnly",
    "itemFilter(0).value": "true",
    "itemFilter(1).name": "Condition",
    "itemFilter(1).value": "3000", // Used
    "itemFilter(2).name": "ListingType",
    "itemFilter(2).value": "FixedPrice",
    "sortOrder": "EndTimeSoonest",
    "paginationInput.entriesPerPage": "50",
  });

  try {
    const res = await fetch(`${FINDING_API_URL}?${params.toString()}`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`[eBay] HTTP ${res.status} for query: ${keywords}`);
      return null;
    }

    const data = (await res.json()) as FindingApiResponse;
    const response = data.findCompletedItemsResponse?.[0];

    if (!response || response.ack?.[0] !== "Success") {
      console.warn("[eBay] Non-success ack for:", keywords);
      return null;
    }

    const items = response.searchResult?.[0]?.item ?? [];
    if (items.length === 0) return null;

    const prices: number[] = items
      .map((item) => {
        const raw = item.sellingStatus?.[0]?.currentPrice?.[0];
        const val = raw?._ ?? raw?.__value__;
        return val ? parseFloat(val) : null;
      })
      .filter((p): p is number => p !== null && p > 10 && p < 10_000);

    if (prices.length === 0) return null;

    const sorted = [...prices].sort((a, b) => a - b);
    // Trim outliers: drop top/bottom 10%
    const trimCount = Math.floor(sorted.length * 0.1);
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
    const used = trimmed.length > 0 ? trimmed : sorted;

    const avg = used.reduce((s, p) => s + p, 0) / used.length;

    return {
      avgPrice: Math.round(avg * 100) / 100,
      minPrice: Math.round(used[0] * 100) / 100,
      maxPrice: Math.round(used[used.length - 1] * 100) / 100,
      sampleSize: prices.length,
    };
  } catch (err) {
    console.error("[eBay] Fetch error:", err);
    return null;
  }
}

// ─── Mock prices for development (when EBAY_APP_ID is not set) ────────────────

const MOCK_BASE_PRICES: Record<string, number> = {
  "iPhone 16 Pro Max": 1050,
  "iPhone 16 Pro": 920,
  "iPhone 16 Plus": 820,
  "iPhone 16": 730,
  "iPhone 15 Pro Max": 880,
  "iPhone 15 Pro": 750,
  "iPhone 15 Plus": 650,
  "iPhone 15": 570,
  "iPhone 14 Pro Max": 710,
  "iPhone 14 Pro": 620,
  "iPhone 14 Plus": 530,
  "iPhone 14": 470,
  "iPhone 13 Pro Max": 580,
  "iPhone 13 Pro": 510,
  "iPhone 13": 390,
  "iPhone 13 Mini": 340,
  "iPhone 12 Pro Max": 430,
  "iPhone 12 Pro": 380,
  "iPhone 12": 300,
  "iPhone 12 Mini": 260,
  "iPhone 11 Pro Max": 310,
  "iPhone 11 Pro": 270,
  "iPhone 11": 220,
  "iPhone SE (3rd Gen)": 180,
  "iPhone SE (2nd Gen)": 120,
  "Galaxy S25 Ultra": 1000,
  "Galaxy S25 Plus": 820,
  "Galaxy S25": 680,
  "Galaxy S24 Ultra": 850,
  "Galaxy S24 Plus": 700,
  "Galaxy S24": 580,
  "Galaxy S24 FE": 430,
  "Galaxy S23 Ultra": 680,
  "Galaxy S23 Plus": 560,
  "Galaxy S23": 440,
  "Galaxy Z Fold 6": 1200,
  "Galaxy Z Fold 5": 980,
  "Galaxy Z Flip 6": 650,
  "Galaxy Z Flip 5": 520,
  "Galaxy A55": 280,
  "Galaxy A35": 220,
  "Pixel 9 Pro XL": 870,
  "Pixel 9 Pro": 780,
  "Pixel 9 Pro Fold": 1050,
  "Pixel 9": 620,
  "Pixel 8 Pro": 640,
  "Pixel 8": 480,
  "Pixel 7 Pro": 510,
  "Pixel 7": 380,
};

function mockEbayPrice(keywords: string): EbaySoldResult {
  // Find the matching model name in keywords
  let base = 400; // fallback
  for (const [model, price] of Object.entries(MOCK_BASE_PRICES)) {
    if (keywords.toLowerCase().includes(model.toLowerCase())) {
      base = price;
      break;
    }
  }

  // Storage adjustment
  const storageMatch = keywords.match(/(\d+)GB|1TB/);
  let storageMultiplier = 1.0;
  if (storageMatch) {
    const gb = storageMatch[0] === "1TB" ? 1024 : parseInt(storageMatch[1]);
    if (gb <= 64) storageMultiplier = 0.85;
    else if (gb === 128) storageMultiplier = 1.0;
    else if (gb === 256) storageMultiplier = 1.12;
    else if (gb === 512) storageMultiplier = 1.22;
    else if (gb >= 1024) storageMultiplier = 1.35;
  }

  const adjusted = base * storageMultiplier;
  // Add ±5% noise to simulate real market variance
  const noise = (Math.random() * 0.1 - 0.05) * adjusted;
  const avg = Math.round((adjusted + noise) * 100) / 100;

  return {
    avgPrice: avg,
    minPrice: Math.round(avg * 0.88 * 100) / 100,
    maxPrice: Math.round(avg * 1.12 * 100) / 100,
    sampleSize: Math.floor(Math.random() * 30) + 15,
  };
}
