const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const app = express();

// Models
const User = require('./models/User');
const Booking = require('./models/Booking');
const Visa = require('./models/Visa');
const visaRequirements = require('./config/countries');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// JWT Secret
const JWT_SECRET = 'your_super_secret_jwt_key_change_this';

// ==================== M-PESA CREDENTIALS ====================
const consumerKey = '20Xyp3T8p7VQXWjJj8WRvJdM2HYMU0PIX73Zn5GpNhYwnhiT';
const consumerSecret = 'DQfRcj0E5uO27f9DECtQYSVNFkQN1wnW4oKTgTrtAvdPJhVJ4QPN3pFGEwBaxUvl';
const businessShortCode = '174379';
const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const CALLBACK_URL = 'https://travel-app-production-3893.up.railway.app/api/mpesa/callback';

// ==================== M-PESA FUNCTIONS ====================
const getAccessToken = async () => {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    try {
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { Authorization: `Basic ${auth}` }, timeout: 10000 }
        );
        return response.data.access_token;
    } catch (error) {
        console.log('❌ M-Pesa Token Error:', error.message);
        return null;
    }
};

const stkPush = async (phoneNumber, amount, accountNumber) => {
    const token = await getAccessToken();
    if (!token) return { error: 'Failed to get token' };

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString('base64');

    const data = {
        BusinessShortCode: businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: businessShortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: CALLBACK_URL,
        AccountReference: accountNumber,
        TransactionDesc: 'Travel Booking Payment'
    };

    try {
        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            data,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error) {
        console.log('❌ STK Push Error:', error.message);
        return { error: error.message };
    }
};

// ==================== MONGODB CONNECTION ====================
const MONGODB_URI = process.env.MONGO_URL || 'mongodb://localhost:27017/travel_platform';

console.log('📡 Attempting MongoDB connection...');
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.log('❌ MongoDB error:', err.message));

// ==================== AUTH MIDDLEWARE ====================
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ success: false, error: 'No token' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) return res.status(401).json({ success: false, error: 'User not found' });
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
};

// ==================== AUTH ENDPOINTS ====================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ success: false, error: 'Email already registered' });
        
        const user = new User({ fullName, email, phone, password });
        await user.save();
        
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, message: 'Registration successful', token, user: { id: user._id, fullName, email } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, message: 'Login successful', token, user: { id: user._id, fullName: user.fullName, email } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    res.json({ success: true, user: req.user });
});

