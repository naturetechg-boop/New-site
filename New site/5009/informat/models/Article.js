const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true, default: '' },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },

    // Markdown source, written by the admin in the editor.
    contentMarkdown: { type: String, required: true },
    // Sanitized HTML rendered from contentMarkdown, generated on save.
    contentHtml: { type: String, required: true },

    excerpt: { type: String, trim: true, default: '' },

    // Featured image: either an uploaded file (served via /media/:id) or an external URL.
    featuredImage: {
      fileId: { type: mongoose.Schema.Types.ObjectId, default: null },
      url: { type: String, default: '' },
      altText: { type: String, default: '' }
    },

    author: { type: String, required: true, trim: true, default: 'Staff Writer' },

    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],

    readingTimeMinutes: { type: Number, default: 1 },

    seoTitle: { type: String, trim: true, default: '' },
    seoDescription: { type: String, trim: true, default: '' },

    isTrending: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ['draft', 'published', 'scheduled'],
      default: 'draft',
      index: true
    },
    publishedAt: { type: Date, default: null },
    scheduledFor: { type: Date, default: null },

    viewCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ title: 'text', contentMarkdown: 'text', excerpt: 'text' });

articleSchema.virtual('url').get(function getUrl() {
  return `/article/${this.slug}`;
});

articleSchema.set('toJSON', { virtuals: true });
articleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Article', articleSchema);
