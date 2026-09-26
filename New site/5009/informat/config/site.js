// ==========================================================
// CENTRAL SITE CONFIGURATION
// Change the site name / tagline / defaults here in ONE place.
// ==========================================================

module.exports = {
  siteName: process.env.SITE_NAME || 'Informat',
  tagline: process.env.SITE_TAGLINE || 'Clear-eyed reporting on markets, money and technology.',
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  siteDescription:
    'Informat covers forex, crypto, finance, business and technology with original reporting and analysis.',
  defaultOgImage: '/images/og-default.svg',
  articlesPerPage: 9,
  trendingCount: 5,
  socialLinks: {
    twitter: '',
    facebook: '',
    linkedin: ''
  },
  contactEmail: process.env.CONTACT_EMAIL || 'hello@example.com',
  footerCategories: ['forex', 'crypto', 'finance', 'technology', 'business', 'markets']
};
