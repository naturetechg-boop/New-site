const Category = require('../models/Category');
const Announcement = require('../models/Announcement');
const Settings = require('../models/Settings');
const siteConfig = require('../config/site');

async function publicLocals(req, res, next) {
  try {
    const [categories, announcement, settings] = await Promise.all([
      Category.find().sort({ name: 1 }).lean(),
      Announcement.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean(),
      Settings.getSingleton()
    ]);

    res.locals.site = {
      ...siteConfig,
      siteName: settings.siteName || siteConfig.siteName,
      tagline: settings.tagline || siteConfig.tagline,
      contactEmail: settings.contactEmail || siteConfig.contactEmail,
      socialLinks: {
        twitter: settings.socialTwitter || siteConfig.socialLinks.twitter,
        facebook: settings.socialFacebook || siteConfig.socialLinks.facebook,
        linkedin: settings.socialLinkedin || siteConfig.socialLinks.linkedin
      },
      googleSiteVerificationMeta:
        settings.googleSiteVerificationMeta || process.env.GOOGLE_SITE_VERIFICATION_META || ''
    };
    res.locals.navCategories = categories;
    res.locals.activeAnnouncement = announcement;
    res.locals.currentPath = req.path;
    res.locals.settingsDoc = settings;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = publicLocals;
