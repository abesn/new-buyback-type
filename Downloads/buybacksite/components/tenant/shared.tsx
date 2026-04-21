"use client";

import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantNavbarProps {
  tenantName: string;
  activeHref?: string;
}

interface NapData {
  businessName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
}

interface TenantFooterProps {
  tenantName: string;
  nap: NapData | null;
}

// ─── Nav links ────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Devices We Buy", href: "/#devices" },
  { label: "Contact", href: "/contact" },
] as const;

// ─── SVG icons ────────────────────────────────────────────────────────────────

function FacebookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// ─── TenantNavbar ─────────────────────────────────────────────────────────────

export function TenantNavbar({ tenantName, activeHref }: TenantNavbarProps) {
  const initial = tenantName.charAt(0).toUpperCase();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Name */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-sm">{initial}</span>
            </div>
            <span className="text-white font-bold text-lg leading-none">
              {tenantName}
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={
                  activeHref === href
                    ? "text-orange-500 text-sm font-medium transition-colors"
                    : "text-gray-400 hover:text-white text-sm font-medium transition-colors"
                }
              >
                {label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <Link
            href="/quote"
            className="bg-orange-600 hover:bg-orange-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Get a Quote
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Footer helpers ───────────────────────────────────────────────────────────

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-widest text-gray-500 mb-4 font-semibold">
      {children}
    </p>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-gray-400 hover:text-white text-sm transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}

// ─── TenantFooter ─────────────────────────────────────────────────────────────

export function TenantFooter({ tenantName, nap }: TenantFooterProps) {
  const initial = tenantName.charAt(0).toUpperCase();

  return (
    <footer className="bg-black border-t border-white/10 pt-16 pb-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          {/* Column 1 — Brand / NAP (wider) */}
          <div className="md:col-span-1 lg:col-span-2 space-y-5">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 w-fit">
              <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-sm">{initial}</span>
              </div>
              <span className="text-white font-bold text-lg leading-none">
                {tenantName}
              </span>
            </Link>

            {/* Blurb */}
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              We make selling your used phone or tablet fast, fair, and
              completely hassle-free. Our prices update daily from real eBay
              sold listings so you always get a competitive offer.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              Since launching, we&apos;ve helped hundreds of sellers turn old
              devices into cash — with free prepaid shipping, same-day quotes,
              and payment in as little as 48 hours.
            </p>

            {/* NAP block */}
            {nap && (
              <address className="not-italic space-y-1">
                <p className="text-gray-400 text-sm">{nap.streetAddress}</p>
                <p className="text-gray-400 text-sm">
                  {nap.city}, {nap.state} {nap.zipCode}
                </p>
                <a
                  href={`tel:${nap.phone}`}
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  {nap.phone}
                </a>
              </address>
            )}

            {/* Social icons */}
            {nap && (nap.facebookUrl || nap.instagramUrl) && (
              <div className="flex items-center gap-2 pt-1">
                {nap.facebookUrl && (
                  <a
                    href={nap.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                    className="w-9 h-9 bg-white/5 hover:bg-orange-600 border border-white/10 rounded-lg flex items-center justify-center transition-colors text-gray-400 hover:text-white"
                  >
                    <FacebookIcon />
                  </a>
                )}
                {nap.instagramUrl && (
                  <a
                    href={nap.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="w-9 h-9 bg-white/5 hover:bg-orange-600 border border-white/10 rounded-lg flex items-center justify-center transition-colors text-gray-400 hover:text-white"
                  >
                    <InstagramIcon />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Column 2 — Company */}
          <div>
            <FooterHeading>Company</FooterHeading>
            <ul className="space-y-3">
              <FooterLink href="/about">About Us</FooterLink>
              <FooterLink href="/#how-it-works">How It Works</FooterLink>
              <FooterLink href="/#faq">FAQ</FooterLink>
              <FooterLink href="/#devices">Devices We Buy</FooterLink>
            </ul>
          </div>

          {/* Column 3 — Customer Service */}
          <div>
            <FooterHeading>Customer Service</FooterHeading>
            <ul className="space-y-3">
              <FooterLink href="/quote">Get a Quote</FooterLink>
              <FooterLink href="/track">Track My Order</FooterLink>
              <FooterLink href="/contact">Contact Us</FooterLink>
            </ul>
          </div>

          {/* Column 4 — Legal */}
          <div>
            <FooterHeading>Legal</FooterHeading>
            <ul className="space-y-3">
              <FooterLink href="/privacy">Privacy Policy</FooterLink>
              <FooterLink href="/terms">Terms of Service</FooterLink>
              <FooterLink href="/accessibility">
                Accessibility Statement
              </FooterLink>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-600">
            &copy; 2025 {tenantName}. All rights reserved.
          </p>
          <p className="text-xs text-gray-600">Powered by BuyBackSite</p>
        </div>
      </div>
    </footer>
  );
}
