const mongoose = require('mongoose');
const Package = require('./models/Package');

mongoose.connect('mongodb://localhost:27017/travel_platform')
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        
        await Package.deleteMany({});
        
        const packages = [
            { title: 'Masai Mara Safari', description: 'Experience the wildebeest migration', destination: 'Masai Mara, Kenya', price: 45000, duration: 4 },
            { title: 'Diani Beach Escape', description: 'Relax on pristine beaches', destination: 'Diani, Kenya', price: 35000, duration: 5 },
            { title: 'Mount Kenya Climb', description: 'Conquer the second highest mountain', destination: 'Mount Kenya', price: 55000, duration: 6 }
        ];
        
        await Package.insertMany(packages);
        console.log('✅ Sample packages added!');
        process.exit();
    })
    .catch(err => {
        console.log('❌ Error:', err);
        process.exit();
    });