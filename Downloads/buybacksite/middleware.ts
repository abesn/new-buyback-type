import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buybacksite.com";

// Routes that are public — no auth required
const PUBLIC_PATHS = [
  "/",           // tenant quote wizard homepage
  "/order",      // order confirmation pages
  "/api/quote",  // quote wizard API routes
  "/login",
  "/api/auth",
  "/api/feed",
  "/api/health",
  "/api/domain-check",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/sitemap-prices.xml",
  "/llms.txt",
];

// Routes that require PLATFORM_ADMIN role
const PLATFORM_ADMIN_PATHS = ["/platform"];

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get("host") ?? "";
  const cleanHost = hostname.replace(/:\d+$/, ""); // strip port

  // ─── 1. Tenant resolution ───────────────────────────────────────────────

  const isPlatform =
    cleanHost === ROOT_DOMAIN ||
    cleanHost.endsWith(`.${ROOT_DOMAIN}`) ||
    cleanHost === "localhost" ||
    cleanHost.startsWith("localhost:") ||
    cleanHost === "lvh.me" ||
    cleanHost.endsWith(".lvh.me");  // dev subdomain trick — *.lvh.me → 127.0.0.1

  const requestHeaders = new Headers(req.headers);

  if (isPlatform) {
    // Subdomain-based tenant: chicago-buyback.buybacksite.com → slug="chicago-buyback"
    const subdomain = cleanHost
      .replace(`.${ROOT_DOMAIN}`, "")
      .replace(ROOT_DOMAIN, "")
      .replace(/\.lvh\.me$/, "")   // strip lvh.me dev suffix
      .replace(/^lvh\.me$/, "");   // bare lvh.me has no subdomain

    if (subdomain && subdomain !== "www" && subdomain !== "app") {
      requestHeaders.set("x-tenant-slug", subdomain);
    }
  } else {
    // Custom domain — set hostname header, app resolves tenant from DB/cache
    requestHeaders.set("x-tenant-domain", cleanHost);
  }

  // Always pass the original host through
  requestHeaders.set("x-forwarded-host", cleanHost);

  // ─── 2. Auth guard ──────────────────────────────────────────────────────

  const path = url.pathname;

  // Skip auth check for public paths
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (!isPublic) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      // Not authenticated — redirect to login
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Platform admin routes
    const requiresPlatformAdmin = PLATFORM_ADMIN_PATHS.some(
      (p) => path === p || path.startsWith(p + "/")
    );

    if (requiresPlatformAdmin && token.role !== "PLATFORM_ADMIN") {
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  // Run on all paths except static files and images
  matcher: [
    "/((?!_next/static|_next/image|images/|icons/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js)$).*)",
  ],
};
