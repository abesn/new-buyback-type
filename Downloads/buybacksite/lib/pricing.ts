/**
 * Pricing Engine
 *
 * Responsibilities:
 * 1. syncMarketPrices()  — fetch eBay sold data for all active variants, write to MarketPrice + PriceHistory
 * 2. computeBuybackPrices() — for each tenant, apply margin rules + condition multipliers → BuybackPrice
 * 3. getEffectiveMargin()   — walk the rule hierarchy (MODEL > BRAND > CATEGORY > GLOBAL)
 */

import { db } from "./db";
import { cacheGet, cacheSet, cacheDel, CacheKey } from "./redis";
import { buildEbayQuery, fetchEbaySoldPrices } from "./ebay";
import { PricingRuleScope } from "@prisma/client";
import type { Carrier } from "@prisma/client";

// ─── Redis keys for sync state ─────────────────────────────────────────────────

const SYNC_STATUS_KEY = "sync:status";
const SYNC_PROGRESS_KEY = "sync:progress";
const SYNC_LOCK_KEY = "sync:lock";
const SYNC_LOCK_TTL = 1800; // 30 min — prevents overlapping runs

export interface SyncStatus {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  total: number;
  done: number;
  errors: number;
  lastError: string | null;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const status = await cacheGet<SyncStatus>(SYNC_STATUS_KEY);
  return (
    status ?? {
      running: false,
      startedAt: null,
      finishedAt: null,
      total: 0,
      done: 0,
      errors: 0,
      lastError: null,
    }
  );
}

// ─── Market Price Sync ─────────────────────────────────────────────────────────

interface VariantForSync {
  id: string;
  storageGb: number;
  carrier: Carrier;
  model: {
    name: string;
    brand: {
      category: { slug: string };
    };
  };
}

/**
 * Fetch eBay sold prices for all active variants and update the MarketPrice table.
 * Designed to run as a background job — safe to call without awaiting.
 *
 * Uses a Redis lock to prevent concurrent runs.
 * Emits progress to Redis so the admin UI can poll it.
 */
export async function syncMarketPrices(variantIds?: string[]): Promise<void> {
  // Acquire lock
  const { redis } = await import("./redis");
  const locked = await redis.set(SYNC_LOCK_KEY, "1", "EX", SYNC_LOCK_TTL, "NX");
  if (!locked) {
    console.log("[pricing] Sync already running, skipping");
    return;
  }

  const variants = await db.deviceVariant.findMany({
    where: {
      active: true,
      ...(variantIds ? { id: { in: variantIds } } : {}),
    },
    include: {
      model: {
        include: {
          brand: {
            include: { category: true },
          },
        },
      },
    },
  });

  const total = variants.length;
  let done = 0;
  let errors = 0;
  let lastError: string | null = null;

  await cacheSet(SYNC_STATUS_KEY, {
    running: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    total,
    done,
    errors,
    lastError,
  } satisfies SyncStatus);

  // Batch into groups of 5 to avoid hammering eBay
  const BATCH = 5;
  const DELAY_MS = 1000;

  for (let i = 0; i < variants.length; i += BATCH) {
    const batch = variants.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (variant: VariantForSync) => {
        try {
          const { keywords, categoryId } = buildEbayQuery(
            variant.model.name,
            variant.storageGb,
            variant.carrier,
            variant.model.brand.category.slug as "smartphone" | "tablet" | "laptop"
          );

          const result = await fetchEbaySoldPrices(keywords, categoryId);
          if (!result) {
            errors++;
            return;
          }

          await db.marketPrice.upsert({
            where: { variantId: variant.id },
            update: {
              avgSalePrice: result.avgPrice,
              minSalePrice: result.minPrice,
              maxSalePrice: result.maxPrice,
              sampleSize: result.sampleSize,
              fetchedAt: new Date(),
            },
            create: {
              variantId: variant.id,
              avgSalePrice: result.avgPrice,
              minSalePrice: result.minPrice,
              maxSalePrice: result.maxPrice,
              sampleSize: result.sampleSize,
              source: "ebay",
            },
          });

          // Invalidate market price cache
          await cacheDel(CacheKey.marketPrice(variant.id));
        } catch (err) {
          errors++;
          lastError = err instanceof Error ? err.message : String(err);
          console.error(`[pricing] Error syncing variant ${variant.id}:`, err);
        }
        done++;
      })
    );

    // Update progress in Redis
    await cacheSet(
      SYNC_STATUS_KEY,
      {
        running: true,
        startedAt: (await getSyncStatus()).startedAt,
        finishedAt: null,
        total,
        done,
        errors,
        lastError,
      } satisfies SyncStatus,
      SYNC_LOCK_TTL
    );

    // Throttle between batches (skip for last batch)
    if (i + BATCH < variants.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // Release lock and write final status
  await redis.del(SYNC_LOCK_KEY);
  await cacheSet(
    SYNC_STATUS_KEY,
    {
      running: false,
      startedAt: (await getSyncStatus()).startedAt,
      finishedAt: new Date().toISOString(),
      total,
      done,
      errors,
      lastError,
    } satisfies SyncStatus,
    86400 // keep for 24h
  );

  // After market prices are updated, recompute buyback prices for all tenants
  await computeAllTenantPrices();
}

// ─── Pricing Rule Resolution ───────────────────────────────────────────────────

interface RuleKey {
  tenantId: string;
  modelId: string;
  brandId: string;
  categoryId: string;
}

