const express = require('express');
const { z } = require('zod');
const { sendLeadNotification } = require('../utils/email');

const router = express.Router();

const leadSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^[\d\s\-\+\(\)]{7,20}$/),
  address: z.string().min(5).max(200),
  city: z.string().min(2).max(100),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}$/),
  paymentMethod: z.enum(['zelle', 'paypal', 'check', 'venmo']),
  paymentDetails: z.string().min(1).max(200),
  quote: z.object({
    our_quote: z.number().positive(),
    device: z.string(),
    carrier: z.string().optional(),
    condition: z.string().optional(),
    quoted_at: z.string().optional(),
  }),
});

router.post('/lead', async (req, res) => {
  // 1. Validate input
  const parseResult = leadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'validation_error',
      details: parseResult.error.errors,
    });
  }

  const {
    name, email, phone,
    address, city, state, zip,
    paymentMethod, paymentDetails,
    quote,
  } = parseResult.data;

  // 2. Send notification email (best-effort — don't fail the submission on email error)
  try {
    await sendLeadNotification({
      customerInfo: { name, email, phone, address, city, state, zip, paymentMethod, paymentDetails },
      quoteData: {
        device: quote.device,
        carrier: quote.carrier,
        condition: quote.condition,
        our_quote: quote.our_quote,
        quoted_at: quote.quoted_at,
      },
      vendorData: {},
    });
  } catch (emailErr) {
    console.error('[lead route] Failed to send notification email:', emailErr.message);
  }

  // 3. Return success regardless of email outcome
  try {
    return res.json({
      success: true,
      message: "Thank you! We'll email you a prepaid shipping label within 24 hours.",
    });
  } catch (err) {
    console.error('[lead route] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  }
});

module.exports = router;
