const express = require('express');
const { z } = require('zod');
const { getQuote } = require('../scraper/sellcell-scraper');
const cache = require('../utils/cache');

const router = express.Router();

const quoteSchema = z.object({
  category: z.enum(['smartphones']),
  brand: z.enum(['apple', 'samsung', 'google', 'motorola', 'oneplus', 'lg']),
  model: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/),
  storage: z.string().regex(/^[0-9]+(gb|tb)$/i),
  carrier: z.enum(['unlocked', 'verizon', 'att', 't-mobile', 'other']),
  condition: z.enum(['like-new', 'good', 'fair', 'poor']),
});

// Map frontend carrier values → SellCell display values
const CARRIER_MAP = {
  unlocked: 'Unlocked',
  verizon: 'Verizon',
  att: 'AT&T',
  'T-Mobile': 'T-Mobile',
  other: 'Other',
};
// Fix t-mobile key
CARRIER_MAP['t-mobile'] = 'T-Mobile';

// Map frontend condition values → SellCell display values
const CONDITION_MAP = {
  'like-new': 'MINT',
  good: 'GOOD',
  fair: 'POOR',
  poor: 'FAULTY',
};

router.post('/quote', async (req, res) => {
  // 1. Validate input
  const parseResult = quoteSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'validation_error',
      details: parseResult.error.flatten(),
    });
  }

  const { brand, model, storage, carrier, condition } = parseResult.data;

  // Normalize storage to uppercase for consistency
  const normalizedStorage = storage.toUpperCase();

  // 2. Check cache
  const cacheKey = cache.buildKey({ brand, model, storage: normalizedStorage, carrier, condition });
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // 3. Map to SellCell display values
  const sellcellCarrier = CARRIER_MAP[carrier];
  const sellcellCondition = CONDITION_MAP[condition];

  // 4. Call scraper
  let scraperResult;
  try {
    scraperResult = await getQuote({
      brand,
      model,
      storage: normalizedStorage,
      carrier: sellcellCarrier,
      condition: sellcellCondition,
    });
  } catch (err) {
    console.error('[quote route] Scraper threw:', err.message);
    return res.status(502).json({
      success: false,
      error: 'scrape_failed',
      message: 'Unable to retrieve pricing data. Please try again shortly.',
    });
  }

  // Handle scraper-level failures (e.g. no_prices_found)
  if (!scraperResult.success) {
    return res.status(502).json({
      success: false,
      error: scraperResult.error || 'scrape_failed',
      message: scraperResult.message || 'Unable to retrieve pricing data.',
    });
  }

  // 5. Build public response — strip internal market data
  const publicResult = {
    success: true,
    device: scraperResult.device,
    carrier: scraperResult.carrier,
    condition: scraperResult.condition,
    our_quote: scraperResult.our_quote,
    currency: scraperResult.currency,
    quoted_at: scraperResult.quoted_at,
    quote_valid_hours: scraperResult.quote_valid_hours,
  };

  // 6. Cache the stripped public result only — never persist internal vendor data
  //    (market_prices, average_market_price, MARGIN_PERCENTAGE must not reach clients)
  cache.set(cacheKey, publicResult);

  return res.json(publicResult);
});

module.exports = router;
