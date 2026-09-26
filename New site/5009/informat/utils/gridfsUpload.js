const mongoose = require('mongoose');

/**
 * Streams a Buffer into MongoDB GridFS and resolves with the new file's
 * ObjectId. This writes through mongoose's own, already-established
 * connection (the same one every other query in the app uses), rather than
 * opening a second, separately-configured database connection the way the
 * old "multer-gridfs-storage" package did - which is what made uploads
 * unreliable in the first place.
 */
function uploadBufferToGridFS(buffer, originalFilename, contentType, bucketName = 'mediaFiles') {
  return new Promise((resolve, reject) => {
    if (!mongoose.connection || !mongoose.connection.db) {
      return reject(new Error('Database connection is not ready yet. Please try again in a moment.'));
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });
    const safeFilename = `${Date.now()}-${String(originalFilename || 'upload').replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    const uploadStream = bucket.openUploadStream(safeFilename, { contentType });

    uploadStream.on('error', (err) => reject(err));
    uploadStream.on('finish', () => resolve(uploadStream.id));

    uploadStream.end(buffer);
  });
}

module.exports = { uploadBufferToGridFS };