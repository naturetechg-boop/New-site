function notFoundHandler(req, res) {
  res.status(404).render('errors/404', { layout: false, title: 'Page not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[error]', err.stack || err.message || err);

  const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;

  res.status(statusCode).render('errors/error', {
    layout: false,
    title: statusCode === 500 ? 'Something went wrong' : 'Error',
    message:
      statusCode === 500
        ? 'An unexpected error occurred on our end. Please try again shortly.'
        : err.message || 'An error occurred.',
    statusCode
  });
}

module.exports = { notFoundHandler, errorHandler };
