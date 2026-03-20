const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    packageId: { type: String, required: true },
    packageName: { type: String, required: true },
    price: { type: Number, required: true },
    travelers: { type: Number, default: 1 },
    totalAmount: { type: Number, required: true },
    travelDate: { type: Date, required: true },
    bookingDate: { type: Date, default: Date.now },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    mpesaReceipt: String,
    checkoutRequestId: String,
    status: { type: String, enum: ['confirmed', 'cancelled', 'completed'], default: 'confirmed' }
});

module.exports = mongoose.model('Booking', bookingSchema);