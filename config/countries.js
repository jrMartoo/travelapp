const visaRequirements = {
    'UAE': {
        documents: ['Passport (6 months validity)', 'Passport photo', 'Hotel booking', 'Flight itinerary', 'Bank statements'],
        processingTime: '3-5 business days',
        fee: 300,
        visaTypes: ['Tourist', 'Business', 'Transit']
    },
    'UK': {
        documents: ['Passport', 'Photos', 'Bank statements', 'Employment letter', 'Accommodation proof', 'Travel history'],
        processingTime: '15 business days',
        fee: 15000,
        visaTypes: ['Standard Visitor', 'Business', 'Student']
    },
    'USA': {
        documents: ['Passport', 'DS-160 confirmation', 'Photo', 'Bank statements', 'Employment letter', 'Travel itinerary'],
        processingTime: '10-15 business days',
        fee: 18500,
        visaTypes: ['B1/B2 Tourist/Business', 'Student', 'Work']
    },
    'KENYA': {
        documents: ['Passport', 'Photo', 'Hotel booking', 'Flight itinerary', 'Yellow fever certificate'],
        processingTime: '2-3 business days',
        fee: 50,
        visaTypes: ['Tourist', 'Business', 'Transit']
    },
    'THAILAND': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Flight itinerary', 'Hotel booking', 'Travel insurance'],
        processingTime: '5-7 business days',
        fee: 2500,
        visaTypes: ['Tourist', 'Business']
    },
    'CHINA': {
        documents: ['Passport', 'Photo', 'Invitation letter', 'Hotel bookings', 'Flight itinerary', 'Bank statements'],
        processingTime: '7-10 business days',
        fee: 8000,
        visaTypes: ['Tourist', 'Business']
    },
    'JAPAN': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Employment letter', 'Hotel bookings', 'Flight itinerary'],
        processingTime: '7-10 business days',
        fee: 6000,
        visaTypes: ['Tourist', 'Business']
    },
    'SOUTH AFRICA': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Flight itinerary', 'Hotel booking', 'Yellow fever certificate'],
        processingTime: '5-7 business days',
        fee: 3500,
        visaTypes: ['Tourist', 'Business']
    },
    'EGYPT': {
        documents: ['Passport', 'Photo', 'Hotel booking', 'Flight itinerary', 'Bank statements'],
        processingTime: '5-7 business days',
        fee: 2000,
        visaTypes: ['Tourist', 'Business']
    },
    'INDIA': {
        documents: ['Passport', 'Photo', 'Flight itinerary', 'Hotel booking', 'Bank statements'],
        processingTime: '3-5 business days',
        fee: 8000,
        visaTypes: ['Tourist', 'Business', 'Medical']
    },
    'SINGAPORE': {
        documents: ['Passport', 'Photo', 'Flight itinerary', 'Hotel booking', 'Bank statements', 'Employment letter'],
        processingTime: '3-5 business days',
        fee: 5000,
        visaTypes: ['Tourist', 'Business']
    },
    'MALAYSIA': {
        documents: ['Passport', 'Photo', 'Flight itinerary', 'Hotel booking', 'Bank statements'],
        processingTime: '3-5 business days',
        fee: 2000,
        visaTypes: ['Tourist', 'Business']
    },
    'AUSTRALIA': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Employment letter', 'Travel itinerary', 'Health insurance'],
        processingTime: '15-20 business days',
        fee: 25000,
        visaTypes: ['Tourist', 'Business', 'Student']
    },
    'CANADA': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Employment letter', 'Travel history', 'Invitation letter'],
        processingTime: '15-20 business days',
        fee: 18000,
        visaTypes: ['Tourist', 'Business', 'Student']
    },
    'FRANCE': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Employment letter', 'Hotel booking', 'Flight itinerary'],
        processingTime: '10-15 business days',
        fee: 12000,
        visaTypes: ['Tourist', 'Business', 'Student']
    },
    'GERMANY': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Employment letter', 'Hotel booking', 'Travel insurance'],
        processingTime: '10-15 business days',
        fee: 12000,
        visaTypes: ['Tourist', 'Business', 'Student']
    },
    'ITALY': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Employment letter', 'Hotel booking', 'Flight itinerary'],
        processingTime: '10-15 business days',
        fee: 12000,
        visaTypes: ['Tourist', 'Business', 'Student']
    },
    'SPAIN': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Employment letter', 'Hotel booking', 'Flight itinerary'],
        processingTime: '10-15 business days',
        fee: 12000,
        visaTypes: ['Tourist', 'Business', 'Student']
    },
    'SWITZERLAND': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Employment letter', 'Hotel booking', 'Travel insurance'],
        processingTime: '10-15 business days',
        fee: 12000,
        visaTypes: ['Tourist', 'Business']
    },
    'NETHERLANDS': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Employment letter', 'Hotel booking', 'Flight itinerary'],
        processingTime: '10-15 business days',
        fee: 12000,
        visaTypes: ['Tourist', 'Business', 'Student']
    },
    'BRAZIL': {
        documents: ['Passport', 'Photo', 'Bank statements', 'Employment letter', 'Flight itinerary', 'Hotel booking'],
        processingTime: '10-15 business days',
        fee: 15000,
        visaTypes: ['Tourist', 'Business']
    }
};

module.exports = visaRequirements;