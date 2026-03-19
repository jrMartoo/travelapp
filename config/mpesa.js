const axios = require('axios');

// M-Pesa Configuration (Safaricom Daraja API)
const consumerKey = 'YOUR_CONSUMER_KEY'; // Replace with your key
const consumerSecret = 'YOUR_CONSUMER_SECRET'; // Replace with your secret
const businessShortCode = '174379'; // Test paybill
const passkey = 'YOUR_PASSKEY'; // Replace with your passkey

// Get OAuth Token
const getAccessToken = async () => {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    try {
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { Authorization: `Basic ${auth}` } }
        );
        return response.data.access_token;
    } catch (error) {
        console.log('M-Pesa Token Error:', error);
        return null;
    }
};

// STK Push (Lipa Na M-Pesa Online)
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
        CallBackURL: 'https://yourdomain.com/mpesa-callback',
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
        console.log('STK Push Error:', error);
        return { error: error.message };
    }
};

module.exports = { stkPush };