// ==================== PACKAGES (12 Packages) ====================
app.get('/api/packages', (req, res) => {
    const packages = [
        { _id: '1', title: 'Masai Mara Safari', price: 45000, duration: 4, description: 'Witness the great wildebeest migration', destination: 'Masai Mara, Kenya', image: 'https://images.pexels.com/photos/750539/pexels-photo-750539.jpeg' },
        { _id: '2', title: 'Diani Beach Escape', price: 35000, duration: 5, description: 'Relax on pristine white sandy beaches', destination: 'Diani, Kenya', image: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg' },
        { _id: '3', title: 'Mount Kenya Climb', price: 55000, duration: 6, description: 'Conquer the second highest mountain', destination: 'Mount Kenya', image: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg' },
        { _id: '4', title: 'Lamu Cultural Tour', price: 40000, duration: 3, description: 'Explore Swahili culture', destination: 'Lamu, Kenya', image: 'https://images.pexels.com/photos/4666859/pexels-photo-4666859.jpeg' },
        { _id: '5', title: 'Amboseli Elephant Safari', price: 48000, duration: 4, description: 'Elephants with Kilimanjaro backdrop', destination: 'Amboseli, Kenya', image: 'https://images.pexels.com/photos/1734025/pexels-photo-1734025.jpeg' },
        { _id: '6', title: 'Tsavo National Park', price: 42000, duration: 5, description: 'Kenya\'s largest national park', destination: 'Tsavo, Kenya', image: 'https://images.pexels.com/photos/16012294/pexels-photo-16012294.jpeg' },
        { _id: '7', title: 'Watamu Beach Resort', price: 38000, duration: 5, description: 'Coastal paradise', destination: 'Watamu, Kenya', image: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg' },
        { _id: '8', title: 'Lake Nakuru Safari', price: 38000, duration: 3, description: 'Flamingos and rhinos', destination: 'Lake Nakuru, Kenya', image: 'https://images.pexels.com/photos/16012294/pexels-photo-16012294.jpeg' },
        { _id: '9', title: 'Samburu Adventure', price: 52000, duration: 5, description: 'Rare northern species', destination: 'Samburu, Kenya', image: 'https://images.pexels.com/photos/750539/pexels-photo-750539.jpeg' },
        { _id: '10', title: 'Hell\'s Gate Adventure', price: 28000, duration: 2, description: 'Bike and hike', destination: 'Hell\'s Gate, Kenya', image: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg' },
        { _id: '11', title: 'Nairobi City Tour', price: 15000, duration: 1, description: 'Explore vibrant capital', destination: 'Nairobi, Kenya', image: 'https://images.pexels.com/photos/4666859/pexels-photo-4666859.jpeg' },
        { _id: '12', title: 'Kilifi Creek Experience', price: 32000, duration: 4, description: 'Peaceful Kilifi Creek', destination: 'Kilifi, Kenya', image: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg' }
    ];
    res.json({ success: true, count: packages.length, data: packages });
});

// ==================== M-PESA PAYMENT ENDPOINT ====================
app.post('/api/mpesa/pay', authMiddleware, async (req, res) => {
    try {
        const { bookingId, phone, amount } = req.body;
        
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }
        
        const mpesaResponse = await stkPush(phone, amount, bookingId);
        
        if (mpesaResponse.error) {
            return res.status(400).json({ success: false, error: mpesaResponse.error });
        }
        
        booking.checkoutRequestId = mpesaResponse.CheckoutRequestID;
        await booking.save();
        
        res.json({
            success: true,
            message: 'STK Push sent. Check your phone.',
            data: mpesaResponse
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== M-PESA CALLBACK ====================
app.post('/api/mpesa/callback', async (req, res) => {
    console.log('📞 M-Pesa Callback Received:', JSON.stringify(req.body, null, 2));
    
    if (req.body.Body && req.body.Body.stkCallback) {
        const callback = req.body.Body.stkCallback;
        const checkoutId = callback.CheckoutRequestID;
        
        const booking = await Booking.findOne({ checkoutRequestId: checkoutId });
        
        if (booking) {
            if (callback.ResultCode === 0) {
                booking.paymentStatus = 'paid';
                
                // Extract payment details
                const metadata = callback.CallbackMetadata;
                if (metadata && metadata.Item) {
                    metadata.Item.forEach(item => {
                        if (item.Name === 'Amount') booking.totalAmount = item.Value;
                        if (item.Name === 'MpesaReceiptNumber') booking.mpesaReceipt = item.Value;
                    });
                }
                console.log('✅ Payment successful for booking:', booking._id);
            } else {
                booking.paymentStatus = 'failed';
                console.log('❌ Payment failed:', callback.ResultDesc);
            }
            
            await booking.save();
        }
    }
    
    res.json({ ResultCode: 0, ResultDesc: "Success" });
});

// ==================== BOOKINGS ====================
app.post('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const { packageId, packageName, price, travelers, travelDate } = req.body;
        const totalAmount = price * travelers;
        
        const booking = new Booking({
            user: req.user._id,
            packageId,
            packageName,
            price,
            travelers,
            totalAmount,
            travelDate,
            paymentStatus: 'pending'
        });
        
        await booking.save();
        req.user.bookings.push(booking._id);
        await req.user.save();
        
        res.json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/bookings/:id', authMiddleware, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
        res.json({ success: true, data: booking });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== VISA ENDPOINTS ====================
app.get('/api/visa/countries', (req, res) => {
    const countries = Object.keys(visaRequirements).sort();
    res.json({ success: true, countries });
});

app.get('/api/visa/requirements/:country', (req, res) => {
    const country = req.params.country.toUpperCase();
    const data = visaRequirements[country] || visaRequirements['UAE'];
    res.json({ success: true, country, requirements: data });
});

app.post('/api/visa', authMiddleware, async (req, res) => {
    try {
        const visaData = { ...req.body, user: req.user._id };
        const visa = new Visa(visaData);
        await visa.save();
        req.user.visaApplications.push(visa._id);
        await req.user.save();
        res.json({ success: true, visa, applicationReference: visa.applicationReference });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/api/visa', authMiddleware, async (req, res) => {
    try {
        const visas = await Visa.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, data: visas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/visa/track/:reference', async (req, res) => {
    try {
        const visa = await Visa.findOne({ applicationReference: req.params.reference.toUpperCase() });
        if (!visa) return res.status(404).json({ success: false, error: 'Application not found' });
        
        const statusMessages = {
            draft: 'Not submitted yet',
            submitted: 'Submitted to embassy',
            processing: 'Being processed',
            approved: 'Visa approved!',
            rejected: 'Application rejected'
        };
        
        res.json({
            success: true,
            applicationReference: visa.applicationReference,
            fullName: visa.fullName,
            destinationCountry: visa.destinationCountry,
            status: visa.visaStatus,
            statusMessage: statusMessages[visa.visaStatus] || visa.visaStatus,
            submissionDate: visa.submissionDate,
            lastUpdated: visa.updatedAt
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== DASHBOARD ====================
app.get('/api/dashboard', authMiddleware, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5);
        const visas = await Visa.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5);
        
        const totalSpent = await Booking.aggregate([
            { $match: { user: req.user._id, paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        res.json({
            success: true,
            user: {
                fullName: req.user.fullName,
                email: req.user.email,
                phone: req.user.phone,
                memberSince: req.user.createdAt
            },
            stats: {
                totalBookings: await Booking.countDocuments({ user: req.user._id }),
                totalVisas: await Visa.countDocuments({ user: req.user._id }),
                totalSpent: totalSpent[0]?.total || 0
            },
            recentBookings: bookings,
            recentVisas: visas
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== TEST ENDPOINT ====================
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working', timestamp: new Date() });
});

// ==================== SERVE INDEX.HTML ====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`🌍 Public: https://travel-app-production-3893.up.railway.app`);
    console.log(`📁 Auth: POST /api/auth/register, POST /api/auth/login`);
    console.log(`📦 Packages: GET /api/packages (12 packages)`);
    console.log(`💰 M-Pesa: POST /api/mpesa/pay`);
    console.log(`🛂 Visa: GET /api/visa/countries`);
});