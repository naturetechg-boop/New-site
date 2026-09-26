const mongoose = require('mongoose');
const Article = require('../models/Article');
const Category = require('../models/Category');
const Tag = require('../models/Tag');
const Announcement = require('../models/Announcement');
const ContactMessage = require('../models/ContactMessage');
const Settings = require('../models/Settings');
const PageView = require('../models/PageView');
const slugify = require('../utils/slugify');
const estimateReadingTime = require('../utils/readingTime');
const { renderMarkdownToSafeHtml, toPlainText } = require('../utils/markdown');

const ADMIN_LAYOUT = 'layouts/admin';

async function generateUniqueSlug(Model, baseText, excludeId = null) {
  const base = slugify(baseText) || 'untitled';
  let slug = base;
  let counter = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    // eslint-disable-next-line no-await-in-loop
    const existing = await Model.findOne(query).select('_id').lean();
    if (!existing) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
}

async function findOrCreateTags(tagNamesRaw) {
  const names = String(tagNamesRaw || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const tagIds = [];
  for (const name of names) {
    const slug = slugify(name);
    if (!slug) continue;
    // eslint-disable-next-line no-await-in-loop
    let tag = await Tag.findOne({ slug });
    if (!tag) {
      // eslint-disable-next-line no-await-in-loop
      tag = await Tag.create({ name, slug });
    }
    tagIds.push(tag._id);
  }
  return tagIds;
}

// ---------- DASHBOARD ----------

async function getDashboard(req, res, next) {
  try {
    const [totalArticles, published, drafts, trendingCount, totalCategories, unreadMessages, recentArticles, topArticles] =
      await Promise.all([
        Article.countDocuments(),
        Article.countDocuments({ status: 'published' }),
        Article.countDocuments({ status: 'draft' }),
        Article.countDocuments({ isTrending: true }),
        Category.countDocuments(),
        ContactMessage.countDocuments({ isRead: false }),
        Article.find().sort({ updatedAt: -1 }).limit(5).populate('category', 'name').lean(),
        Article.find({ status: 'published' })
          .sort({ viewCount: -1 })
          .limit(5)
          .select('title slug viewCount')
          .lean()
      ]);

    const pageViewsLast30Days = await PageView.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    res.render('admin/dashboard', {
      title: 'Dashboard',
      layout: ADMIN_LAYOUT,
      stats: {
        totalArticles,
        published,
        drafts,
        trendingCount,
        totalCategories,
        unreadMessages,
        pageViewsLast30Days
      },
      recentArticles,
      topArticles
    });
  } catch (err) {
    next(err);
  }
}

// ---------- ARTICLES ----------

async function getArticlesList(req, res, next) {
  try {
    const statusFilter = req.query.status;
    const filter = statusFilter && ['draft', 'published', 'scheduled'].includes(statusFilter) ? { status: statusFilter } : {};

    const articles = await Article.find(filter)
      .sort({ updatedAt: -1 })
      .populate('category', 'name')
      .select('title slug status isTrending isFeatured publishedAt updatedAt viewCount category')
      .lean();

    res.render('admin/articles-list', {
      title: 'Articles',
      layout: ADMIN_LAYOUT,
      articles,
      statusFilter: statusFilter || 'all'
    });
  } catch (err) {
    next(err);
  }
}

async function getArticleForm(req, res, next) {
  try {
    const [categories, tags] = await Promise.all([
      Category.find().sort({ name: 1 }).lean(),
      Tag.find().sort({ name: 1 }).lean()
    ]);

    let article = null;
    if (req.params.id) {
      article = await Article.findById(req.params.id).populate('tags', 'name').lean();
      if (!article) {
        return res.status(404).render('errors/404', { layout: false, title: 'Article not found' });
      }
    }

    res.render('admin/article-form', {
      title: article ? 'Edit Article' : 'New Article',
      layout: ADMIN_LAYOUT,
      article,
      categories,
      tags,
      tagsValue: article && article.tags ? article.tags.map((t) => t.name).join(', ') : '',
      error: null
    });
  } catch (err) {
    next(err);
  }
}

function parseArticleBody(body) {
  return {
    title: String(body.title || '').trim(),
    subtitle: String(body.subtitle || '').trim(),
    contentMarkdown: String(body.contentMarkdown || ''),
    excerpt: String(body.excerpt || '').trim(),
    author: String(body.author || 'Staff Writer').trim(),
    category: body.category,
    featuredImageUrl: String(body.featuredImageUrl || '').trim(),
    featuredImageAlt: String(body.featuredImageAlt || '').trim(),
    seoTitle: String(body.seoTitle || '').trim(),
    seoDescription: String(body.seoDescription || '').trim(),
    isTrending: body.isTrending === 'on' || body.isTrending === 'true',
    isFeatured: body.isFeatured === 'on' || body.isFeatured === 'true',
    status: ['draft', 'published', 'scheduled'].includes(body.status) ? body.status : 'draft',
    customSlug: String(body.slug || '').trim(),
    scheduledFor: body.scheduledFor || null
  };
}

async function postCreateArticle(req, res, next) {
  try {
    const data = parseArticleBody(req.body);
    const categories = await Category.find().sort({ name: 1 }).lean();

    if (!data.title || !data.contentMarkdown || !data.category) {
      return res.status(400).render('admin/article-form', {
        title: 'New Article',
        layout: ADMIN_LAYOUT,
        article: { ...data, slug: data.customSlug, featuredImage: { url: data.featuredImageUrl, altText: data.featuredImageAlt } },
        categories,
        tags: await Tag.find().sort({ name: 1 }).lean(),
        tagsValue: req.body.tags || '',
        error: 'Title, content and category are required.'
      });
    }

    const categoryDoc = await Category.findById(data.category);
    if (!categoryDoc) {
      return res.status(400).render('admin/article-form', {
        title: 'New Article',
        layout: ADMIN_LAYOUT,
        article: { ...data, slug: data.customSlug, featuredImage: { url: data.featuredImageUrl, altText: data.featuredImageAlt } },
        categories,
        tags: await Tag.find().sort({ name: 1 }).lean(),
        tagsValue: req.body.tags || '',
        error: 'Please choose a valid category.'
      });
    }

    const slug = await generateUniqueSlug(Article, data.customSlug || data.title);
    const tagIds = await findOrCreateTags(req.body.tags);
    const contentHtml = renderMarkdownToSafeHtml(data.contentMarkdown);

    const now = new Date();
    const article = new Article({
      title: data.title,
      subtitle: data.subtitle,
      slug,
      contentMarkdown: data.contentMarkdown,
      contentHtml,
      excerpt: data.excerpt || toPlainText(data.contentMarkdown, 200),
      author: data.author,
      category: categoryDoc._id,
      tags: tagIds,
      readingTimeMinutes: estimateReadingTime(data.contentMarkdown),
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      isTrending: data.isTrending,
      isFeatured: data.isFeatured,
      status: data.status,
      featuredImage: { url: data.featuredImageUrl, altText: data.featuredImageAlt, fileId: null }
    });

    if (req.body.featuredImageFileId) {
      article.featuredImage.fileId = req.body.featuredImageFileId;
    }

    if (data.status === 'published') {
      article.publishedAt = now;
    } else if (data.status === 'scheduled' && data.scheduledFor) {
      article.scheduledFor = new Date(data.scheduledFor);
    }

    await article.save();
    res.redirect('/admin/articles');
  } catch (err) {
    next(err);
  }
}

async function postUpdateArticle(req, res, next) {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).render('errors/404', { layout: false, title: 'Article not found' });
    }

    const data = parseArticleBody(req.body);

    if (!data.title || !data.contentMarkdown || !data.category) {
      const categories = await Category.find().sort({ name: 1 }).lean();
      return res.status(400).render('admin/article-form', {
        title: 'Edit Article',
        layout: ADMIN_LAYOUT,
        article: { ...article.toObject(), ...data, _id: article._id },
        categories,
        tags: await Tag.find().sort({ name: 1 }).lean(),
        tagsValue: req.body.tags || '',
        error: 'Title, content and category are required.'
      });
    }

    if (data.customSlug && data.customSlug !== article.slug) {
      article.slug = await generateUniqueSlug(Article, data.customSlug, article._id);
    }

    const wasPublished = article.status === 'published';

    article.title = data.title;
    article.subtitle = data.subtitle;
    article.contentMarkdown = data.contentMarkdown;
    article.contentHtml = renderMarkdownToSafeHtml(data.contentMarkdown);
    article.excerpt = data.excerpt || toPlainText(data.contentMarkdown, 200);
    article.author = data.author;
    article.category = data.category;
    article.tags = await findOrCreateTags(req.body.tags);
    article.readingTimeMinutes = estimateReadingTime(data.contentMarkdown);
    article.seoTitle = data.seoTitle;
    article.seoDescription = data.seoDescription;
    article.isTrending = data.isTrending;
    article.isFeatured = data.isFeatured;
    article.status = data.status;
    article.featuredImage.url = data.featuredImageUrl;
    article.featuredImage.altText = data.featuredImageAlt;
    if (req.body.featuredImageFileId) {
      article.featuredImage.fileId = req.body.featuredImageFileId;
    }

    if (data.status === 'published' && !wasPublished) {
      article.publishedAt = new Date();
    }
    if (data.status === 'scheduled' && data.scheduledFor) {
      article.scheduledFor = new Date(data.scheduledFor);
    }

    await article.save();
    res.redirect('/admin/articles');
  } catch (err) {
    next(err);
  }
}

