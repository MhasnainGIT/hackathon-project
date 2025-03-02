const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: { type: String, default: null },
  likes: { type: Number, default: 0 },
  comments: { type: [String], default: [] },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Post', postSchema);