const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    merchantRequestId: String,
    checkoutRequestId: String,
    phone: String,
    amount: Number,
    packageId: String,
    packageName: String,
    travelers: Number,
    travelDate: Date,
    resultCode: Number,
    resultDesc: String,
    mpesaReceipt: String,
    paymentStatus: { type: String, default: 'pending' },
    callbackData: Object,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);