async function postDeleteArticle(req, res, next) {
  try {
    await Article.findByIdAndDelete(req.params.id);
    res.redirect('/admin/articles');
  } catch (err) {
    next(err);
  }
}

async function postToggleTrending(req, res, next) {
  try {
    const article = await Article.findById(req.params.id);
    if (article) {
      article.isTrending = !article.isTrending;
      await article.save();
    }
    res.redirect(req.get('Referrer') || '/admin/trending');
  } catch (err) {
    next(err);
  }
}

async function postSetStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['draft', 'published'].includes(status)) {
      return res.status(400).redirect('/admin/articles');
    }
    const article = await Article.findById(req.params.id);
    if (article) {
      article.status = status;
      if (status === 'published' && !article.publishedAt) {
        article.publishedAt = new Date();
      }
      await article.save();
    }
    res.redirect('/admin/articles');
  } catch (err) {
    next(err);
  }
}

async function getTrendingPage(req, res, next) {
  try {
    const articles = await Article.find({ status: 'published' })
      .sort({ isTrending: -1, publishedAt: -1 })
      .populate('category', 'name')
      .select('title slug isTrending publishedAt viewCount category')
      .lean();

    res.render('admin/trending', {
      title: 'Trending Articles',
      layout: ADMIN_LAYOUT,
      articles
    });
  } catch (err) {
    next(err);
  }
}

