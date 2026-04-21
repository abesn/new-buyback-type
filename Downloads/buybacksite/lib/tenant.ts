import { db } from "./db";
import { redis, CacheKey, cacheSet, cacheGet } from "./redis";
import type { Tenant, NapSettings, DomainSettings } from "@prisma/client";

export type TenantWithSettings = Tenant & {
  napSettings: NapSettings | null;
  domainSettings: DomainSettings | null;
};

// ─── Resolution ───────────────────────────────────────────────────────────────

/**
 * Resolve a tenant from a custom domain (e.g. "chicagophonebuyback.com").
 * Result is cached in Redis for 1 hour.
 * Returns null if the domain is not registered or the domain is not ACTIVE.
 */
export async function getTenantByDomain(
  domain: string
): Promise<{ id: string; slug: string } | null> {
  const cacheKey = CacheKey.tenantByDomain(domain);

  // Try cache first
  const cached = await cacheGet<{ id: string; slug: string }>(cacheKey);
  if (cached) return cached;

  // DB lookup
  const domainSettings = await db.domainSettings.findFirst({
    where: { customDomain: domain, domainStatus: "ACTIVE" },
    select: {
      tenantId: true,
      tenant: { select: { id: true, slug: true, status: true } },
    },
  });

  if (!domainSettings || domainSettings.tenant.status === "CANCELLED") {
    return null;
  }

  const result = {
    id: domainSettings.tenant.id,
    slug: domainSettings.tenant.slug,
  };

  // Cache for 1 hour
  await cacheSet(cacheKey, result, 3600);

  return result;
}

/**
 * Resolve a tenant from a slug (e.g. "chicago-phone-buyback").
 * Used when a client is on their platform subdomain.
 */
export async function getTenantBySlug(
  slug: string
): Promise<{ id: string; slug: string } | null> {
  const cacheKey = CacheKey.tenantBySlug(slug);

  const cached = await cacheGet<{ id: string; slug: string }>(cacheKey);
  if (cached) return cached;

  const tenant = await db.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true },
  });

  if (!tenant || tenant.status === "CANCELLED") return null;

  const result = { id: tenant.id, slug: tenant.slug };
  await cacheSet(cacheKey, result, 3600);

  return result;
}

/**
 * Get full tenant data including settings.
 * Used in server components and API routes that need NAP/domain data.
 */
export async function getTenantWithSettings(
  tenantId: string
): Promise<TenantWithSettings | null> {
  return db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      napSettings: true,
      domainSettings: true,
    },
  });
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

/**
 * Call this whenever a tenant updates their custom domain.
 * Clears both old and new domain from cache.
 */
export async function invalidateTenantDomainCache(
  oldDomain: string | null | undefined,
  newDomain: string | null | undefined,
  slug: string
): Promise<void> {
  const keysToDelete: string[] = [CacheKey.tenantBySlug(slug)];

  if (oldDomain) keysToDelete.push(CacheKey.tenantByDomain(oldDomain));
  if (newDomain) keysToDelete.push(CacheKey.tenantByDomain(newDomain));

  if (keysToDelete.length > 0) {
    await redis.del(...keysToDelete);
  }
}

// ─── Helpers for public pages ─────────────────────────────────────────────────

/** Platform domain check — is this host a buybacksite.com subdomain? */
export function isPlatformDomain(host: string, platformDomain: string): boolean {
  const clean = host.replace(/:\d+$/, "");
  return (
    clean === platformDomain ||
    clean.endsWith(`.${platformDomain}`) ||
    clean === "localhost" ||
    clean.startsWith("localhost:")
  );
}

/** Extract tenant slug from a platform subdomain. */
export function extractSlugFromHost(host: string, platformDomain: string): string | null {
  const clean = host.replace(/:\d+$/, "");
  if (!clean.endsWith(`.${platformDomain}`)) return null;
  const slug = clean.replace(`.${platformDomain}`, "");
  return slug || null;
}

/** Get the canonical base URL for a tenant (custom domain or platform subdomain). */
export function getTenantBaseUrl(
  slug: string,
  customDomain?: string | null
): string {
  if (customDomain) return `https://${customDomain}`;
  return `https://${slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`;
}
