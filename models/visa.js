const mongoose = require('mongoose');

const visaSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fullName: { type: String, required: true },
    passportNumber: { type: String, required: true, uppercase: true },
    nationality: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    passportExpiryDate: { type: Date, required: true },
    passportIssueDate: { type: Date, required: true },
    destinationCountry: { type: String, required: true },
    travelPurpose: { 
        type: String, 
        enum: ['tourism', 'business', 'transit', 'study', 'work', 'medical'],
        default: 'tourism'
    },
    intendedTravelDate: { type: Date, required: true },
    durationOfStay: { type: Number, required: true, min: 1 },
    visaType: { 
        type: String, 
        enum: ['tourist', 'business', 'transit', 'student', 'work', 'medical'],
        default: 'tourist'
    },
    visaStatus: { 
        type: String, 
        enum: ['draft', 'submitted', 'processing', 'approved', 'rejected'],
        default: 'draft'
    },
    applicationReference: { type: String, unique: true, sparse: true },
    submissionDate: Date,
    estimatedProcessingDays: Number,
    rejectionReason: String,
    serviceFee: { type: Number, default: 2500 },
    paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

visaSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    if (!this.applicationReference) {
        const year = new Date().getFullYear().toString().slice(-2);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.applicationReference = `VISA${year}${random}`;
    }
    next();
});

module.exports = mongoose.model('Visa', visaSchema);