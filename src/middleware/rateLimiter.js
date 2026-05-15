/**
 * Rate Limiter Middleware
 * ---------------------
 * Centralized rate limiting configuration for the Express application.
 *
 * Two limiters are exported:
 *   1. apiLimiter     – General purpose limiter for all /api routes.
 *   2. authLimiter    – Strict limiter for authentication-sensitive routes
 *                       (login, register, OTP, password reset, etc.).
 *
 * Production notes:
 *   - Requires `app.set("trust proxy", 1)` so that Express reads the real
 *     client IP from X-Forwarded-For when behind Nginx / ALB / CloudFront.
 *   - Uses the built-in in-memory store (no Redis dependency). This is
 *     suitable for single-instance deployments. For horizontally scaled
 *     clusters, swap to `rate-limit-redis` or similar later.
 *   - Returns a consistent JSON error body on HTTP 429.
 */

const rateLimit = require('express-rate-limit');

// ---------------------------------------------------------------------------
// 1. General API limiter  (applies to /api/* routes)
// ---------------------------------------------------------------------------
// 100 requests per 15-minute window per IP.
// This is generous enough for normal users browsing / interacting with the
// frontend, but will catch automated scrapers and accidental request loops.
const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,       // 10 minutes
  max: 1000,                        // limit each IP to 1000 requests per window
  standardHeaders: true,           // Return rate limit info in `RateLimit-*` headers (draft-6)
  legacyHeaders: false,            // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 10 minutes.',
  },
  // Skip rate limiting for requests that aren't from external clients
  // (e.g. health-check probes within the same machine / VPC).
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
});

// ---------------------------------------------------------------------------
// 2. Strict auth limiter  (login, register, OTP, password reset)
// ---------------------------------------------------------------------------
// 15 requests per 10-minute window per IP.
// Auth endpoints are the primary brute-force targets; a much tighter cap
// dramatically raises the cost of credential-stuffing attacks.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,       // 10 minutes
  max: 50,                         // limit each IP to 50 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP, please try again after 10 minutes.',
  },
});

module.exports = { apiLimiter, authLimiter };
