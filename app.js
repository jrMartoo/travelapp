const express = require('express');
const axios = require('axios');
const fs = require('fs');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();

// Models
const User = require('./models/User');
const Booking = require('./models/Booking');
const Visa = require('./models/Visa');
const Package = require('./models/Package');
const visaRequirements = require('./config/countries');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// JWT Secret
const JWT_SECRET = 'your_super_secret_jwt_key_change_this_in_production';

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

// ==================== AUTH MIDDLEWARE ====================
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }
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
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }
        
        const user = new User({ fullName, email, phone, password });
        await user.save();
        
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            message: 'Registration successful',
            token,
            user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    res.json({ success: true, user: req.user });
});

// ==================== PACKAGES (10+ Destinations) ====================
app.get('/api/packages', async (req, res) => {
    const packages = [
        { _id: '1', title: 'Masai Mara Safari', price: 45000, duration: 4, description: 'Witness the great wildebeest migration', destination: 'Masai Mara, Kenya', category: 'safari', rating: 4.9, image: 'https://images.pexels.com/photos/750539/pexels-photo-750539.jpeg' },
        { _id: '2', title: 'Diani Beach Escape', price: 35000, duration: 5, description: 'Relax on pristine white sandy beaches', destination: 'Diani, Kenya', category: 'beach', rating: 4.8, image: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg' },
        { _id: '3', title: 'Mount Kenya Climb', price: 55000, duration: 6, description: 'Conquer the second highest mountain in Africa', destination: 'Mount Kenya', category: 'mountain', rating: 4.7, image: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg' },
        { _id: '4', title: 'Lamu Cultural Tour', price: 40000, duration: 3, description: 'Explore rich Swahili culture and historic architecture', destination: 'Lamu, Kenya', category: 'cultural', rating: 4.8, image: 'https://images.pexels.com/photos/4666859/pexels-photo-4666859.jpeg' },
        { _id: '5', title: 'Amboseli Elephant Safari', price: 48000, duration: 4, description: 'See elephants with Mount Kilimanjaro backdrop', destination: 'Amboseli, Kenya', category: 'safari', rating: 4.9, image: 'https://images.pexels.com/photos/1734025/pexels-photo-1734025.jpeg' },
        { _id: '6', title: 'Tsavo National Park', price: 42000, duration: 5, description: 'Explore Kenya\'s largest national park', destination: 'Tsavo, Kenya', category: 'safari', rating: 4.7, image: 'https://images.pexels.com/photos/16012294/pexels-photo-16012294.jpeg' },
        { _id: '7', title: 'Samburu Wildlife Adventure', price: 52000, duration: 5, description: 'Discover rare northern species', destination: 'Samburu, Kenya', category: 'safari', rating: 4.8, image: 'https://images.pexels.com/photos/750539/pexels-photo-750539.jpeg' },
        { _id: '8', title: 'Lake Nakuru Safari', price: 38000, duration: 3, description: 'See flamingos and rhinos', destination: 'Lake Nakuru, Kenya', category: 'safari', rating: 4.6, image: 'https://images.pexels.com/photos/1734025/pexels-photo-1734025.jpeg' },
        { _id: '9', title: 'Watamu Beach Resort', price: 38000, duration: 5, description: 'Relax at Kenya\'s coastal paradise', destination: 'Watamu, Kenya', category: 'beach', rating: 4.7, image: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg' },
        { _id: '10', title: 'Hell\'s Gate Adventure', price: 28000, duration: 2, description: 'Bike and hike in this unique park', destination: 'Hell\'s Gate, Kenya', category: 'adventure', rating: 4.6, image: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg' },
        { _id: '11', title: 'Nairobi City Tour', price: 15000, duration: 1, description: 'Explore Kenya\'s vibrant capital', destination: 'Nairobi, Kenya', category: 'city', rating: 4.5, image: 'https://images.pexels.com/photos/4666859/pexels-photo-4666859.jpeg' },
        { _id: '12', title: 'Kilifi Creek Experience', price: 32000, duration: 4, description: 'Relax by the peaceful Kilifi Creek', destination: 'Kilifi, Kenya', category: 'beach', rating: 4.7, image: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg' }
    ];
    res.json({ success: true, count: packages.length, data: packages });
});

// ==================== BOOKINGS (with user authentication) ====================
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
        
        // Add to user's bookings
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

// ==================== VISA (with 20+ countries) ====================
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
            statusMessage: statusMessages[visa.visaStatus],
            submissionDate: visa.submissionDate,
            estimatedProcessingDays: visa.estimatedProcessingDays,
            lastUpdated: visa.updatedAt
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== USER DASHBOARD ====================
app.get('/api/dashboard', authMiddleware, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5);
        const visas = await Visa.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5);
        
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
                totalSpent: await Booking.aggregate([
                    { $match: { user: req.user._id, paymentStatus: 'paid' } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
                ]).then(r => r[0]?.total || 0)
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
    res.json({ message: 'API is working' });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`📁 Auth endpoints: /api/auth/register, /api/auth/login`);
    console.log(`📦 Packages: /api/packages`);
    console.log(`🛂 Visa: /api/visa`);
    console.log(`🌍 Countries: /api/visa/countries`);
});