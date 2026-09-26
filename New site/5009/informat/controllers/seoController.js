const Article = require('../models/Article');
const Category = require('../models/Category');
const Settings = require('../models/Settings');
const siteConfig = require('../config/site');

async function getSitemap(req, res, next) {
  try {
    const baseUrl = siteConfig.siteUrl.replace(/\/$/, '');

    const [articles, categories] = await Promise.all([
      Article.find({ status: 'published', publishedAt: { $lte: new Date() } })
        .select('slug updatedAt publishedAt')
        .lean(),
      Category.find().select('slug updatedAt').lean()
    ]);

    const staticUrls = [
      { loc: '/', priority: '1.0' },
      { loc: '/articles', priority: '0.8' },
      { loc: '/about', priority: '0.5' },
      { loc: '/contact', priority: '0.4' },
      { loc: '/privacy', priority: '0.3' },
      { loc: '/terms', priority: '0.3' }
    ];

    const urlEntries = [
      ...staticUrls.map(
        (u) => `  <url>\n    <loc>${baseUrl}${u.loc}</loc>\n    <priority>${u.priority}</priority>\n  </url>`
      ),
      ...categories.map(
        (c) =>
          `  <url>\n    <loc>${baseUrl}/category/${c.slug}</loc>\n    <lastmod>${new Date(
            c.updatedAt
          ).toISOString()}</lastmod>\n    <priority>0.6</priority>\n  </url>`
      ),
      ...articles.map(
        (a) =>
          `  <url>\n    <loc>${baseUrl}/article/${a.slug}</loc>\n    <lastmod>${new Date(
            a.updatedAt || a.publishedAt
          ).toISOString()}</lastmod>\n    <priority>0.7</priority>\n  </url>`
      )
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries.join(
      '\n'
    )}\n</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    next(err);
  }
}

function getRobots(req, res) {
  const baseUrl = siteConfig.siteUrl.replace(/\/$/, '');
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    `Sitemap: ${baseUrl}/sitemap.xml`
  ];
  res.set('Content-Type', 'text/plain');
  res.send(lines.join('\n'));
}

// Serves the Google Search Console "HTML file" verification method.
// Visiting https://yoursite.onrender.com/google<CODE>.html must return
// the exact text: google-site-verification: google<CODE>.html
async function getGoogleVerificationFile(req, res, next) {
  try {
    const configuredCode = process.env.GOOGLE_SITE_VERIFICATION_FILE;
    const requestedFile = req.params.code; // e.g. "1234567890abcdef"

    if (!configuredCode) {
      return res.status(404).render('errors/404', { layout: false, title: 'Not found' });
    }

    if (requestedFile !== configuredCode) {
      return res.status(404).render('errors/404', { layout: false, title: 'Not found' });
    }

    res.set('Content-Type', 'text/plain');
    res.send(`google-site-verification: google${configuredCode}.html`);
  } catch (err) {
    next(err);
  }
}

module.exports = { getSitemap, getRobots, getGoogleVerificationFile };
