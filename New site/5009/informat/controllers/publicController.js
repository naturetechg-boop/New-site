const Article = require('../models/Article');
const Category = require('../models/Category');
const ContactMessage = require('../models/ContactMessage');
const { toPlainText } = require('../utils/markdown');

const PUBLISHED = { status: 'published', publishedAt: { $lte: new Date() } };

const ARTICLE_CARD_FIELDS =
  'title subtitle slug excerpt featuredImage author category tags readingTimeMinutes publishedAt isTrending isFeatured viewCount';

async function getHome(req, res, next) {
  try {
    const [featured, latest, trending, categories] = await Promise.all([
      Article.findOne({ ...PUBLISHED, isFeatured: true })
        .sort({ publishedAt: -1 })
        .select(ARTICLE_CARD_FIELDS)
        .populate('category', 'name slug')
        .lean(),
      Article.find(PUBLISHED)
        .sort({ publishedAt: -1 })
        .limit(7)
        .select(ARTICLE_CARD_FIELDS)
        .populate('category', 'name slug')
        .lean(),
      Article.find({ ...PUBLISHED, isTrending: true })
        .sort({ publishedAt: -1 })
        .limit(res.locals.site.trendingCount)
        .select(ARTICLE_CARD_FIELDS)
        .populate('category', 'name slug')
        .lean(),
      Category.find().sort({ name: 1 }).lean()
    ]);

    // Featured falls back to the newest published article if none is marked featured.
    const heroArticle = featured || latest[0] || null;
    const latestExcludingHero = latest.filter(
      (a) => !heroArticle || String(a._id) !== String(heroArticle._id)
    );

    const categorySections = await Promise.all(
      categories.slice(0, 4).map(async (cat) => {
        const articles = await Article.find({ ...PUBLISHED, category: cat._id })
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
      Article.find(PUBLISHED)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .select(ARTICLE_CARD_FIELDS)
        .populate('category', 'name slug')
        .lean(),
      Article.countDocuments(PUBLISHED)
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
    const article = await Article.findOne({ slug: req.params.slug, ...PUBLISHED })
      .populate('category', 'name slug')
      .populate('tags', 'name slug')
      .lean();

    if (!article) {
      return res.status(404).render('errors/404', { layout: false, title: 'Article not found' });
    }

    // Fire-and-forget view counter increment; do not block the response.
    Article.updateOne({ _id: article._id }, { $inc: { viewCount: 1 } }).catch(() => {});

    const related = await Article.find({
      ...PUBLISHED,
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
      metaDescription: article.seoDescription || article.excerpt || toPlainText(article.contentMarkdown),
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
      Article.find({ ...PUBLISHED, category: category._id })
        .sort({ publishedAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .select(ARTICLE_CARD_FIELDS)
        .populate('category', 'name slug')
        .lean(),
      Article.countDocuments({ ...PUBLISHED, category: category._id })
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
        ...PUBLISHED,
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
