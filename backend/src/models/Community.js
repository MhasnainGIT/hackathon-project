const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: { type: String, default: null },
  likes: { type: Number, default: 0 },
  comments: { type: [String], default: [] },
  timestamp: { type: Date, default: Date.now },
});

const communitySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  posts: [postSchema],
  type: { type: String, enum: ['Global', 'Local'], required: true },
  location: { type: String, default: null },
});

module.exports = mongoose.model('Community', communitySchema);
