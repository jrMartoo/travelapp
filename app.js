const express = require('express');
const axios = require('axios');
const fs = require('fs');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const app = express();

// Models
const Booking = require('./models/Booking');
const Visa = require('./models/Visa');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// Create uploads directory
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// ==================== DATABASE ====================
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/travel_platform')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.log('❌ MongoDB error:', err));

// ==================== M-PESA CREDENTIALS ====================
const consumerKey = '20Xyp3T8p7VQXWjJj8WRvJdM2HYMU0PIX73Zn5GpNhYwnhiT';
const consumerSecret = 'DQfRcj0E5uO27f9DECtQYSVNFkQN1wnW4oKTgTrtAvdPJhVJ4QPN3pFGEwBaxUvl';
const businessShortCode = '174379';
const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

// ==================== TEST ENDPOINTS ====================
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working' });
});

app.get('/api/test-token', async (req, res) => {
    try {
        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { Authorization: `Basic ${auth}` }, timeout: 10000 }
        );
        res.json({ success: true, token: response.data.access_token });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ==================== STK PUSH ====================
app.post('/api/mpesa/stkpush', async (req, res) => {
    try {
        const { phone, amount, packageId, packageName, travelers, travelDate } = req.body;
        console.log('Payment:', { phone, amount, packageId });

        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        const tokenResponse = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { Authorization: `Basic ${auth}` } }
        );
        const token = tokenResponse.data.access_token;

        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString('base64');

        const stkData = {
            BusinessShortCode: businessShortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: phone,
            PartyB: businessShortCode,
            PhoneNumber: phone,
            CallBackURL: 'https://travel-app-production-3893.up.railway.app/api/mpesa/callback',
            AccountReference: 'TravelApp',
            TransactionDesc: 'Payment for ' + packageName
        };

        const stkResponse = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            stkData,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const booking = new Booking({
            merchantRequestId: stkResponse.data.MerchantRequestID,
            checkoutRequestId: stkResponse.data.CheckoutRequestID,
            phone, amount, packageId, packageName,
            travelers: travelers || 1,
            travelDate: travelDate || new Date(),
            paymentStatus: 'pending'
        });
        await booking.save();

        res.json({ success: true, message: 'STK Push sent', data: stkResponse.data, bookingId: booking._id });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ==================== M-PESA CALLBACK ====================
app.post('/api/mpesa/callback', async (req, res) => {
    console.log('Callback:', JSON.stringify(req.body, null, 2));
    fs.appendFileSync('mpesa_callbacks.json', JSON.stringify({ timestamp: new Date(), data: req.body }, null, 2) + ',\n');
    
    if (req.body.Body && req.body.Body.stkCallback) {
        const callback = req.body.Body.stkCallback;
        const booking = await Booking.findOne({ checkoutRequestId: callback.CheckoutRequestID });
        if (booking) {
            booking.resultCode = callback.ResultCode;
            booking.resultDesc = callback.ResultDesc;
            booking.callbackData = req.body;
            booking.paymentStatus = callback.ResultCode === 0 ? 'paid' : callback.ResultCode === 1037 ? 'timeout' : 'failed';
            await booking.save();
        }
    }
    res.json({ ResultCode: 0, ResultDesc: "Success" });
});

// ==================== BOOKINGS ====================
app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });
        res.json({ success: true, count: bookings.length, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/bookings/:id', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: booking });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== PACKAGES ====================
app.get('/api/packages', (req, res) => {
    const packages = [
        { _id: '1', title: 'Masai Mara Safari', price: 45000, duration: 4, description: 'Witness the great wildebeest migration', destination: 'Masai Mara, Kenya', image: 'https://images.pexels.com/photos/750539/pexels-photo-750539.jpeg' },
        { _id: '2', title: 'Diani Beach', price: 35000, duration: 5, description: 'Relax on pristine white sandy beaches', destination: 'Diani, Kenya', image: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg' },
        { _id: '3', title: 'Mount Kenya Climb', price: 55000, duration: 6, description: 'Conquer the second highest mountain', destination: 'Mount Kenya', image: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg' },
        { _id: '4', title: 'Lamu Cultural Tour', price: 40000, duration: 3, description: 'Explore Swahili culture', destination: 'Lamu, Kenya', image: 'https://images.pexels.com/photos/4666859/pexels-photo-4666859.jpeg' }
    ];
    res.json({ success: true, count: packages.length, data: packages });
});

// ==================== VISA ENDPOINTS ====================
app.get('/api/visa', async (req, res) => {
    try {
        const visas = await Visa.find().sort({ createdAt: -1 });
        res.json({ success: true, count: visas.length, data: visas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/visa/track/:reference', async (req, res) => {
    try {
        const visa = await Visa.findOne({ applicationReference: req.params.reference.toUpperCase() });
        if (!visa) return res.status(404).json({ success: false, error: 'Application not found' });
        const statusMsg = { draft: 'Not submitted', documents_uploaded: 'Documents uploaded', submitted: 'Submitted', processing: 'Processing', approved: 'Approved!', rejected: 'Rejected' };
        res.json({ success: true, applicationReference: visa.applicationReference, fullName: visa.fullName, passportNumber: visa.passportNumber, destinationCountry: visa.destinationCountry, status: visa.visaStatus, statusMessage: statusMsg[visa.visaStatus], submissionDate: visa.submissionDate, lastUpdated: visa.updatedAt });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/visa', async (req, res) => {
    try {
        const visa = new Visa(req.body);
        await visa.save();
        res.status(201).json({ success: true, message: 'Visa application created', data: visa, applicationReference: visa.applicationReference });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/api/visa/requirements/:country', (req, res) => {
    const reqs = {
        'UAE': { documents: ['Passport', 'Photo', 'Hotel booking', 'Flight itinerary', 'Bank statements'], processingTime: '3-5 days', fee: 300 },
        'UK': { documents: ['Passport', 'Photos', 'Bank statements', 'Employment letter'], processingTime: '15 days', fee: 15000 },
        'USA': { documents: ['Passport', 'DS-160', 'Photo', 'Bank statements'], processingTime: '10-15 days', fee: 18500 },
        'KENYA': { documents: ['Passport', 'Photo', 'Hotel booking', 'Yellow fever certificate'], processingTime: '2-3 days', fee: 50 },
        'THAILAND': { documents: ['Passport', 'Photo', 'Bank statements', 'Flight itinerary'], processingTime: '5-7 days', fee: 2500 }
    };
    const data = reqs[req.params.country] || { documents: ['Passport', 'Photo', 'Bank statements'], processingTime: 'Varies', fee: 'Contact us' };
    res.json({ success: true, country: req.params.country, requirements: data });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`📁 Test: http://localhost:${PORT}/api/test`);
    console.log(`📦 Packages: http://localhost:${PORT}/api/packages`);
    console.log(`🛂 Visa: http://localhost:${PORT}/api/visa`);
});