/**
 * Walk the rule hierarchy (MODEL > BRAND > CATEGORY > GLOBAL) and return
 * the most specific margin percentage for this tenant + device.
 */
export async function getEffectiveMargin({
  tenantId,
  modelId,
  brandId,
  categoryId,
}: RuleKey): Promise<number> {
  const rules = await db.pricingRule.findMany({
    where: {
      tenantId,
      OR: [
        { scope: PricingRuleScope.GLOBAL },
        { scope: PricingRuleScope.CATEGORY, scopeId: categoryId },
        { scope: PricingRuleScope.BRAND, scopeId: brandId },
        { scope: PricingRuleScope.MODEL, scopeId: modelId },
      ],
    },
  });

  // Priority: MODEL > BRAND > CATEGORY > GLOBAL
  const priority = {
    [PricingRuleScope.MODEL]: 4,
    [PricingRuleScope.BRAND]: 3,
    [PricingRuleScope.CATEGORY]: 2,
    [PricingRuleScope.GLOBAL]: 1,
  };

  const best = rules.sort(
    (a, b) => (priority[b.scope] ?? 0) - (priority[a.scope] ?? 0)
  )[0];

  return best?.marginPercent ?? 0.65;
}

// ─── Carrier price adjustment ──────────────────────────────────────────────────

const CARRIER_MULTIPLIER: Record<Carrier, number> = {
  UNLOCKED: 1.0,
  ATT: 0.93,
  TMOBILE: 0.93,
  VERIZON: 0.93,
  SPRINT: 0.88,
  OTHER: 0.88,
};

// ─── Buyback Price Computation ─────────────────────────────────────────────────

/**
 * Compute and upsert all BuybackPrice rows for a single tenant.
 * Only processes variants that have a MarketPrice entry.
 */
export async function computeBuybackPrices(tenantId: string): Promise<number> {
  const [variants, conditions, tenant] = await Promise.all([
    db.deviceVariant.findMany({
      where: { active: true },
      include: {
        marketPrice: true,
        model: {
          include: {
            brand: { include: { category: true } },
          },
        },
      },
    }),
    db.deviceCondition.findMany({ orderBy: { sortOrder: "asc" } }),
    db.tenant.findUnique({ where: { id: tenantId } }),
  ]);

  if (!tenant) return 0;

  // Get tenant device settings (disabled models)
  const tenantSettings = await db.tenantDeviceSettings.findMany({
    where: { tenantId, active: false },
    select: { modelId: true },
  });
  const disabledModelIds = new Set(tenantSettings.map((s) => s.modelId));

  let written = 0;

  for (const variant of variants) {
    if (!variant.marketPrice) continue;
    if (disabledModelIds.has(variant.model.id)) continue;

    const margin = await getEffectiveMargin({
      tenantId,
      modelId: variant.model.id,
      brandId: variant.model.brandId,
      categoryId: variant.model.brand.categoryId,
    });

    const carrierMultiplier = CARRIER_MULTIPLIER[variant.carrier];
    const marketValue =
      Number(variant.marketPrice.avgSalePrice) * carrierMultiplier;

    for (const condition of conditions) {
      const buyPrice =
        Math.round(marketValue * margin * condition.multiplier * 100) / 100;

      await db.buybackPrice.upsert({
        where: {
          tenantId_variantId_conditionId: {
            tenantId,
            variantId: variant.id,
            conditionId: condition.id,
          },
        },
        update: {
          buyPrice,
          marketValue,
          marginPercent: margin,
        },
        create: {
          tenantId,
          variantId: variant.id,
          conditionId: condition.id,
          buyPrice,
          marketValue,
          marginPercent: margin,
        },
      });

      // Write to price history for audit
      await db.priceHistory.create({
        data: {
          tenantId,
          variantId: variant.id,
          conditionId: condition.id,
          buyPrice,
          marketValue,
        },
      });

      written++;
    }
  }

  // Invalidate price feed cache for this tenant
  await cacheDel(CacheKey.feedJson(tenantId), CacheKey.feedXml(tenantId), CacheKey.feedEtag(tenantId));

  return written;
}

/**
 * Recompute buyback prices for ALL active tenants after a market sync.
 */
export async function computeAllTenantPrices(): Promise<void> {
  const tenants = await db.tenant.findMany({
    where: { status: { in: ["TRIAL", "ACTIVE"] } },
    select: { id: true },
  });

  for (const tenant of tenants) {
    await computeBuybackPrices(tenant.id);
  }
}

// ─── Quick price lookup (used in quote wizard) ─────────────────────────────────

export interface QuotePrice {
  conditionGrade: string;
  conditionLabel: string;
  buyPrice: number;
  marketValue: number;
}

/**
 * Get all condition prices for a specific tenant + variant.
 * Cached in Redis for 6 hours.
 */
export async function getVariantPrices(
  tenantId: string,
  variantId: string
): Promise<QuotePrice[]> {
  const cacheKey = `prices:${tenantId}:${variantId}`;
  const cached = await cacheGet<QuotePrice[]>(cacheKey);
  if (cached) return cached;

  const prices = await db.buybackPrice.findMany({
    where: { tenantId, variantId },
    include: { condition: true },
    orderBy: { condition: { sortOrder: "asc" } },
  });

  const result: QuotePrice[] = prices.map((p) => ({
    conditionGrade: p.condition.grade,
    conditionLabel: p.condition.label,
    buyPrice: Number(p.buyPrice),
    marketValue: Number(p.marketValue),
  }));

  await cacheSet(cacheKey, result, 21600); // 6h
  return result;
}
