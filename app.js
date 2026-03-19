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
mongoose.connect('mongodb://localhost:27017/travel_platform')
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

// ==================== PACKAGES ENDPOINT ====================
app.get('/api/packages', (req, res) => {
    const packages = [
        { 
            _id: '1', 
            title: 'Masai Mara Safari', 
            price: 45000, 
            duration: 4, 
            description: 'Witness the great wildebeest migration',
            destination: 'Masai Mara, Kenya',
            image: 'https://picsum.photos/400/300?random=1'
        },
        { 
            _id: '2', 
            title: 'Diani Beach', 
            price: 35000, 
            duration: 5, 
            description: 'Relax on pristine white sandy beaches',
            destination: 'Diani, Kenya',
            image: 'https://picsum.photos/400/300?random=2'
        },
        { 
            _id: '3', 
            title: 'Mount Kenya Climb', 
            price: 55000, 
            duration: 6, 
            description: 'Conquer the second highest mountain in Africa',
            destination: 'Mount Kenya',
            image: 'https://picsum.photos/400/300?random=3'
        },
        { 
            _id: '4', 
            title: 'Lamu Cultural Tour', 
            price: 40000, 
            duration: 3, 
            description: 'Explore rich Swahili culture and historic architecture',
            destination: 'Lamu, Kenya',
            image: 'https://picsum.photos/400/300?random=4'
        }
    ];
    res.json({
        success: true,
        count: packages.length,
        data: packages
    });
});

// ==================== START SERVER WITH NETWORK ACCESS ====================
const PORT = 3000;
const HOST = '0.0.0.0'; // This allows connections from other devices

app.listen(PORT, HOST, () => {
    // Get network interfaces to display your IP
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const results = {};
    
    // Find your local network IP
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip internal and non-IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ SERVER STARTED SUCCESSFULLY`);
    console.log('='.repeat(50));
    console.log(`📌 Access URLs:`);
    console.log(`   - Local: http://localhost:${PORT}`);
    console.log(`   - Local: http://127.0.0.1:${PORT}`);
    
    // Display all network IPs found
    if (Object.keys(results).length > 0) {
        console.log(`\n🌐 Network Access (for other devices):`);
        for (const [iface, ips] of Object.entries(results)) {
            ips.forEach(ip => {
                console.log(`   - http://${ip}:${PORT}`);
                console.log(`   - http://${ip}:${PORT}/index.html`);
            });
        }
        console.log(`\n📱 On your phone or other laptop, use one of the URLs above`);
        console.log(`⚠️  Make sure all devices are on the same WiFi network`);
        console.log(`⚠️  Windows Firewall must allow port ${PORT} (TCP)`);
    } else {
        console.log(`\n❌ No network IP found. Check your network connection.`);
    }
    
    console.log('\n' + '-'.repeat(50));
    console.log(`📁 Test endpoints:`);
    console.log(`   - Test API: http://localhost:${PORT}/api/test`);
    console.log(`   - Test Token: http://localhost:${PORT}/api/test-token`);
    console.log(`   - Packages: http://localhost:${PORT}/api/packages`);
    console.log(`   - Bookings: http://localhost:${PORT}/api/bookings`);
    console.log('='.repeat(50) + '\n');
});