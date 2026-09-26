const mongoose = require('mongoose');

// Privacy note: we deliberately do NOT store IP addresses or any other
// direct identifier. "visitorHash" is a one-way, non-reversible hash
// (see utils/analytics.js) generated fresh each day, so the same visitor
// cannot be tracked across days and no raw personal data is retained.
const pageViewSchema = new mongoose.Schema(
  {
    path: { type: String, required: true, index: true },
    articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', default: null },
    country: { type: String, default: 'Unknown' },
    device: { type: String, enum: ['desktop', 'mobile', 'tablet', 'other'], default: 'other' },
    browser: { type: String, default: 'Unknown' },
    os: { type: String, default: 'Unknown' },
    referrerHost: { type: String, default: 'Direct' },
    visitorHash: { type: String, index: true },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: false }
);

pageViewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PageView', pageViewSchema);
