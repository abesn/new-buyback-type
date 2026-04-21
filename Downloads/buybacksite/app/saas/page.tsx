"use client";

import { useState } from "react";
import Link from "next/link";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.buybacksite.com";
const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@buybacksite.com";
const SALES_EMAIL =
  process.env.NEXT_PUBLIC_SALES_EMAIL ?? "sales@buybacksite.com";
const HELLO_EMAIL =
  process.env.NEXT_PUBLIC_HELLO_EMAIL ?? "hello@buybacksite.com";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function MarketingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-white font-black text-lg tracking-tight">BuyBackSite</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Features", href: "#features" },
              { label: "How It Works", href: "#how-it-works" },
              { label: "Pricing", href: "#pricing" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`${APP_URL}/login`}
              className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              Sign in
            </a>
            <a
              href={"/register"}
              className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Start Free Trial
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="min-h-screen bg-black flex flex-col items-center justify-center px-4 pt-24 pb-20 text-center">
      <div className="inline-flex items-center gap-2 bg-orange-600/10 border border-orange-600/30 text-orange-400 text-xs font-semibold px-4 py-2 rounded-full mb-8 tracking-wide uppercase">
        ⚡ The white-label device buyback platform
      </div>

      <h1 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tight max-w-5xl mb-6">
        Launch Your Own<br className="hidden md:block" />
        <span className="text-orange-500"> Device Buyback</span><br className="hidden md:block" />
        Business — Today.
      </h1>

      <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
        BuyBackSite gives you a fully branded storefront, automated daily pricing from live eBay data, prepaid shipping, and a complete order management dashboard — everything you need to buy used phones, tablets, and laptops at scale.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
        <a
          href={"/register"}
          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-lg px-8 py-4 rounded-xl transition-colors shadow-lg shadow-orange-600/20"
        >
          Start Free 14-Day Trial →
        </a>
        <a
          href="#how-it-works"
          className="inline-flex items-center gap-2 border border-white/20 text-gray-400 hover:text-white hover:border-white/40 font-semibold text-lg px-8 py-4 rounded-xl transition-colors"
        >
          See how it works ↓
        </a>
      </div>

      {/* Trust bar */}
      <div className="flex flex-col sm:flex-row items-center gap-10">
        {[
          { stat: "14-day", label: "Free Trial" },
          { stat: "No code", label: "Required" },
          { stat: "5 min", label: "Setup" },
        ].map(({ stat, label }) => (
          <div key={label} className="text-center">
            <div className="text-2xl font-black text-white">{stat}</div>
            <div className="text-sm text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Dashboard preview mockup */}
      <div className="mt-16 w-full max-w-4xl bg-white/5 border border-white/10 rounded-2xl p-1.5">
        <div className="bg-neutral-900 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <div className="flex-1 bg-white/5 rounded-md h-5 ml-2" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Orders This Month", value: "127", trend: "+18%" },
              { label: "Total Paid Out", value: "$14,820", trend: "+24%" },
              { label: "Avg. Response Time", value: "4.2 hrs", trend: "↓12%" },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">{s.label}</p>
                <p className="text-white font-black text-xl">{s.value}</p>
                <p className="text-orange-500 text-xs mt-0.5 font-medium">{s.trend}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[
              { order: "ORD-2025-0127", device: "iPhone 15 Pro 256GB", status: "Inspection", price: "$480" },
              { order: "ORD-2025-0126", device: "Samsung Galaxy S24 128GB", status: "Paid", price: "$320" },
              { order: "ORD-2025-0125", device: "MacBook Air M2", status: "In Transit", price: "$680" },
            ].map((row) => (
              <div key={row.order} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2.5 text-xs">
                <span className="font-mono text-gray-500">{row.order}</span>
                <span className="text-gray-300 hidden sm:block">{row.device}</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${row.status === "Paid" ? "bg-green-900/40 text-green-400" : row.status === "Inspection" ? "bg-purple-900/40 text-purple-400" : "bg-blue-900/40 text-blue-400"}`}>{row.status}</span>
                <span className="text-orange-400 font-bold">{row.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: "📊",
      title: "Live Market Pricing",
      body: "Prices update daily from real eBay sold listings. Every quote you give reflects today's actual market — not stale numbers.",
    },
    {
      icon: "🏷️",
      title: "Your Brand, Your Domain",
      body: "Your storefront runs on your domain with your logo and name. Customers never see 'BuyBackSite' — it's invisible infrastructure.",
    },
    {
      icon: "📦",
      title: "Automated Shipping Labels",
      body: "The moment a customer accepts an offer, we generate a prepaid USPS label via EasyPost. No manual work, no cost to the seller.",
    },
    {
      icon: "🛒",
      title: "Multi-Device Orders",
      body: "Customers can sell multiple devices in a single order — one quote, one checkout, one shipping label.",
    },
    {
      icon: "💸",
      title: "Flexible Payout Rules",
      body: "Set global margin rules or override per-category and per-device. Full control over what you offer without touching code.",
    },
    {
      icon: "🔧",
      title: "Complete Admin Dashboard",
      body: "Manage orders, update statuses, override prices, and track performance — all from one clean dashboard.",
    },
  ];

  return (
    <section id="features" className="bg-neutral-950 py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-orange-600 text-xs font-bold uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-4xl md:text-5xl font-black text-white">Everything you need to run a buyback business</h2>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
            Stop duct-taping spreadsheets and email chains. BuyBackSite is purpose-built for device resellers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white/5 border border-white/10 rounded-2xl p-7">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: "1",
      title: "Set Up Your Store",
      body: "Enter your business name, address, and margin rules. Your branded storefront is live in minutes — no developers needed.",
    },
    {
      number: "2",
      title: "Share Your Link",
      body: "Send customers to your storefront URL. They pick their device, choose a condition, and get an instant quote in under 60 seconds.",
    },
    {
      number: "3",
      title: "Receive, Inspect, Pay",
      body: "We generate the prepaid label. You receive the device, inspect it, and mark it paid. The seller gets notified at every step.",
    },
  ];

  return (
    <section id="how-it-works" className="bg-black py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-orange-600 text-xs font-bold uppercase tracking-widest mb-3">How It Works</p>
          <h2 className="text-4xl md:text-5xl font-black text-white">From sign-up to first order in one day</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="relative bg-white/5 border border-white/10 rounded-2xl p-8">
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

function PricingSection() {
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      name: "Starter",
      monthly: 49,
      annual: 39,
      desc: "Perfect for part-time resellers just getting started.",
      features: [
        "Up to 50 orders / month",
        "Branded storefront",
        "Automated pricing",
        "Prepaid shipping labels",
        "Email order notifications",
        "7-day support response",
      ],
      cta: "Start Free Trial",
      highlighted: false,
    },
    {
      name: "Growth",
      monthly: 99,
      annual: 79,
      desc: "For resellers scaling their buyback operation.",
      features: [
        "Up to 300 orders / month",
        "Everything in Starter",
        "Custom domain",
        "Per-category margin rules",
        "Manual price overrides",
        "Priority email support",
      ],
      cta: "Start Free Trial",
      highlighted: true,
    },
    {
      name: "Pro",
      monthly: 199,
      annual: 159,
      desc: "High-volume operations that need zero limits.",
      features: [
        "Unlimited orders",
        "Everything in Growth",
        "Multiple staff accounts",
        "API access",
        "White-glove onboarding",
        "Dedicated Slack support",
      ],
      cta: "Contact Sales",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="bg-neutral-950 py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-orange-600 text-xs font-bold uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-6">
            14-day free trial on all plans. No credit card required. Cancel anytime.
          </p>

          {/* Annual toggle */}
          <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${!annual ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${annual ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Annual
              <span className="ml-1.5 text-xs text-orange-300 font-normal">save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 flex flex-col ${
                plan.highlighted
                  ? "bg-orange-600/10 border-2 border-orange-500"
                  : "bg-white/5 border border-white/10"
              }`}
            >
              {plan.highlighted && (
                <div className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">
                  Most Popular
                </div>
              )}
              <h3 className="text-white font-black text-xl mb-1">{plan.name}</h3>
              <p className="text-gray-500 text-sm mb-6">{plan.desc}</p>

              <div className="mb-6">
                <span className="text-5xl font-black text-white">
                  ${annual ? plan.annual : plan.monthly}
                </span>
                <span className="text-gray-500 text-sm ml-1">/mo</span>
                {annual && (
                  <p className="text-xs text-orange-400 mt-1">Billed ${plan.annual * 12}/year</p>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.name === "Pro" ? `mailto:${SALES_EMAIL}` : "/register"}
                className={`w-full py-3 rounded-xl font-bold text-sm text-center transition-colors ${
                  plan.highlighted
                    ? "bg-orange-600 hover:bg-orange-500 text-white"
                    : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="bg-black py-24 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-orange-600/10 border border-orange-600/30 text-orange-400 text-xs font-semibold px-4 py-2 rounded-full mb-8 tracking-wide uppercase">
          Ready to launch?
        </div>
        <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
          Your buyback store,<br className="hidden md:block" /> live today.
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          Join resellers already running profitable buyback businesses on BuyBackSite. Start your free 14-day trial — no credit card needed.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={"/register"}
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-lg px-8 py-4 rounded-xl transition-colors shadow-lg shadow-orange-600/20"
          >
            Start Free Trial →
          </a>
          <a
            href={`mailto:${HELLO_EMAIL}`}
            className="border border-white/20 text-gray-400 hover:text-white hover:border-white/40 font-semibold text-lg px-8 py-4 rounded-xl transition-colors"
          >
            Talk to sales
          </a>
        </div>
      </div>
    </section>
  );
}

function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-black border-t border-white/10 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-white font-black text-lg tracking-tight">BuyBackSite</span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs mb-4">
              The complete platform for running a branded device buyback business. Automated pricing, shipping, and payments — all under your brand.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed max-w-xs">
              Built for independent electronics resellers who want enterprise-grade infrastructure without the enterprise price tag.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-4">Product</p>
            <ul className="space-y-2">
              {[
                { label: "Features", href: "#features" },
                { label: "How It Works", href: "#how-it-works" },
                { label: "Pricing", href: "#pricing" },
                { label: "Sign In", href: `${APP_URL}/login` },
                { label: "Start Free Trial", href: "/register" },
              ].map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-gray-400 hover:text-white text-sm transition-colors">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-4">Company</p>
            <ul className="space-y-2">
              {[
                { label: "Contact", href: `mailto:${HELLO_EMAIL}` },
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
              ].map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-gray-400 hover:text-white text-sm transition-colors">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-600 text-xs">&copy; {year} BuyBackSite. All rights reserved.</p>
          <p className="text-gray-700 text-xs">Built for independent device resellers.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SaasHomePage() {
  return (
    <div className="bg-black min-h-screen">
      <MarketingNav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <CtaSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
