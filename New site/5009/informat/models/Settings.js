const mongoose = require('mongoose');

// Single-document collection holding admin-editable site settings.
const settingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'main', unique: true },
    siteName: { type: String, default: '' }, // empty = fall back to config/site.js default
    tagline: { type: String, default: '' },
    googleSiteVerificationMeta: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    aboutContent: { type: String, default: '' },
    socialTwitter: { type: String, default: '' },
    socialFacebook: { type: String, default: '' },
    socialLinkedin: { type: String, default: '' }
  },
  { timestamps: true }
);

settingsSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne({ singleton: 'main' });
  if (!doc) {
    doc = await this.create({ singleton: 'main' });
  }
  return doc;
};

module.exports = mongoose.model('Settings', settingsSchema);
