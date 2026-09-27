const crypto = require('crypto');

/**
 * Lightweight CSRF protection using the synchronizer token pattern,
 * tied to the server-side session (not a separate cookie), so it
 * works without the deprecated "csurf" package.
 *
 * - A token is generated per session and exposed to views as res.locals.csrfToken.
 * - State-changing requests (POST/PUT/PATCH/DELETE) must echo that token
 *   back in the request body as "_csrf".
 *
 * IMPORTANT: file-upload forms use "multipart/form-data", and Express does
 * not parse that body format until a specific upload-handling step runs
 * later, on a per-route basis (see middleware/upload.js). That means
 * req.body._csrf is not readable yet at this point in the pipeline for
 * those requests. Rather than blocking every upload, this middleware skips
 * multipart requests here and lets the affected routes verify the token
 * themselves afterward, via verifyCsrfAfterUpload below.
 */
function csrfProtection(req, res, next) {
  if (!req.session) return next();

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  const methodsToCheck = ['POST', 'PUT', 'PATCH', 'DELETE'];
  const contentType = req.get('Content-Type') || '';
  const isMultipart = contentType.startsWith('multipart/form-data');

  if (methodsToCheck.includes(req.method) && !isMultipart) {
    const submittedToken = (req.body && req.body._csrf) || req.get('X-CSRF-Token');
    if (!submittedToken || submittedToken !== req.session.csrfToken) {
      return sendBlockedResponse(res);
    }
  }

  return next();
}

function sendBlockedResponse(res) {
  return res.status(403).render('errors/error', {
    layout: false,
    title: 'Request blocked',
    message: 'Your session expired or the form was submitted incorrectly. Please go back and try again.',
    statusCode: 403
  });
}

/**
 * For routes that accept multipart/form-data (file uploads): mount this
 * AFTER the route's multer middleware, so req.body._csrf has actually been
 * parsed out and is available to check by the time this runs.
 */
function verifyCsrfAfterUpload(req, res, next) {
  if (!req.session) return next();
  const submittedToken = (req.body && req.body._csrf) || req.get('X-CSRF-Token');
  if (!submittedToken || submittedToken !== req.session.csrfToken) {
    return sendBlockedResponse(res);
  }
  return next();
}

module.exports = csrfProtection;
module.exports.verifyCsrfAfterUpload = verifyCsrfAfterUpload;