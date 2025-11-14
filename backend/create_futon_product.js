const mongoose = require('mongoose');
const Product = require('./models/product');
const Beam = require('./models/beam');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/beams', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function createFutonProduct() {
    try {
        console.log('Creating futon product...');
        
        // First, let's find some existing beams to use
        const beams = await Beam.find({});
        console.log('Found beams:', beams.length);
        
        if (beams.length === 0) {
            console.log('No beams found. Please create beams first.');
            return;
        }
        
        // Use the first beam for plata and leg
        const plataBeam = beams[0];
        const legBeam = beams[0];
        
        const futonProduct = {
            name: 'futon',
            model: 'futon',
            matirials: {},
            params: [
                {
                    name: 'width',
                    type: 'number',
                    default: 200,
                    min: 100,
                    max: 300,
                    round: 1
                },
                {
                    name: 'depth',
                    type: 'number',
                    default: 120,
                    min: 80,
                    max: 200,
                    round: 1
                },
                {
                    name: 'plata',
                    type: 'beamSingle',
                    default: 0,
                    min: 0,
                    max: 0,
                    round: 0,
                    beams: [plataBeam._id]
                },
                {
                    name: 'leg',
                    type: 'beamSingle',
                    default: 0,
                    min: 0,
                    max: 0,
                    round: 0,
                    beams: [legBeam._id]
                },
                {
                    name: 'extraBeam',
                    type: 'number',
                    default: 4,
                    min: 2,
                    max: 6,
                    round: 0
                }
            ],
            restrictions: []
        };
        
        // Check if futon product already exists
        const existingFuton = await Product.findOne({ name: 'futon' });
        if (existingFuton) {
            console.log('Futon product already exists:', existingFuton._id);
            return;
        }
        
        // Create the product
        const product = new Product(futonProduct);
        const savedProduct = await product.save();
        
        console.log('Futon product created successfully:', savedProduct._id);
        console.log('Product details:', savedProduct);
        
    } catch (error) {
        console.error('Error creating futon product:', error);
    } finally {
        mongoose.connection.close();
    }
}

createFutonProduct();


