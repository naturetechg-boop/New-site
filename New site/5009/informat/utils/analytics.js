const crypto = require('crypto');
const geoip = require('geoip-lite');
const { UAParser } = require('ua-parser-js');

/**
 * Builds a one-way, non-reversible, daily-rotating hash that lets us count
 * roughly "unique" visitors without storing any raw personal identifier.
 * The salt changes every day (UTC), so the same hash cannot be used to
 * track a visitor across days, and the IP address is never persisted.
 */
function buildVisitorHash(ip, userAgent) {
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.SESSION_SECRET || 'informat-analytics-salt';
  return crypto
    .createHash('sha256')
    .update(`${day}|${salt}|${ip || ''}|${userAgent || ''}`)
    .digest('hex');
}

function getClientIp(req) {
  // Render sits behind a proxy; trust the first X-Forwarded-For entry.
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

function getCountryFromIp(ip) {
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.')) {
    return 'Unknown';
  }
  try {
    const geo = geoip.lookup(ip);
    return (geo && geo.country) || 'Unknown';
  } catch (err) {
    return 'Unknown';
  }
}

function parseUserAgent(userAgent) {
  const parser = new UAParser(userAgent || '');
  const result = parser.getResult();
  const deviceType = result.device.type; // 'mobile' | 'tablet' | undefined (desktop)
  const device = deviceType === 'mobile' ? 'mobile' : deviceType === 'tablet' ? 'tablet' : 'desktop';
  return {
    device,
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown'
  };
}

function getReferrerHost(req) {
  const ref = req.get('Referrer') || req.get('Referer');
  if (!ref) return 'Direct';
  try {
    const host = new URL(ref).hostname;
    // Don't count internal navigation as a referrer source.
    if (req.hostname && host === req.hostname) return 'Direct';
    return host;
  } catch (err) {
    return 'Direct';
  }
}

module.exports = {
  buildVisitorHash,
  getClientIp,
  getCountryFromIp,
  parseUserAgent,
  getReferrerHost
};
