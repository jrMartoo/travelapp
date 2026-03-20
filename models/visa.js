const mongoose = require('mongoose');

const visaSchema = new mongoose.Schema({
    // Personal Information
    fullName: { 
        type: String, 
        required: true 
    },
    passportNumber: { 
        type: String, 
        required: true,
        uppercase: true,
        trim: true
    },
    nationality: { 
        type: String, 
        required: true,
        default: 'Kenya'
    },
    dateOfBirth: { 
        type: Date, 
        required: true 
    },
    email: {
        type: String,
        required: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true
    },
    
    // Passport Details
    passportIssueDate: {
        type: Date,
        required: true
    },
    passportExpiryDate: { 
        type: Date, 
        required: true,
        validate: {
            validator: function(v) {
                return v > this.passportIssueDate;
            },
            message: 'Expiry date must be after issue date'
        }
    },
    passportIssueCountry: {
        type: String,
        required: true,
        default: 'Kenya'
    },
    
    // Destination Details
    destinationCountry: { 
        type: String, 
        required: true 
    },
    travelPurpose: { 
        type: String, 
        enum: ['tourism', 'business', 'transit', 'study', 'work', 'medical'],
        required: true
    },
    intendedTravelDate: {
        type: Date,
        required: true
    },
    durationOfStay: {
        type: Number, // in days
        required: true
    },
    
    // Visa Details
    visaType: {
        type: String,
        enum: ['tourist', 'business', 'transit', 'student', 'work', 'medical'],
        required: true
    },
    visaStatus: {
        type: String,
        enum: ['draft', 'documents_uploaded', 'submitted', 'processing', 'approved', 'rejected'],
        default: 'draft'
    },
    
    // Application Reference
    applicationReference: {
        type: String,
        unique: true,
        sparse: true
    },
    
    // Address Information
    address: {
        street: String,
        city: String,
        postalCode: String,
        country: String
    },
    
    // Employment Information
    employmentStatus: {
        type: String,
        enum: ['employed', 'self-employed', 'unemployed', 'student', 'retired']
    },
    employerName: String,
    employerAddress: String,
    occupation: String,
    monthlyIncome: Number,
    
    // Travel History
    previousVisas: [{
        country: String,
        visaType: String,
        issueDate: Date,
        expiryDate: Date
    }],
    
    // Documents
    documents: [{
        type: { 
            type: String,
            enum: [
                'passport_copy', 
                'passport_photo', 
                'invitation_letter', 
                'hotel_booking', 
                'flight_itinerary', 
                'bank_statement', 
                'employment_letter',
                'travel_insurance',
                'yellow_fever_certificate',
                'police_clearance',
                'marriage_certificate',
                'birth_certificate'
            ]
        },
        filename: String,
        path: String,
        uploadedAt: { 
            type: Date, 
            default: Date.now 
        },
        verified: {
            type: Boolean,
            default: false
        }
    }],
    
    // Emergency Contact
    emergencyContact: {
        name: String,
        relationship: String,
        phone: String,
        email: String
    },
    
    // Application Details
    submissionDate: Date,
    processingStartDate: Date,
    decisionDate: Date,
    rejectionReason: String,
    approvalConditions: String,
    
    // Fees
    visaFee: {
        type: Number,
        default: 0
    },
    serviceFee: {
        type: Number,
        default: 2500 // KES 2,500 service fee
    },
    totalFee: {
        type: Number,
        default: 2500
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refunded'],
        default: 'pending'
    },
    paymentReference: String,
    
    // Associated Booking
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },
    
    // Tracking
    trackingHistory: [{
        status: String,
        date: { type: Date, default: Date.now },
        note: String,
        updatedBy: String
    }],
    
    // Timestamps
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Update total fee and add tracking before saving
visaSchema.pre('save', function(next) {
    this.totalFee = (this.visaFee || 0) + (this.serviceFee || 2500);
    this.updatedAt = Date.now();
    
    // Add to tracking history if status changed
    if (this.isModified('visaStatus')) {
        this.trackingHistory.push({
            status: this.visaStatus,
            date: new Date(),
            note: `Status changed to ${this.visaStatus}`
        });
    }
    
    next();
});

// Generate application reference before saving if not exists
visaSchema.pre('save', async function(next) {
    if (!this.applicationReference) {
        const year = new Date().getFullYear().toString().slice(-2);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.applicationReference = `VISA${year}${random}`;
    }
    next();
});

module.exports = mongoose.model('Visa', visaSchema);