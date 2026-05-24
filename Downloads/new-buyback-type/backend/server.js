require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const quoteRouter = require('./routes/quote');
const leadRouter = require('./routes/lead');

const app = express();

// Security headers
app.use(helmet());

// CORS — allow configured frontend origin; also allow null origin (file://) in development
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const IS_PROD = process.env.NODE_ENV === 'production';
app.use(
  cors({
    origin: (origin, callback) => {
      // No origin header (curl, Postman) or "null" string (browser file:// protocol) — allow in dev
      if (!origin || origin === 'null') return callback(null, !IS_PROD);
      if (origin === FRONTEND_ORIGIN) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
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
app.use('/api', leadRouter);

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
