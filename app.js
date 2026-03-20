const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
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

// ==================== MONGODB CONNECTION (RAILWAY FIX) ====================
const MONGODB_URI = process.env.MONGO_URL || 
                     (process.env.MONGOHOST ? 
                     `mongodb://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${process.env.MONGOHOST}:${process.env.MONGOPORT}/travel_platform?authSource=admin` : 
                     'mongodb://localhost:27017/travel_platform');

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

// ==================== PACKAGES ====================
app.get('/api/packages', (req, res) => {
    const packages = [
        { _id: '1', title: 'Masai Mara Safari', price: 45000, duration: 4, description: 'Witness the great wildebeest migration', destination: 'Masai Mara, Kenya', image: 'https://images.pexels.com/photos/750539/pexels-photo-750539.jpeg' },
        { _id: '2', title: 'Diani Beach Escape', price: 35000, duration: 5, description: 'Relax on pristine white sandy beaches', destination: 'Diani, Kenya', image: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg' },
        { _id: '3', title: 'Mount Kenya Climb', price: 55000, duration: 6, description: 'Conquer the second highest mountain', destination: 'Mount Kenya', image: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg' },
        { _id: '4', title: 'Lamu Cultural Tour', price: 40000, duration: 3, description: 'Explore Swahili culture', destination: 'Lamu, Kenya', image: 'https://images.pexels.com/photos/4666859/pexels-photo-4666859.jpeg' },
        { _id: '5', title: 'Amboseli Elephant Safari', price: 48000, duration: 4, description: 'See elephants with Kilimanjaro backdrop', destination: 'Amboseli, Kenya', image: 'https://images.pexels.com/photos/1734025/pexels-photo-1734025.jpeg' },
        { _id: '6', title: 'Tsavo National Park', price: 42000, duration: 5, description: 'Explore Kenya\'s largest national park', destination: 'Tsavo, Kenya', image: 'https://images.pexels.com/photos/16012294/pexels-photo-16012294.jpeg' }
    ];
    res.json({ success: true, count: packages.length, data: packages });
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

app.get('/api/visa/track/:reference', async (req, res) => {
    try {
        const visa = await Visa.findOne({ applicationReference: req.params.reference.toUpperCase() });
        if (!visa) return res.status(404).json({ success: false, error: 'Application not found' });
        const statusMsg = { draft: 'Not submitted', submitted: 'Submitted', processing: 'Processing', approved: 'Approved!', rejected: 'Rejected' };
        res.json({ success: true, applicationReference: visa.applicationReference, fullName: visa.fullName, destinationCountry: visa.destinationCountry, status: visa.visaStatus, statusMessage: statusMsg[visa.visaStatus], lastUpdated: visa.updatedAt });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== TEST ====================
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working', timestamp: new Date() });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`🌍 Public: https://travel-app-production-3893.up.railway.app`);
    console.log(`📁 Auth: POST /api/auth/register, POST /api/auth/login`);
});