const express = require('express');
const axios = require('axios');
const fs = require('fs');
const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// ==================== CONNECT TO MONGODB ====================
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/travel_platform')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.log('❌ MongoDB error:', err));

// ==================== M-PESA CREDENTIALS ====================
const consumerKey = '20Xyp3T8p7VQXWjJj8WRvJdM2HYMU0PIX73Zn5GpNhYwnhiT';
const consumerSecret = 'DQfRcj0E5uO27f9DECtQYSVNFkQN1wnW4oKTgTrtAvdPJhVJ4QPN3pFGEwBaxUvl';
const businessShortCode = '174379';
const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

// ==================== TEST ENDPOINT ====================
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working' });
});

// ==================== TOKEN ENDPOINT ====================
app.get('/api/test-token', async (req, res) => {
    try {
        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { 
                headers: { Authorization: `Basic ${auth}` },
                timeout: 10000
            }
        );
        
        res.json({ 
            success: true, 
            message: '✅ Token generated successfully',
            token: response.data.access_token
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message,
            details: error.response?.data || 'Check your credentials'
        });
    }
});

// ==================== STK PUSH ENDPOINT ====================
app.post('/api/mpesa/stkpush', async (req, res) => {
    try {
        const { phone, amount, packageId, packageName, travelers, travelDate } = req.body;
        
        console.log('Processing payment for:', { phone, amount, packageId });
        
        // Get token
        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        const tokenResponse = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { Authorization: `Basic ${auth}` } }
        );
        
        const token = tokenResponse.data.access_token;
        
        // Generate timestamp
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString('base64');
        
        // Prepare STK Push
        const stkData = {
            BusinessShortCode: businessShortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: phone,
            PartyB: businessShortCode,
            PhoneNumber: phone,
            CallBackURL: 'https://unthriving-lucent-kayla.ngrok-free.dev/api/mpesa/callback',
            AccountReference: 'TravelApp',
            TransactionDesc: 'Payment for ' + packageName
        };
        
        // Send STK Push
        const stkResponse = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            stkData,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Save initial booking to database
        const booking = new Booking({
            merchantRequestId: stkResponse.data.MerchantRequestID,
            checkoutRequestId: stkResponse.data.CheckoutRequestID,
            phone,
            amount,
            packageId,
            packageName,
            travelers: travelers || 1,
            travelDate: travelDate || new Date(),
            paymentStatus: 'pending'
        });
        
        await booking.save();
        console.log('✅ Booking saved to database with ID:', booking._id);
        
        res.json({
            success: true,
            message: 'STK Push sent successfully',
            data: stkResponse.data,
            bookingId: booking._id
        });
        
    } catch (error) {
        console.log('Error:', error.message);
        res.json({
            success: false,
            error: error.message,
            details: error.response?.data || 'Unknown error'
        });
    }
});

// ==================== M-PESA CALLBACK ====================
app.post('/api/mpesa/callback', async (req, res) => {
    console.log('📞 M-Pesa Callback Received:');
    console.log(JSON.stringify(req.body, null, 2));
    
    // Save to file
    const callbackData = {
        timestamp: new Date(),
        data: req.body
    };
    fs.appendFileSync('mpesa_callbacks.json', JSON.stringify(callbackData, null, 2) + ',\n');
    
    // Process callback
    if (req.body.Body && req.body.Body.stkCallback) {
        const callback = req.body.Body.stkCallback;
        const checkoutId = callback.CheckoutRequestID;
        
        // Find and update booking in database
        const booking = await Booking.findOne({ checkoutRequestId: checkoutId });
        
        if (booking) {
            booking.resultCode = callback.ResultCode;
            booking.resultDesc = callback.ResultDesc;
            booking.callbackData = req.body;
            
            if (callback.ResultCode === 0) {
                // Payment successful
                booking.paymentStatus = 'paid';
                
                // Extract payment details
                const metadata = callback.CallbackMetadata;
                if (metadata && metadata.Item) {
                    metadata.Item.forEach(item => {
                        if (item.Name === 'Amount') booking.amount = item.Value;
                        if (item.Name === 'MpesaReceiptNumber') booking.mpesaReceipt = item.Value;
                        if (item.Name === 'PhoneNumber') booking.phone = item.Value;
                    });
                }
                console.log('✅ Payment successful for:', checkoutId);
            } else if (callback.ResultCode === 1037) {
                booking.paymentStatus = 'timeout';
                console.log('⏰ Payment timeout for:', checkoutId);
            } else {
                booking.paymentStatus = 'failed';
                console.log('❌ Payment failed for:', checkoutId);
            }
            
            await booking.save();
            console.log('✅ Booking updated in database');
        } else {
            console.log('❌ Booking not found for CheckoutRequestID:', checkoutId);
        }
    }
    
    res.json({ ResultCode: 0, ResultDesc: "Success" });
});

// ==================== GET ALL BOOKINGS ====================
app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== GET SINGLE BOOKING ====================
app.get('/api/bookings/:id', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }
        res.json({ success: true, data: booking });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== PACKAGES ENDPOINT WITH STABLE IMAGES ====================
app.get('/api/packages', (req, res) => {
    const packages = [
        { 
            _id: '1', 
            title: 'Masai Mara Safari', 
            price: 45000, 
            duration: 4, 
            description: 'Witness the great wildebeest migration',
            destination: 'Masai Mara, Kenya',
            image: 'https://images.pexels.com/photos/750539/pexels-photo-750539.jpeg'
        },
        { 
            _id: '2', 
            title: 'Diani Beach', 
            price: 35000, 
            duration: 5, 
            description: 'Relax on pristine white sandy beaches',
            destination: 'Diani, Kenya',
            image: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg'
        },
        { 
            _id: '3', 
            title: 'Mount Kenya Climb', 
            price: 55000, 
            duration: 6, 
            description: 'Conquer the second highest mountain in Africa',
            destination: 'Mount Kenya',
            image: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg'
        },
        { 
            _id: '4', 
            title: 'Lamu Cultural Tour', 
            price: 40000, 
            duration: 3, 
            description: 'Explore rich Swahili culture and historic architecture',
            destination: 'Lamu, Kenya',
            image: 'https://images.pexels.com/photos/4666859/pexels-photo-4666859.jpeg'
        }
    ];
    res.json({
        success: true,
        count: packages.length,
        data: packages
    });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`\n✅ Server running on port ${PORT}`);
    console.log(`📁 Test endpoints:`);
    console.log(`   - Test API: /api/test`);
    console.log(`   - Test Token: /api/test-token`);
    console.log(`   - Packages: /api/packages`);
    console.log(`   - Bookings: /api/bookings`);
});