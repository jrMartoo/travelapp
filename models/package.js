const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    destination: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: Number, required: true },
    image: { type: String, default: '' },
    category: { type: String, enum: ['safari', 'beach', 'mountain', 'cultural', 'city'], default: 'safari' },
    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    included: [String],
    available: { type: Boolean, default: true },
    maxGuests: { type: Number, default: 10 },
    featured: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Package', packageSchema);