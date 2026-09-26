const mongoose = require('mongoose');

async function getMedia(req, res, next) {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'mediaFiles'
    });

    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).render('errors/404', { layout: false, title: 'Image not found' });
    }

    const file = files[0];
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.on('error', () => res.status(404).end());
    downloadStream.pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { getMedia };
