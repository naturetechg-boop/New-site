const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const { requireAuth, redirectIfAuthenticated } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/security');
const upload = require('../middleware/upload');
const { verifyCsrfAfterUpload } = require('../middleware/csrf');

// ---- Auth (public within /admin) ----
router.get('/login', redirectIfAuthenticated, authController.getLogin);
router.post('/login', loginLimiter, redirectIfAuthenticated, authController.postLogin);
router.post('/logout', authController.postLogout);

// ---- First-run web setup (public, token-protected, self-disables after first admin exists) ----
router.get('/setup', loginLimiter, authController.getSetup);
router.post('/setup', loginLimiter, authController.postSetup);

// ---- Everything below requires a logged-in session ----
router.use(requireAuth);

router.get('/', adminController.getDashboard);

// Account / password management
router.get('/account', authController.getAccount);
router.post('/account/password', authController.postChangePassword);

// Articles
router.get('/articles', adminController.getArticlesList);
router.get('/articles/new', adminController.getArticleForm);
router.post(
  '/articles',
  (req, res, next) => {
    upload.single('featuredImageFile')(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  },
  verifyCsrfAfterUpload,
  adminController.postCreateArticle
);

// AJAX endpoint used by the article editor to upload a featured image inline.
// IMPORTANT: this static route must be registered BEFORE the "/articles/:id"
// param route below, or Express would treat "upload-image" as an :id value.
router.post(
  '/articles/upload-image',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  verifyCsrfAfterUpload,
  adminController.postUploadArticleImage
);

router.get('/articles/:id/edit', adminController.getArticleForm);
router.post(
  '/articles/:id',
  (req, res, next) => {
    upload.single('featuredImageFile')(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  },
  verifyCsrfAfterUpload,
  adminController.postUpdateArticle
);
router.post('/articles/:id/delete', adminController.postDeleteArticle);
router.post('/articles/:id/toggle-trending', adminController.postToggleTrending);
router.post('/articles/:id/status', adminController.postSetStatus);

// Trending
router.get('/trending', adminController.getTrendingPage);

// Categories
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.postCreateCategory);
router.post('/categories/:id', adminController.postUpdateCategory);
router.post('/categories/:id/delete', adminController.postDeleteCategory);

// Media library
router.get('/media', adminController.getMediaLibrary);
router.post('/media/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.redirect(`/admin/media?error=${encodeURIComponent(err.message)}`);
    next();
  });
}, verifyCsrfAfterUpload, adminController.postUploadMedia);
router.post('/media/:id/delete', adminController.postDeleteMedia);

// Announcements
router.get('/announcements', adminController.getAnnouncements);
router.post('/announcements', adminController.postCreateAnnouncement);
router.post('/announcements/:id/toggle', adminController.postToggleAnnouncement);
router.post('/announcements/:id/delete', adminController.postDeleteAnnouncement);

// Analytics
router.get('/analytics', adminController.getAnalytics);

// Settings
router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.postUpdateSettings);

// Messages
router.get('/messages', adminController.getMessages);
router.post('/messages/:id/read', adminController.postMarkMessageRead);
router.post('/messages/:id/delete', adminController.postDeleteMessage);

module.exports = router;