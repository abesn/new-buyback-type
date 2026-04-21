import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error(
      "REDIS_URL environment variable is not set. " +
        "Add a Redis service in Railway and copy the connection string."
    );
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    // Don't crash the process on Redis connection errors
    console.error("[Redis] Connection error:", err.message);
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// ─── Typed cache helpers ───────────────────────────────────────────────────────

/** Get a cached value and parse JSON. Returns null if missing or parse fails. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Set a JSON value with optional TTL in seconds. */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
  } catch (err) {
    console.error("[Redis] cacheSet error:", err);
  }
}

/** Delete one or more cache keys. */
export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    console.error("[Redis] cacheDel error:", err);
  }
}

// ─── Cache key constants ───────────────────────────────────────────────────────
// Centralised here so key format is consistent across the codebase.

export const CacheKey = {
  // Tenant lookup by custom domain — 1hr TTL
  tenantByDomain: (domain: string) => `tenant:domain:${domain}`,

  // Tenant lookup by slug — 1hr TTL
  tenantBySlug: (slug: string) => `tenant:slug:${slug}`,

  // Public price feed per tenant — 6hr TTL, invalidated on price sync
  feedJson: (tenantId: string) => `feed:json:${tenantId}`,
  feedXml: (tenantId: string) => `feed:xml:${tenantId}`,
  feedEtag: (tenantId: string) => `feed:etag:${tenantId}`,

  // Market prices from eBay — 6hr TTL
  marketPrice: (variantId: string) => `market:${variantId}`,
} as const;