// ---------- CATEGORIES ----------

async function getCategories(req, res, next) {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    const counts = await Article.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

    res.render('admin/categories', {
      title: 'Categories',
      layout: ADMIN_LAYOUT,
      categories: categories.map((c) => ({ ...c, articleCount: countMap[String(c._id)] || 0 })),
      error: null
    });
  } catch (err) {
    next(err);
  }
}

async function postCreateCategory(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.redirect('/admin/categories');

    const existing = await Category.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existing) {
      const categories = await Category.find().sort({ name: 1 }).lean();
      return res.status(400).render('admin/categories', {
        title: 'Categories',
        layout: ADMIN_LAYOUT,
        categories,
        error: 'A category with that name already exists.'
      });
    }

    const slug = await generateUniqueSlug(Category, name);
    await Category.create({ name, slug, description: String(req.body.description || '').trim() });
    res.redirect('/admin/categories');
  } catch (err) {
    next(err);
  }
}

async function postUpdateCategory(req, res, next) {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.redirect('/admin/categories');

    const name = String(req.body.name || '').trim();
    if (name && name !== category.name) {
      category.name = name;
      category.slug = await generateUniqueSlug(Category, name, category._id);
    }
    category.description = String(req.body.description || '').trim();
    await category.save();
    res.redirect('/admin/categories');
  } catch (err) {
    next(err);
  }
}

