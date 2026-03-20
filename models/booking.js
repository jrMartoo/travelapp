const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    merchantRequestId: String,
    checkoutRequestId: { 
        type: String,
        unique: true,
        sparse: true
    },
    phone: String,
    amount: Number,
    packageId: String,
    packageName: String,
    travelers: {
        type: Number,
        default: 1
    },
    travelDate: Date,
    resultCode: Number,
    resultDesc: String,
    mpesaReceipt: String,
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'timeout'],
        default: 'pending'
    },
    visaApplicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Visa'
    },
    callbackData: Object,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Booking', bookingSchema);