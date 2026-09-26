const multer = require('multer');

// IMPORTANT: we deliberately do NOT use the "multer-gridfs-storage" package
// here. That package is effectively unmaintained and is known to silently
// fail to persist files when paired with modern MongoDB driver versions
// (the kind bundled with current Mongoose releases and used by MongoDB
// Atlas) - uploads can appear to succeed in the browser while nothing is
// actually written to the database. Instead, multer holds the file briefly
// in memory, and the route/controller handling the upload streams it into
// MongoDB GridFS directly via utils/gridfsUpload.js, using the app's own
// existing Mongoose connection. This avoids a second, separately-configured
// database connection entirely.
//
// Files are NOT written to local disk at any point - Render's free plan
// wipes local disk on every restart/redeploy, which is exactly why GridFS
// (inside the database itself) is used for persistence instead.

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per image
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP, GIF or SVG images are allowed.'));
    }
    return cb(null, true);
  }
});

module.exports = upload;