async function postDeleteCategory(req, res, next) {
  try {
    const inUse = await Article.countDocuments({ category: req.params.id });
    if (inUse > 0) {
      const categories = await Category.find().sort({ name: 1 }).lean();
      return res.status(400).render('admin/categories', {
        title: 'Categories',
        layout: ADMIN_LAYOUT,
        categories,
        error: `Cannot delete: ${inUse} article(s) still use this category. Reassign them first.`
      });
    }
    await Category.findByIdAndDelete(req.params.id);
    res.redirect('/admin/categories');
  } catch (err) {
    next(err);
  }
}

// ---------- MEDIA ----------

async function getMediaLibrary(req, res, next) {
  try {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'mediaFiles' });
    const files = await bucket.find({}).sort({ uploadDate: -1 }).toArray();

    res.render('admin/media', {
      title: 'Media Library',
      layout: ADMIN_LAYOUT,
      files,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
}

function postUploadMedia(req, res) {
  // multer + GridFsStorage has already stored the file by the time we get here.
  res.redirect('/admin/media');
}

async function postDeleteMedia(req, res, next) {
  try {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'mediaFiles' });
    await bucket.delete(new mongoose.Types.ObjectId(req.params.id));
    res.redirect('/admin/media');
  } catch (err) {
    next(err);
  }
}

// ---------- ANNOUNCEMENTS ----------

async function getAnnouncements(req, res, next) {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 }).lean();
    res.render('admin/announcements', {
      title: 'Announcements',
      layout: ADMIN_LAYOUT,
      announcements
    });
  } catch (err) {
    next(err);
  }
}

async function postCreateAnnouncement(req, res, next) {
  try {
    const { message, linkUrl, linkText, style } = req.body;
    if (!message || !String(message).trim()) return res.redirect('/admin/announcements');

    if (req.body.makeActive === 'on') {
      await Announcement.updateMany({}, { isActive: false });
    }

    await Announcement.create({
      message: String(message).trim(),
      linkUrl: String(linkUrl || '').trim(),
      linkText: String(linkText || '').trim(),
      style: ['info', 'announcement', 'warning'].includes(style) ? style : 'info',
      isActive: req.body.makeActive === 'on'
    });
    res.redirect('/admin/announcements');
  } catch (err) {
    next(err);
  }
}

async function postToggleAnnouncement(req, res, next) {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.redirect('/admin/announcements');

    const activating = !announcement.isActive;
    if (activating) {
      // Only one announcement banner is shown at a time.
      await Announcement.updateMany({}, { isActive: false });
    }
    announcement.isActive = activating;
    await announcement.save();
    res.redirect('/admin/announcements');
  } catch (err) {
    next(err);
  }
}

async function postDeleteAnnouncement(req, res, next) {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.redirect('/admin/announcements');
  } catch (err) {
    next(err);
  }
}

// ---------- ANALYTICS ----------

