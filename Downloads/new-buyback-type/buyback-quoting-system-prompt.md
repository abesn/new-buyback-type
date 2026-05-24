# Claude Code Prompt: Buyback Price Quoting System

## Project Overview

Build a web application for a device buyback business. The app lets prospects get an instant quote for their used device. When the user clicks "Get Quote," the backend scrapes **sellcell.com** for current buyback vendor prices, averages the top 3 vendor prices, applies an 85% margin, and displays the result as our offer. If the prospect accepts, a lead capture form collects their info.

**This is a new, standalone project. Do not link it to any existing project or folder.**

---

## Architecture

### Stack

- **Frontend:** Static site (HTML/CSS/JS or a lightweight framework like Astro or plain React). Must be deployable as a DigitalOcean Static Site.
- **Backend:** A small Node.js (Express) or Python (FastAPI/Flask) API service. This handles the scraping logic and will be deployed as a DigitalOcean App Platform Service (or a Droplet if needed).
- **No database required for v1.** Lead capture submissions should be emailed (via a transactional email service like Resend, SendGrid, or Mailgun) or stored in a simple JSON file / Google Sheet as a temporary solution.
- **No AI/LLM needed.** This is a deterministic scraping + math operation.

### Why Two Components

SellCell loads its price comparison data dynamically via JavaScript (likely API calls from the browser). A static site cannot scrape another website client-side due to CORS restrictions. The backend acts as a proxy/scraper that:

1. Receives the device parameters from the frontend
2. Fetches the SellCell page using a headless browser (Puppeteer/Playwright) since prices are JS-rendered
3. Extracts the top 3 vendor prices
4. Computes the average and applies the margin
5. Returns the quote to the frontend

---

## Detailed Specifications

### 1. Frontend — Device Selection Flow

Build a step-by-step device selector. Each step narrows the selection. The user progresses through these steps sequentially:

**Step 1 — Category**
Options: Smartphones, Tablets, Smartwatches, Laptops/MacBooks, Game Consoles
(Start with Smartphones only for v1; the others can be placeholder/coming-soon)

