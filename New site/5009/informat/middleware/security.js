const helmet = require('helmet');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Generates a fresh per-request nonce so the JSON-LD <script> tags in
// views/partials/head.ejs can be allow-listed without weakening CSP with
// a blanket 'unsafe-inline' for scripts.
function cspNonceMiddleware(req, res, next) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

function buildHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // EasyMDE (admin markdown editor) is loaded from a CDN; JSON-LD
        // structured-data blocks are allowed via a per-request nonce.
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', (req, res) => `'nonce-${res.locals.cspNonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false
  });
}

// General limiter for all traffic - generous, just guards against abuse.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false
});

// Strict limiter for the login route to slow down brute-force attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

// Limiter for the public search/contact forms.
const formLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { buildHelmet, cspNonceMiddleware, generalLimiter, loginLimiter, formLimiter };
