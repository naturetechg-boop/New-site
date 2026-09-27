const Article = require('../models/Article');
const Category = require('../models/Category');
const ContactMessage = require('../models/ContactMessage');
const { toPlainTextFromHtml } = require('../utils/markdown');

// IMPORTANT: this must be a function, not a plain object. A plain object
// would call `new Date()` only once, when the server process starts, and
// every published-article query afterwards would compare against that
// frozen boot-time timestamp forever - silently hiding every article
// published after the server started. Calling published() fresh in each
// query below evaluates `new Date()` at request time instead.
function published() {
  return { status: 'published', publishedAt: { $lte: new Date() } };
}

const ARTICLE_CARD_FIELDS =
  'title subtitle slug excerpt featuredImage author category tags readingTimeMinutes publishedAt isTrending isFeatured viewCount';

async function getHome(req, res, next) {
  try {
    const [featured, latest, trending] = await Promise.all([
      Article.findOne({ ...published(), isFeatured: true })
        .sort({ publishedAt: -1 })
        .select(ARTICLE_CARD_FIELDS)
        .populate('category', 'name slug')
        .lean(),
      Article.find(published())
        .sort({ publishedAt: -1 })
        .limit(7)
        .select(ARTICLE_CARD_FIELDS)
        .populate('category', 'name slug')
        .lean(),
      Article.find({ ...published(), isTrending: true })
        .sort({ publishedAt: -1 })
        .limit(res.locals.site.trendingCount)
        .select(ARTICLE_CARD_FIELDS)
        .populate('category', 'name slug')
        .lean()
    ]);

    // Featured falls back to the newest published article if none is marked featured.
    const heroArticle = featured || latest[0] || null;
    const latestExcludingHero = latest.filter(
      (a) => !heroArticle || String(a._id) !== String(heroArticle._id)
    );

    // Homepage category sections show whichever categories have the most
    // *recent* published articles - not just the first 4 alphabetically.
    // That way a newer or currently-active section (e.g. a "News" category
    // you just started publishing to) surfaces here on its own merit,
    // instead of being buried because its name starts later in the alphabet.
    const mostActiveCategoryIds = await Article.aggregate([
      { $match: published() },
      { $sort: { publishedAt: -1 } },
      { $group: { _id: '$category', mostRecentPublishedAt: { $first: '$publishedAt' } } },
      { $sort: { mostRecentPublishedAt: -1 } },
      { $limit: 4 }
    ]);

    const activeCategories = await Category.find({
      _id: { $in: mostActiveCategoryIds.map((c) => c._id) }
    }).lean();
    // Preserve the "most recent activity" order from the aggregation above,
    // since Category.find() does not guarantee to return results in $in order.
    const categoriesByRecentActivity = mostActiveCategoryIds
      .map((c) => activeCategories.find((cat) => String(cat._id) === String(c._id)))
      .filter(Boolean);

    const categorySections = await Promise.all(
      categoriesByRecentActivity.map(async (cat) => {
        const articles = await Article.find({ ...published(), category: cat._id })
          .sort({ publishedAt: -1 })
          .limit(3)
          .select(ARTICLE_CARD_FIELDS)
          .populate('category', 'name slug')
          .lean();
        return { category: cat, articles };
      })
    );

    res.render('public/home', {
      title: null, // use default site title on home
      metaDescription: res.locals.site.siteDescription,
      heroArticle,
      latestArticles: latestExcludingHero.slice(0, 6),
      trendingArticles: trending,
      categorySections: categorySections.filter((s) => s.articles.length > 0),
      canonicalPath: '/'
    });
  } catch (err) {
    next(err);
  }
}

