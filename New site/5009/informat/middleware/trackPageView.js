const PageView = require('../models/PageView');
const {
  buildVisitorHash,
  getClientIp,
  getCountryFromIp,
  parseUserAgent,
  getReferrerHost
} = require('../utils/analytics');

// Only track real page loads, not asset/API requests, and never block the response.
function trackPageView(articleId = null) {
  return function trackPageViewMiddleware(req, res, next) {
    next();

    setImmediate(async () => {
      try {
        const ip = getClientIp(req);
        const userAgent = req.get('User-Agent') || '';
        const { device, browser, os } = parseUserAgent(userAgent);

        await PageView.create({
          path: req.originalUrl.split('?')[0],
          articleId,
          country: getCountryFromIp(ip),
          device,
          browser,
          os,
          referrerHost: getReferrerHost(req),
          visitorHash: buildVisitorHash(ip, userAgent)
        });
      } catch (err) {
        console.error('[analytics] Failed to record page view:', err.message);
      }
    });
  };
}

module.exports = trackPageView;
