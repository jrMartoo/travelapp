const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    destination: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: Number, required: true },
    image: { type: String, default: 'default.jpg' },
    available: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Package', packageSchema);