const express = require('express');
const router = express.Router();

const publicController = require('../controllers/publicController');
const seoController = require('../controllers/seoController');
const mediaController = require('../controllers/mediaController');
const trackPageView = require('../middleware/trackPageView');
const { formLimiter } = require('../middleware/security');

router.get('/', trackPageView(), publicController.getHome);
router.get('/articles', trackPageView(), publicController.getArticlesList);
router.get('/article/:slug', trackPageView(), publicController.getArticleDetail);
router.get('/category/:slug', trackPageView(), publicController.getCategoryPage);
router.get('/search', trackPageView(), publicController.getSearch);
router.get('/about', trackPageView(), publicController.getAbout);
router.get('/contact', trackPageView(), publicController.getContact);
router.post('/contact', formLimiter, publicController.postContact);
router.get('/privacy', publicController.getPrivacyPolicy);
router.get('/terms', publicController.getTerms);

router.get('/sitemap.xml', seoController.getSitemap);
router.get('/robots.txt', seoController.getRobots);
router.get('/google:code.html', seoController.getGoogleVerificationFile);

router.get('/media/:id', mediaController.getMedia);

module.exports = router;
