import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;

  if (!url) {
    console.warn(
      "[Redis] REDIS_URL is not set — caching and sync-progress disabled. " +
        "Add a Redis service in Railway to enable them."
    );
    return null;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  return client;
}

// May be null when REDIS_URL is not configured (dev / CI)
export const redis: Redis | null =
  globalForRedis.redis !== undefined
    ? (globalForRedis.redis ?? null)
    : createRedisClient();

if (process.env.NODE_ENV !== "production") {
  (globalThis as unknown as { redis: Redis | null }).redis = redis;
}

// ─── Typed cache helpers ───────────────────────────────────────────────────────
// All helpers are no-ops when Redis is unavailable — the app stays functional,
// just without caching (each request hits the DB directly).

/** Get a cached value and parse JSON. Returns null if missing or Redis is down. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Set a JSON value with optional TTL in seconds. Silent no-op if Redis is down. */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> {
  if (!redis) return;
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

/** Delete one or more cache keys. Silent no-op if Redis is down. */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis) return;
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    console.error("[Redis] cacheDel error:", err);
  }
}

// ─── Cache key constants ───────────────────────────────────────────────────────

export const CacheKey = {
  tenantByDomain:  (domain: string)   => `tenant:domain:${domain}`,
  tenantBySlug:    (slug: string)     => `tenant:slug:${slug}`,
  feedJson:        (tenantId: string) => `feed:json:${tenantId}`,
  feedXml:         (tenantId: string) => `feed:xml:${tenantId}`,
  feedEtag:        (tenantId: string) => `feed:etag:${tenantId}`,
  marketPrice:     (variantId: string) => `market:${variantId}`,
} as const;