async function getAnalytics(req, res, next) {
  try {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalViews30d, byDay, byCountry, byDevice, byBrowser, byOs, topArticles, byReferrer, uniqueVisitors30d] =
      await Promise.all([
        PageView.countDocuments({ createdAt: { $gte: since30 } }),
        PageView.aggregate([
          { $match: { createdAt: { $gte: since30 } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),
        PageView.aggregate([
          { $match: { createdAt: { $gte: since30 } } },
          { $group: { _id: '$country', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 }
        ]),
        PageView.aggregate([
          { $match: { createdAt: { $gte: since30 } } },
          { $group: { _id: '$device', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        PageView.aggregate([
          { $match: { createdAt: { $gte: since30 } } },
          { $group: { _id: '$browser', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 6 }
        ]),
        PageView.aggregate([
          { $match: { createdAt: { $gte: since30 } } },
          { $group: { _id: '$os', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 6 }
        ]),
        Article.find({ status: 'published' }).sort({ viewCount: -1 }).limit(8).select('title slug viewCount').lean(),
        PageView.aggregate([
          { $match: { createdAt: { $gte: since30 } } },
          { $group: { _id: '$referrerHost', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 }
        ]),
        PageView.distinct('visitorHash', { createdAt: { $gte: since30 } })
      ]);

    const totalForPercentage = byCountry.reduce((sum, c) => sum + c.count, 0);
    const byCountryWithPercent = byCountry.map((c) => ({
      country: c._id || 'Unknown',
      count: c.count,
      percent: totalForPercentage > 0 ? Math.round((c.count / totalForPercentage) * 100) : 0
    }));

    res.render('admin/analytics', {
      title: 'Analytics',
      layout: ADMIN_LAYOUT,
      hasData: totalViews30d > 0,
      totalViews30d,
      uniqueVisitors30d: uniqueVisitors30d.length,
      byDay,
      byCountry: byCountryWithPercent,
      byDevice,
      byBrowser,
      byOs,
      byReferrer,
      topArticles
    });
  } catch (err) {
    next(err);
  }
}

// ---------- SETTINGS ----------

async function getSettings(req, res, next) {
  try {
    const settings = await Settings.getSingleton();
    res.render('admin/settings', {
      title: 'Settings',
      layout: ADMIN_LAYOUT,
      settings,
      saved: false
    });
  } catch (err) {
    next(err);
  }
}

async function postUpdateSettings(req, res, next) {
  try {
    const settings = await Settings.getSingleton();
    const fields = [
      'siteName',
      'tagline',
      'googleSiteVerificationMeta',
      'contactEmail',
      'aboutContent',
      'socialTwitter',
      'socialFacebook',
      'socialLinkedin'
    ];
    fields.forEach((field) => {
      if (typeof req.body[field] === 'string') {
        settings[field] = req.body[field].trim();
      }
    });
    await settings.save();

    res.render('admin/settings', {
      title: 'Settings',
      layout: ADMIN_LAYOUT,
      settings,
      saved: true
    });
  } catch (err) {
    next(err);
  }
}

// ---------- MESSAGES ----------

async function getMessages(req, res, next) {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 }).lean();
    res.render('admin/messages', {
      title: 'Messages',
      layout: ADMIN_LAYOUT,
      messages
    });
  } catch (err) {
    next(err);
  }
}

async function postMarkMessageRead(req, res, next) {
  try {
    await ContactMessage.findByIdAndUpdate(req.params.id, { isRead: true });
    res.redirect('/admin/messages');
  } catch (err) {
    next(err);
  }
}

async function postDeleteMessage(req, res, next) {
  try {
    await ContactMessage.findByIdAndDelete(req.params.id);
    res.redirect('/admin/messages');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateUniqueSlug,
  findOrCreateTags,
  getDashboard,
  getArticlesList,
  getArticleForm,
  postCreateArticle,
  postUpdateArticle,
  postDeleteArticle,
  postToggleTrending,
  postSetStatus,
  getTrendingPage,
  getCategories,
  postCreateCategory,
  postUpdateCategory,
  postDeleteCategory,
  getMediaLibrary,
  postUploadMedia,
  postDeleteMedia,
  getAnnouncements,
  postCreateAnnouncement,
  postToggleAnnouncement,
  postDeleteAnnouncement,
  getAnalytics,
  getSettings,
  postUpdateSettings,
  getMessages,
  postMarkMessageRead,
  postDeleteMessage
};
