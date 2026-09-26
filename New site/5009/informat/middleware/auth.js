function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  req.session.flashError = 'Please log in to continue.';
  return res.redirect('/admin/login');
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/admin');
  }
  return next();
}

module.exports = { requireAuth, redirectIfAuthenticated };
