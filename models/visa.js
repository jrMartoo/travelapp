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
    passportExpiryDate: { 
        type: Date, 
        required: true 
    },
    passportIssueDate: { 
        type: Date, 
        required: true 
    },
    passportIssueCountry: { 
        type: String, 
        default: 'Kenya' 
    },
    
    // Destination Details
    destinationCountry: { 
        type: String, 
        required: true 
    },
    travelPurpose: { 
        type: String, 
        enum: ['tourism', 'business', 'transit', 'study', 'work'],
        default: 'tourism'
    },
    intendedTravelDate: { 
        type: Date, 
        required: true 
    },
    durationOfStay: { 
        type: Number, 
        required: true,
        min: 1
    },
    
    // Visa Details
    visaType: { 
        type: String, 
        enum: ['tourist', 'business', 'transit', 'student', 'work'],
        default: 'tourist'
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
    
    // Documents
    documents: [{
        type: { 
            type: String,
            enum: ['passport_copy', 'photo', 'invitation_letter', 'hotel_booking', 'flight_itinerary', 'bank_statement']
        },
        filename: String,
        path: String,
        uploadedAt: { 
            type: Date, 
            default: Date.now 
        }
    }],
    
    // Application Dates
    submissionDate: Date,
    decisionDate: Date,
    rejectionReason: String,
    
    // Fees
    visaFee: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 2500 },
    totalFee: { type: Number, default: 2500 },
    paymentStatus: { 
        type: String, 
        enum: ['pending', 'paid', 'refunded'],
        default: 'pending' 
    },
    
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

// Update timestamps before saving
visaSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    this.totalFee = (this.visaFee || 0) + (this.serviceFee || 2500);
    
    // Generate application reference if not exists
    if (!this.applicationReference) {
        const year = new Date().getFullYear().toString().slice(-2);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.applicationReference = `VISA${year}${random}`;
    }
    
    next();
});

module.exports = mongoose.model('Visa', visaSchema);