**Step 2 — Brand**
For Smartphones: Apple, Samsung, Google, Motorola, OnePlus, LG, etc.
(Hardcode the initial brand list based on SellCell's supported brands)

**Step 3 — Model**
Based on brand selection. Example for Apple: iPhone 17 Pro Max, iPhone 17 Pro, iPhone 17, iPhone 16 Pro Max, iPhone 16 Pro, iPhone 16, iPhone 15 Pro Max, etc.
(Hardcode the most popular ~30-50 models per brand initially)

**Step 4 — Storage**
Based on model selection. Example for iPhone 16 Pro Max: 256GB, 512GB, 1TB
(Hardcode per model)

**Step 5 — Carrier**
Options: Unlocked, Verizon, AT&T, T-Mobile, Sprint, Other
(These map to SellCell's network filter options)

**Step 6 — Condition**
Options: Like New, Good, Fair, Poor/Broken
(These map to SellCell's condition filters: "Like New", "Good", "Poor", "Faulty")

**Step 7 — "Get Quote" button**
When clicked, sends all selections to the backend API and shows a loading spinner with a message like "Fetching the best market prices for your device..."

**UI/UX Requirements:**
- Clean, modern, mobile-first design
- Progress indicator showing which step the user is on
- Back button to go to previous step
- Each step should animate/transition smoothly
- Use a card-based or pill-based selection UI (not dropdowns — large tappable areas)
- Color scheme: Use a professional tech-buyback aesthetic (think blues/greens/whites — trustworthy and clean)

### 2. Backend — Price Scraping Engine

#### SellCell URL Structure

SellCell's device pages follow this pattern:
```
https://www.sellcell.com/phones/apple-iphone-15-pro-max/
https://www.sellcell.com/phones/samsung-galaxy-s25-ultra/
```

General pattern:
```
https://www.sellcell.com/phones/{brand}-{model-name-slugified}/
```

For other device types:
```
https://www.sellcell.com/sell/tablets/{device-slug}/
https://www.sellcell.com/sell/apple-macbook/
https://www.sellcell.com/sell/apple-watch/
```

On each device page, SellCell displays filter options for:
- **Network/Carrier** (Unlocked, Verizon, AT&T, T-Mobile, etc.)
- **Storage/Memory** (64GB, 128GB, 256GB, etc.)
- **Condition** (Like New, Good, Poor, Faulty)

The price comparison results are loaded dynamically (JavaScript-rendered). The results list shows multiple buyback vendors, each with a price and a "GET PAID" button. Vendors are sorted by price (highest first).

#### Scraping Strategy

Since prices are JS-rendered, you MUST use a headless browser:

1. **Use Playwright (preferred) or Puppeteer** to load the SellCell device page
2. **Wait for the price results to render** (wait for the vendor price elements to appear in the DOM)
3. **Apply filters** by programmatically clicking the correct Storage, Carrier, and Condition filter options on the page, then wait for results to re-render
4. **Extract the top 3 vendor prices** from the results list (the first 3 entries, which are sorted highest-to-lowest by SellCell)
5. **Parse the dollar amounts** from those 3 vendors
6. **Calculate:**
   ```
   average_price = (vendor1_price + vendor2_price + vendor3_price) / 3
   our_quote = average_price * 0.85
   our_quote = round(our_quote, 2)
   ```
7. **Return** the quote along with metadata (device name, specs, the 3 vendor prices used, the average, and the final quote)

#### API Endpoint

```
POST /api/quote
```

**Request body:**
```json
{
  "category": "smartphones",
  "brand": "apple",
  "model": "iphone-15-pro-max",
  "storage": "256gb",
  "carrier": "verizon",
  "condition": "good"
}
```

**Response (success):**
```json
{
  "success": true,
  "device": "Apple iPhone 15 Pro Max 256GB",
  "carrier": "Verizon",
  "condition": "Good",
  "market_prices": {
    "vendor_1": { "name": "Decluttr", "price": 520.00 },
    "vendor_2": { "name": "ItsWorthMore", "price": 505.00 },
    "vendor_3": { "name": "BuyBackWorld", "price": 498.00 }
  },
  "average_market_price": 507.67,
  "our_quote": 431.52,
  "currency": "USD",
  "quoted_at": "2026-05-24T14:30:00Z",
  "quote_valid_hours": 24
}
```

**Response (error/no prices found):**
```json
{
  "success": false,
  "error": "no_prices_found",
  "message": "We couldn't find current market prices for this device configuration. Please try a different combination or contact us directly."
}
```

#### Scraping Resilience

- **Implement retries** (up to 3 attempts with exponential backoff) if the page fails to load or prices don't render within 15 seconds
- **Cache results** for the same device+spec combination for 1 hour (use in-memory cache like node-cache or Redis if available) to reduce scraping load and speed up repeat queries
- **Rate limit** outgoing requests to SellCell — no more than 1 request per 5 seconds to be respectful
- **Rotate User-Agent strings** to reduce detection risk
- **Log all scraping failures** with the URL attempted and error details for debugging
- **Fallback:** If fewer than 3 vendors have prices, average whatever is available (minimum 1). If zero vendors have prices, return the error response above.

#### Important: SellCell DOM Selectors

Since SellCell's DOM structure may change, the scraper code should:
- Use clearly documented CSS selectors in a config file (not hardcoded deep in logic)
- Include a `selectors.config.js` (or `.json`) file like:
```json
{
  "price_result_container": ".compare-prices-table .price-row",
  "vendor_name": ".merchant-name",
  "vendor_price": ".price-value",
  "storage_filter": ".filter-storage button",
  "carrier_filter": ".filter-network button",
  "condition_filter": ".filter-condition button"
}
```
- **NOTE:** These selectors above are PLACEHOLDERS. You must inspect the actual rendered SellCell page DOM using the headless browser to determine the real selectors. Load a page like `https://www.sellcell.com/phones/apple-iphone-15-pro-max/` in Playwright, take a screenshot, dump the rendered HTML, and identify the correct selectors. Document them in the config file.

### 3. Quote Display & Lead Capture

#### Quote Display Screen

After the backend returns a quote, show:
- The device description (e.g., "Apple iPhone 15 Pro Max · 256GB · Verizon · Good Condition")
- **Our offer price in large, prominent text** (e.g., "$431.52")
- A note: "This quote is valid for 24 hours"
- Two CTAs:
  - **"Accept & Ship Your Device"** → opens the lead capture form
  - **"Get a New Quote"** → resets the flow to Step 1

Do NOT show the individual vendor prices or the average to the end user. Those are internal data only (useful for the admin/logs).

#### Lead Capture Form

When the prospect clicks "Accept & Ship Your Device," show a form:

**Fields:**
- Full Name (required)
- Email Address (required)
- Phone Number (required)
- Shipping Address — Street (required)
- City (required)
- State (dropdown, required)
- ZIP Code (required)
- Preferred Payment Method: Zelle, PayPal, Check, Venmo (radio buttons, required)
- Payment Details: (text field — e.g., PayPal email or Zelle phone number) (required)

**On Submit:**
- Send an email notification to the business owner with all the quote details + customer info
- Show a confirmation screen: "Thank you! We'll email you a prepaid shipping label within 24 hours. Check your inbox at [email]."
- The email to the business owner should include: device details, our quote price, the 3 vendor prices used, the average, customer name, contact info, shipping address, and payment preference

### 4. Admin Configuration

Create a simple `.env` configuration for:
```
MARGIN_PERCENTAGE=0.85
QUOTE_VALIDITY_HOURS=24
NOTIFICATION_EMAIL=owner@yourbuybacksite.com
EMAIL_SERVICE_API_KEY=your-api-key-here
EMAIL_SERVICE=resend
CACHE_TTL_MINUTES=60
MAX_SCRAPE_RETRIES=3
SELLCELL_BASE_URL=https://www.sellcell.com
```

---

## Security Requirements

Before deploying to DigitalOcean, scan the entire codebase for vulnerabilities:

1. **Input validation:** Sanitize all user inputs on both frontend and backend. Only accept expected values from predefined lists (don't let users inject arbitrary model names into URLs).
2. **Rate limiting:** Add rate limiting to the `/api/quote` endpoint (e.g., max 10 requests per minute per IP) to prevent abuse.
3. **CORS:** Configure CORS on the backend to only accept requests from your frontend domain.
4. **No sensitive data in frontend:** The margin percentage, vendor prices, and business logic stay server-side. The frontend only receives the final quote amount.
5. **Environment variables:** All API keys, email credentials, and configuration must be in `.env` — never committed to the repo.
6. **Dependency audit:** Run `npm audit` (Node) or `pip-audit` / `safety check` (Python) before deployment.
7. **Helmet/security headers:** If using Express, add `helmet`. Set appropriate security headers (CSP, X-Frame-Options, etc.).
8. **HTTPS only:** Enforce HTTPS on DigitalOcean.
9. **XSS prevention:** Escape all user-provided data before rendering in HTML.
10. **No eval or dynamic code execution** from user input.

---

## Deployment Plan (DigitalOcean)

### Frontend
- Deploy as a **DigitalOcean App Platform → Static Site**
- Point to the `frontend/` directory of the repo
- Set the build command and output directory appropriately

### Backend
- Deploy as a **DigitalOcean App Platform → Web Service** (Node.js or Python)
- Or use a **Droplet** if Playwright/headless browser needs more control over the environment
- Note: Playwright requires Chromium to be installed. On a Droplet, you'll need to install browser dependencies. On App Platform, you may need a custom Dockerfile.
- **Recommended approach:** Use a Dockerfile that installs Playwright + Chromium so it works on any platform.

### Project Structure
```
buyback-quote/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── app.js
│   └── assets/
│       └── images/
├── backend/
│   ├── server.js (or app.py)
│   ├── scraper/
│   │   ├── sellcell-scraper.js
│   │   └── selectors.config.json
│   ├── routes/
│   │   └── quote.js
│   ├── utils/
│   │   ├── cache.js
│   │   └── email.js
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json (or requirements.txt)
├── .gitignore
└── README.md
```

---

## What NOT to Build (Out of Scope for v1)

- No user accounts or authentication
- No payment processing
- No actual shipping label generation (that's manual for now)
- No admin dashboard
- No database
- No device categories beyond Smartphones (placeholder only for others)
- No AI/LLM integration

---

## Testing Checklist

Before considering this done:

1. [ ] Device selection flow works end-to-end on desktop and mobile
2. [ ] Backend successfully scrapes at least 5 different device pages on SellCell
3. [ ] Prices are correctly extracted, averaged, and margin-applied
4. [ ] Quote displays correctly to the user (no internal data leaked)
5. [ ] Lead capture form validates all required fields
6. [ ] Email notification is sent to the business owner with full details
7. [ ] Confirmation screen shows after form submission
8. [ ] Error states are handled gracefully (no prices found, scraping timeout, network error)
9. [ ] Caching works (second request for same device is instant)
10. [ ] Rate limiting is active on the API
11. [ ] Security scan passes with no critical or high vulnerabilities
12. [ ] Frontend is responsive and works on mobile Safari and Chrome
13. [ ] The app deploys successfully to DigitalOcean
