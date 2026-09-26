const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');

// IMPORTANT: Render's free plan uses an ephemeral filesystem - anything written
// to local disk is lost on every restart/redeploy. We store uploaded media
// inside MongoDB itself (GridFS) so images survive restarts and deploys.
const storage = new GridFsStorage({
  url: process.env.DATABASE_URL,
  file: (req, file) => {
    return {
      bucketName: 'mediaFiles',
      filename: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`,
      metadata: { uploadedBy: req.session ? req.session.userId : null }
    };
  }
});

storage.on('connectionFailed', (err) => {
  console.error('[upload] GridFS storage failed to connect:', err.message);
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per image
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP, GIF or SVG images are allowed.'));
    }
    return cb(null, true);
  }
});

module.exports = upload;
