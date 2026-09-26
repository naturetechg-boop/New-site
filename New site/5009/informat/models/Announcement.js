const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    message: { type: String, required: true, trim: true },
    linkUrl: { type: String, trim: true, default: '' },
    linkText: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: false },
    style: {
      type: String,
      enum: ['info', 'announcement', 'warning'],
      default: 'info'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);
