"use client";

import { useState } from "react";
import Link from "next/link";
import type { CatalogCategory } from "@/app/api/quote/catalog/route";
import { TenantNavbar, TenantFooter } from "@/components/tenant/shared";

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

interface TenantHomePageProps {
  tenantId: string;
  tenantName: string;
  catalog: CatalogCategory[];
  nap: NapData | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("laptop") || lower.includes("macbook") || lower.includes("computer")) return "💻";
  if (lower.includes("tablet") || lower.includes("ipad")) return "📱";
  return "📱";
}

function totalModels(cat: CatalogCategory): number {
  return cat.brands.reduce((sum, b) => sum + b.models.length, 0);
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function HeroSection({ catalog }: { catalog: CatalogCategory[] }) {
  // Pick up to 3 real device names from the catalog for the floating price cards
  const previewCards: { label: string; storage: string; price: string }[] = [];
  const samplePrices = ["$480", "$320", "$210"];
  outer: for (const cat of catalog) {
    for (const brand of cat.brands) {
      for (const model of brand.models) {
        if (previewCards.length >= 3) break outer;
        const variant = model.variants[model.variants.length - 1]; // largest storage
        previewCards.push({
          label: `${brand.name} ${model.name}`,
          storage: variant ? `${variant.storageGb}GB` : "",
          price: samplePrices[previewCards.length],
        });
      }
    }
  }

  // Fallback cards if catalog is empty
  if (previewCards.length === 0) {
    previewCards.push(
      { label: "iPhone 15 Pro", storage: "256GB", price: "$480" },
      { label: "Samsung Galaxy S24", storage: "128GB", price: "$320" },
      { label: "Google Pixel 8", storage: "128GB", price: "$210" },
    );
  }

  return (
    <section className="min-h-screen bg-black flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 bg-orange-600/10 border border-orange-600/30 text-orange-500 text-xs font-semibold px-4 py-2 rounded-full mb-8 tracking-wide uppercase">
        ⚡ Instant Offers · Free Shipping · Fast Payment
      </div>

      {/* Headline */}
      <h1 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tight max-w-4xl mb-6">
        Turn Your Old Device<br className="hidden md:block" /> Into Cash — Today.
      </h1>

      {/* Subtitle */}
      <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
        Get an instant quote in 60 seconds. Ship free. Get paid within 2 business days.
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
        <Link
          href="/quote"
          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-lg px-8 py-4 rounded-xl transition-colors shadow-lg shadow-orange-600/20"
        >
          Get My Instant Offer →
        </Link>
        <a
          href="#how-it-works"
          className="inline-flex items-center gap-2 border border-white/20 text-gray-400 hover:text-white hover:border-white/40 font-semibold text-lg px-8 py-4 rounded-xl transition-colors"
        >
          How it works ↓
        </a>
      </div>

      {/* Trust Stats */}
      <div className="flex flex-col sm:flex-row items-center gap-8 sm:gap-16 mb-14">
        {[
          { stat: "500+", label: "Devices Bought" },
          { stat: "Free", label: "Prepaid Shipping" },
          { stat: "2-Day", label: "Payment" },
        ].map(({ stat, label }) => (
          <div key={label} className="text-center">
            <div className="text-2xl font-black text-white">{stat}</div>
            <div className="text-sm text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Floating Price Cards */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-2xl">
        {previewCards.map((card) => (
          <div
            key={card.label}
            className="flex-1 min-w-[180px] bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-left"
          >
            <div className="w-2 h-2 bg-orange-600 rounded-full mb-3" />
            <div className="text-white font-semibold text-sm leading-tight">{card.label}</div>
            {card.storage && (
              <div className="text-gray-500 text-xs mt-0.5">{card.storage}</div>
            )}
            <div className="text-orange-500 font-black text-xl mt-2">{card.price}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: "1",
      title: "Get Your Quote",
      body: "Answer a few questions about your device. Get an instant offer in under a minute.",
    },
    {
      number: "2",
      title: "Ship For Free",
      body: "We email you a prepaid shipping label. Drop it off at any USPS location.",
    },
    {
      number: "3",
      title: "Get Paid Fast",
      body: "Payment via PayPal, Zelle, Venmo, or check within 2 business days of inspection.",
    },
  ];

  return (
    <section id="how-it-works" className="bg-neutral-950 py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-orange-600 text-xs font-bold uppercase tracking-widest mb-3">
            How It Works
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-white">Three steps to get paid</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-white/5 border border-white/10 rounded-2xl p-8"
            >
              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center mb-5">
                <span className="text-white font-black text-sm">{step.number}</span>
              </div>
              <h3 className="text-white font-bold text-xl mb-3">{step.title}</h3>
              <p className="text-gray-400 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhySellSection() {
  const features = [
    {
      title: "Instant Quotes",
      body: "No waiting, no back-and-forth. Our prices update daily from real eBay sales.",
    },
    {
      title: "Free Shipping",
      body: "We generate a prepaid label the moment you accept your offer.",
    },
    {
      title: "Fastest Payment",
      body: "Most sellers receive payment within 48 hours of us receiving their device.",
    },
    {
      title: "Best Prices",
      body: "We use live market data to offer the highest fair prices in the market.",
    },
  ];

  return (
    <section className="bg-black py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-black text-white">Why sellers choose us</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white/5 border border-white/10 rounded-2xl p-7"
            >
              <h3 className="text-white font-bold text-lg mb-3">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DevicesWeBuySection({ catalog }: { catalog: CatalogCategory[] }) {
  return (
    <section className="bg-neutral-950 py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-black text-white">Devices we buy</h2>
        </div>

        {catalog.length === 0 ? (
          <p className="text-center text-gray-500">Catalog coming soon.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {catalog.map((cat) => (
              <Link
                key={cat.id}
                href={`/quote?category=${cat.id}`}
                className="group bg-white/5 border border-white/10 hover:border-orange-600 rounded-2xl p-6 text-center transition-colors"
              >
                <div className="text-4xl mb-3">{categoryEmoji(cat.name)}</div>
                <div className="text-white font-bold text-base mb-1">{cat.name}</div>
                <div className="text-gray-500 text-sm">{totalModels(cat)} models available</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const testimonials = [
    {
      quote:
        "I got a quote in less than a minute and the money was in my PayPal before my phone even finished shipping. Absolutely seamless.",
      name: "Marcus T.",
      city: "Austin, TX",
    },
    {
      quote:
        "Best price I found anywhere. I checked three other buyback sites and this one beat them all. Shipped it Monday, paid by Wednesday.",
      name: "Priya K.",
      city: "Chicago, IL",
    },
    {
      quote:
        "The prepaid label made everything so easy. I didn't have to pay a cent and the whole process took maybe 10 minutes of my time.",
      name: "Jordan R.",
      city: "Seattle, WA",
    },
  ];

  return (
    <section className="bg-black py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-black text-white">What our sellers say</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col gap-4"
            >
              <div className="text-orange-500 text-lg tracking-wide">★★★★★</div>
              <p className="text-gray-300 leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div>
                <div className="text-white font-semibold">{t.name}</div>
                <div className="text-gray-500 text-sm">{t.city}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const faqs = [
    {
      q: "How quickly will I receive my payment?",
      a: "Most sellers receive payment within 2 business days of us receiving and inspecting their device. We support PayPal, Zelle, Venmo, and check.",
    },
    {
      q: "What condition does my device need to be in?",
      a: "We accept devices in a range of conditions — fully functional, minor wear, and even cracked screens. The condition you select during the quote process determines your offer price.",
    },
    {
      q: "How do I ship my device?",
      a: "Once you accept your offer and submit your contact info, we email you a prepaid USPS shipping label within minutes. Just pack your device securely and drop it off at any USPS location — no cost to you.",
    },
    {
      q: "What if my device is worth less than quoted after inspection?",
      a: "If our inspection reveals the device is in a different condition than described, we&apos;ll send you a revised offer. You can accept the new price or we&apos;ll ship your device back to you at no charge.",
    },
    {
      q: "What payment methods do you accept?",
      a: "We pay via PayPal, Zelle, Venmo, or a mailed check — your choice. You select your preferred method during checkout.",
    },
    {
      q: "Do you buy devices with cracked screens?",
      a: "Yes! We buy devices with cracked or damaged screens. Simply select the appropriate condition during your quote and your offer will reflect the screen damage.",
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-neutral-950 py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-black text-white">Frequently asked questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left gap-4"
              >
                <span className="text-white font-semibold">{faq.q}</span>
                <span
                  className={`text-orange-500 flex-shrink-0 transition-transform duration-200 ${
                    openIndex === i ? "rotate-45" : ""
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </button>
              {openIndex === i && (
                <div className="px-6 pb-5 text-gray-400 leading-relaxed border-t border-white/10 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function TenantHomePage({ tenantId: _tenantId, tenantName, catalog, nap }: TenantHomePageProps) {
  return (
    <div className="bg-black min-h-screen">
      <TenantNavbar tenantName={tenantName} />
      <main>
        <HeroSection catalog={catalog} />
        <HowItWorksSection />
        <WhySellSection />
        <DevicesWeBuySection catalog={catalog} />
        <TestimonialsSection />
        <FaqSection />
      </main>
      <TenantFooter tenantName={tenantName} nap={nap} />
    </div>
  );
}
