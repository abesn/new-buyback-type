require('dotenv').config();
const { chromium } = require('playwright');

const MARGIN_PERCENTAGE = parseFloat(process.env.MARGIN_PERCENTAGE) || 0.85;
const MAX_SCRAPE_RETRIES = parseInt(process.env.MAX_SCRAPE_RETRIES, 10) || 3;
const QUOTE_VALIDITY_HOURS = parseInt(process.env.QUOTE_VALIDITY_HOURS, 10) || 24;

// Minimum gap between outgoing SellCell requests (ms)
const MIN_REQUEST_GAP_MS = 5000;
let lastRequestTime = 0;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enforce minimum gap between SellCell requests.
 */
async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_GAP_MS) {
    await sleep(MIN_REQUEST_GAP_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

/**
 * Extract price results from the page.
 * Returns an array of { name, price } objects.
 */
async function extractPrices(page) {
  return page.evaluate(() => {
    const results = [];
    const rows = document.querySelectorAll('.recycler-price');
    for (const row of rows) {
      // Skip hidden rows (display:none used for expandable sections)
      if (row.offsetParent === null) continue;
      const imgEl = row.querySelector('td.logo picture img');
      const priceEl = row.querySelector('td.sell div.price');
      if (!imgEl || !priceEl) continue;
      const name = (imgEl.alt || '').trim();
      const priceText = (priceEl.textContent || '').trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
      if (name && !isNaN(price) && price > 0) {
        results.push({ name, price });
      }
    }
    return results;
  });
}

/**
 * Click a filter label and wait for the price list to re-render.
 */
async function clickFilter(page, labelEl) {
  await labelEl.click();
  // Wait for price rows to be present and stable
  await page.waitForSelector('.recycler-price td.sell div.price', { timeout: 15000 });
  // Small settle delay for AJAX to complete writing all rows
  await sleep(1500);
}

/**
 * Core scrape function — no retry logic here.
 */
async function scrapeSellCell({ url, storage, carrier, condition }) {
  await throttle();

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: randomUA(),
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    const page = await context.newPage();

    // Block unnecessary resources to speed things up
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,otf}', (route) => route.abort());

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.recycler-price td.sell div.price', { timeout: 20000 });

    // --- Storage filter ---
    const storageLabels = await page.$$('.tell-us-about label.radio-inline-capacity');
    let storageClicked = false;
    for (const label of storageLabels) {
      const text = (await label.textContent()).trim().toUpperCase();
      if (text === storage.toUpperCase()) {
        await clickFilter(page, label);
        storageClicked = true;
        break;
      }
    }
    if (!storageClicked) {
      // Attempt partial match (e.g. "256" inside "256GB")
      for (const label of storageLabels) {
        const text = (await label.textContent()).trim().toUpperCase();
        if (text.includes(storage.toUpperCase())) {
          await clickFilter(page, label);
          storageClicked = true;
          break;
        }
      }
    }
    if (!storageClicked) {
      console.error(`[scraper] Storage filter not found for "${storage}" at ${url}`);
      return [];
    }

    // --- Carrier filter ---
    // Carrier labels use images — match by the input's data-attribute value
    const carrierInputs = await page.$$('.tell-us-about label.radio-inline-network input[type="radio"]');
    let carrierClicked = false;
    for (const input of carrierInputs) {
      const dataAttr = await input.getAttribute('data-attribute');
      if (dataAttr && dataAttr.trim().toLowerCase() === carrier.toLowerCase()) {
        const label = await input.$('xpath=..');
        if (label) {
          await clickFilter(page, label);
          carrierClicked = true;
          break;
        }
      }
    }
    if (!carrierClicked) {
      console.error(`[scraper] Carrier filter not found for "${carrier}" at ${url}`);
    }

    // --- Condition filter ---
    const conditionInputs = await page.$$('.tell-us-about label.condition input[type="radio"]');
    let conditionClicked = false;
    for (const input of conditionInputs) {
      const dataAttr = await input.getAttribute('data-attribute');
      if (dataAttr && dataAttr.trim().toUpperCase() === condition.toUpperCase()) {
        const label = await input.$('xpath=..');
        if (label) {
          await clickFilter(page, label);
          conditionClicked = true;
          break;
        }
      }
    }
    if (!conditionClicked) {
      // Fallback: match by input value mapped from condition display name
      const conditionValueMap = { MINT: 'new', GOOD: 'working', POOR: 'poor', FAULTY: 'broken' };
      const expectedValue = conditionValueMap[condition.toUpperCase()];
      if (expectedValue) {
        for (const input of conditionInputs) {
          const val = await input.getAttribute('value');
          if (val === expectedValue) {
            const label = await input.$('xpath=..');
            if (label) {
              await clickFilter(page, label);
              conditionClicked = true;
              break;
            }
          }
        }
      }
    }
    if (!conditionClicked) {
      console.error(`[scraper] Condition filter not found for "${condition}" at ${url}`);
    }

    // Extract prices
    const prices = await extractPrices(page);
    return prices;
  } finally {
    await browser.close();
  }
}

