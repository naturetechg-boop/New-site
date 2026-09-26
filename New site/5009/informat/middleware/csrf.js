const crypto = require('crypto');

/**
 * Lightweight CSRF protection using the synchronizer token pattern,
 * tied to the server-side session (not a separate cookie), so it
 * works without the deprecated "csurf" package.
 *
 * - A token is generated per session and exposed to views as res.locals.csrfToken.
 * - State-changing requests (POST/PUT/PATCH/DELETE) must echo that token
 *   back in the request body as "_csrf".
 */
function csrfProtection(req, res, next) {
  if (!req.session) return next();

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  const methodsToCheck = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (methodsToCheck.includes(req.method)) {
    const submittedToken = (req.body && req.body._csrf) || req.get('X-CSRF-Token');
    if (!submittedToken || submittedToken !== req.session.csrfToken) {
      return res.status(403).render('errors/error', {
        layout: false,
        title: 'Request blocked',
        message:
          'Your session expired or the form was submitted incorrectly. Please go back and try again.',
        statusCode: 403
      });
    }
  }

  return next();
}

module.exports = csrfProtection;
