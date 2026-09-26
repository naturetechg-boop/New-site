const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tag', tagSchema);