/**
 * Main exported function. Handles retries, builds the result object.
 *
 * @param {object} opts
 * @param {string} opts.brand       e.g. "apple"
 * @param {string} opts.model       e.g. "iphone-15-pro-max"
 * @param {string} opts.storage     e.g. "256GB"
 * @param {string} opts.carrier     SellCell display value e.g. "Verizon"
 * @param {string} opts.condition   SellCell display value e.g. "GOOD"
 * @returns {Promise<object>}
 */
async function getQuote({ brand, model, storage, carrier, condition }) {
  const baseUrl = process.env.SELLCELL_BASE_URL || 'https://www.sellcell.com';
  const url = `${baseUrl}/phones/${brand}-${model}/`;

  // Build human-readable device string
  const deviceName = [
    brand.charAt(0).toUpperCase() + brand.slice(1),
    model.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    storage.toUpperCase(),
  ].join(' ');

  let lastError;
  for (let attempt = 1; attempt <= MAX_SCRAPE_RETRIES; attempt++) {
    try {
      const prices = await scrapeSellCell({ url, storage, carrier, condition });

      if (!prices || prices.length === 0) {
        return {
          success: false,
          error: 'no_prices_found',
          message: `No vendor prices found for ${deviceName} with the selected filters.`,
        };
      }

      // Top 3 by price (SellCell already sorts highest-first, but sort to be safe)
      const sorted = [...prices].sort((a, b) => b.price - a.price);
      const top3 = sorted.slice(0, 3);

      const sum = top3.reduce((acc, v) => acc + v.price, 0);
      const average = Math.round((sum / top3.length) * 100) / 100;
      const ourQuote = Math.round(average * MARGIN_PERCENTAGE * 100) / 100;

      const marketPrices = {};
      top3.forEach((v, i) => {
        marketPrices[`vendor_${i + 1}`] = { name: v.name, price: v.price };
      });

      return {
        success: true,
        device: deviceName,
        carrier,
        condition,
        market_prices: marketPrices,
        average_market_price: average,
        our_quote: ourQuote,
        currency: 'USD',
        quoted_at: new Date().toISOString(),
        quote_valid_hours: QUOTE_VALIDITY_HOURS,
      };
    } catch (err) {
      lastError = err;
      console.error(`[scraper] Attempt ${attempt}/${MAX_SCRAPE_RETRIES} failed for ${url}: ${err.message}`);
      if (attempt < MAX_SCRAPE_RETRIES) {
        await sleep(2 ** attempt * 1000); // 2s, 4s, 8s
      }
    }
  }

  console.error('[scraper] All retries exhausted:', lastError.message);
  throw lastError;
}

module.exports = { getQuote };
