import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buybacksite.com";

// ─── App-domain paths that require authentication ─────────────────────────────
// (Only enforced on app.buybacksite.com)

const PUBLIC_APP_PATHS = [
  "/login",
  "/api/auth",
  "/api/health",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
];

const PLATFORM_ADMIN_PATHS = ["/platform"];

// ─── Hostname classifier ───────────────────────────────────────────────────────

function classifyHost(host: string): "marketing" | "app" | "tenant" | "custom" {
  // Root / marketing domain
  if (
    host === ROOT_DOMAIN ||
    host === `www.${ROOT_DOMAIN}` ||
    host === "lvh.me"           // bare lvh.me = marketing in dev
  ) {
    return "marketing";
  }

  // App domain  (app.buybacksite.com  |  app.lvh.me  |  localhost)
  if (
    host === `app.${ROOT_DOMAIN}` ||
    host === "app.lvh.me" ||
    host === "localhost" ||
    host.startsWith("localhost:")
  ) {
    return "app";
  }

  // Tenant subdomain  (slug.buybacksite.com  |  slug.lvh.me)
  if (host.endsWith(`.${ROOT_DOMAIN}`) || host.endsWith(".lvh.me")) {
    return "tenant";
  }

  // Everything else = custom domain pointing at a tenant store
  return "custom";
}

function extractTenantSlug(host: string): string {
  return host
    .replace(`.${ROOT_DOMAIN}`, "")
    .replace(/\.lvh\.me$/, "");
}

// ─── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  // Prefer x-forwarded-host (set by Cloudflare proxy) over host so that
  // tenant subdomain routing works correctly behind any reverse proxy.
  // Fall back to host for direct connections (local dev, health checks).
  const rawHost =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const hostname = rawHost.split(",")[0].trim(); // take first value if comma-list
  const cleanHost = hostname.replace(/:\d+$/, ""); // strip port
  const path = url.pathname;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-forwarded-host", cleanHost);

  const hostType = classifyHost(cleanHost);

  // ── Marketing site (buybacksite.com) ────────────────────────────────────────
  if (hostType === "marketing") {
    // API paths pass through as-is (handles /api/auth, feed, health, etc.)
    if (path.startsWith("/api/")) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    // Rewrite everything else to /saas/* internal prefix
    url.pathname = `/saas${path === "/" ? "" : path}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // ── Tenant storefront (slug.buybacksite.com or custom domain) ───────────────
  if (hostType === "tenant") {
    requestHeaders.set("x-tenant-slug", extractTenantSlug(cleanHost));
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (hostType === "custom") {
    requestHeaders.set("x-tenant-domain", cleanHost);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── App domain (app.buybacksite.com / localhost) — apply auth guard ─────────
  const isPublic = PUBLIC_APP_PATHS.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (!isPublic) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    if (
      PLATFORM_ADMIN_PATHS.some((p) => path === p || path.startsWith(p + "/")) &&
      token.role !== "PLATFORM_ADMIN"
    ) {
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images/|icons/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js)$).*)",
  ],
};