async function getArticlesList(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = res.locals.site.articlesPerPage;

    const [articles, total] = await Promise.all([
      Article.find(published())
        .sort({ publishedAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .select(ARTICLE_CARD_FIELDS)
        .populate('category', 'name slug')
        .lean(),
      Article.countDocuments(published())
    ]);

    res.render('public/articles', {
      title: 'Articles',
      metaDescription: `Browse all articles from ${res.locals.site.siteName}.`,
      articles,
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      canonicalPath: '/articles'
    });
  } catch (err) {
    next(err);
  }
}

async function getArticleDetail(req, res, next) {
  try {
    const article = await Article.findOne({ slug: req.params.slug, ...published() })
      .populate('category', 'name slug')
      .populate('tags', 'name slug')
      .lean();

    if (!article) {
      return res.status(404).render('errors/404', { layout: false, title: 'Article not found' });
    }

    // Fire-and-forget view counter increment; do not block the response.
    Article.updateOne({ _id: article._id }, { $inc: { viewCount: 1 } }).catch(() => {});

    const related = await Article.find({
      ...published(),
      category: article.category._id,
      _id: { $ne: article._id }
    })
      .sort({ publishedAt: -1 })
      .limit(3)
      .select(ARTICLE_CARD_FIELDS)
      .populate('category', 'name slug')
      .lean();

    res.render('public/article', {
      title: article.seoTitle || article.title,
      metaDescription: article.seoDescription || article.excerpt || toPlainTextFromHtml(article.contentHtml),
      article,
      relatedArticles: related,
      canonicalPath: `/article/${article.slug}`,
      ogImage:
        (article.featuredImage && (article.featuredImage.url || (article.featuredImage.fileId ? `/media/${article.featuredImage.fileId}` : ''))) ||
        null
    });
  } catch (err) {
    next(err);
  }
}

async function getCategoryPage(req, res, next) {
  try {
    const category = await Category.findOne({ slug: req.params.slug }).lean();
    if (!category) {
      return res.status(404).render('errors/404', { layout: false, title: 'Category not found' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = res.locals.site.articlesPerPage;

    const [articles, total] = await Promise.all([
      Article.find({ ...published(), category: category._id })
        .sort({ publishedAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .select(ARTICLE_CARD_FIELDS)
        .populate('category', 'name slug')
        .lean(),
      Article.countDocuments({ ...published(), category: category._id })
    ]);

    res.render('public/category', {
      title: category.name,
      metaDescription: category.description || `Articles about ${category.name} from ${res.locals.site.siteName}.`,
      category,
      articles,
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      canonicalPath: `/category/${category.slug}`
    });
  } catch (err) {
    next(err);
  }
}

async function getSearch(req, res, next) {
  try {
    const query = (req.query.q || '').trim();
    let articles = [];

    if (query.length > 0) {
      articles = await Article.find({
        ...published(),
        $text: { $search: query }
      })
        .select(ARTICLE_CARD_FIELDS)
        .populate('category', 'name slug')
        .populate('tags', 'name slug')
        .limit(30)
        .lean();
    }

    res.render('public/search', {
      title: query ? `Search results for "${query}"` : 'Search',
      metaDescription: `Search articles on ${res.locals.site.siteName}.`,
      query,
      articles,
      canonicalPath: '/search',
      noIndex: true
    });
  } catch (err) {
    next(err);
  }
}

function getAbout(req, res) {
  res.render('public/about', {
    title: 'About',
    metaDescription: `Learn about ${res.locals.site.siteName} and our editorial mission.`,
    canonicalPath: '/about'
  });
}

function getContact(req, res) {
  res.render('public/contact', {
    title: 'Contact',
    metaDescription: `Get in touch with the ${res.locals.site.siteName} team.`,
    canonicalPath: '/contact',
    submitted: false
  });
}

async function postContact(req, res, next) {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).render('public/contact', {
        title: 'Contact',
        metaDescription: `Get in touch with the ${res.locals.site.siteName} team.`,
        canonicalPath: '/contact',
        submitted: false,
        error: 'Please fill in your name, email and message.'
      });
    }

    await ContactMessage.create({
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 200),
      subject: String(subject || 'General inquiry').slice(0, 200),
      message: String(message).slice(0, 5000)
    });

    res.render('public/contact', {
      title: 'Contact',
      metaDescription: `Get in touch with the ${res.locals.site.siteName} team.`,
      canonicalPath: '/contact',
      submitted: true
    });
  } catch (err) {
    next(err);
  }
}

function getPrivacyPolicy(req, res) {
  res.render('public/privacy', {
    title: 'Privacy Policy',
    metaDescription: 'How we collect, use and protect information on this website.',
    canonicalPath: '/privacy'
  });
}

function getTerms(req, res) {
  res.render('public/terms', {
    title: 'Terms & Disclaimer',
    metaDescription: 'Terms of use and editorial disclaimer.',
    canonicalPath: '/terms'
  });
}

module.exports = {
  getHome,
  getArticlesList,
  getArticleDetail,
  getCategoryPage,
  getSearch,
  getAbout,
  getContact,
  postContact,
  getPrivacyPolicy,
  getTerms
};