require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const quoteRouter = require('./routes/quote');

const app = express();

// Security headers
app.use(helmet());

// CORS — allow only the configured frontend origin
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })
);

// Parse JSON bodies
app.use(express.json());

// Rate limiter: 10 requests per minute per IP on all /api/ routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'rate_limit_exceeded',
    message: 'Too many requests. Please wait a minute and try again.',
  },
});
app.use('/api/', apiLimiter);

// Routes
app.use('/api', quoteRouter);

// Health check (not rate-limited)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'not_found' });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'internal_server_error' });
});

const PORT = parseInt(process.env.PORT, 10) || 3001;
app.listen(PORT, () => {
  console.log(`[server] Buyback Quote API listening on port ${PORT}`);
});

module.exports = app;
