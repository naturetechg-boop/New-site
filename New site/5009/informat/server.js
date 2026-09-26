require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const expressLayouts = require('express-ejs-layouts');
const compression = require('compression');

const connectDatabase = require('./config/database');
const seedDefaultCategories = require('./utils/seedDefaults');
const siteConfig = require('./config/site');
const { buildHelmet, cspNonceMiddleware, generalLimiter } = require('./middleware/security');
const csrfProtection = require('./middleware/csrf');
const publicLocals = require('./middleware/publicLocals');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();

// Render sits behind a reverse proxy (for correct client IPs / secure cookies).
app.set('trust proxy', 1);

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// ---------- Core middleware ----------
app.use(compression());
app.use(cspNonceMiddleware);
app.use(buildHelmet());
app.use(generalLimiter);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

async function start() {
  await connectDatabase();
  await seedDefaultCategories();

  app.use(
    session({
      name: 'informat.sid',
      secret: process.env.SESSION_SECRET || 'change-this-secret-in-.env',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: process.env.DATABASE_URL, collectionName: 'sessions' }),
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
      }
    })
  );

  app.use(csrfProtection);

  // Shared data (site name, nav categories, active announcement) for public pages.
  app.use((req, res, next) => {
    if (req.path.startsWith('/admin')) return next();
    return publicLocals(req, res, next);
  });

  app.use('/admin', adminRoutes);
  app.use('/', publicRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`[server] ${siteConfig.siteName} running on port ${port}`);
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});

module.exports = app;
