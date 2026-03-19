const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    destination: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: Number, required: true },
    image: { type: String, default: 'default.jpg' }
});

module.exports = mongoose.model('Package', packageSchema);