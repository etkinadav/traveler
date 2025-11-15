const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const userRoutes = require("./routes/user");
const ordersRoutes = require("./routes/orders");

require('dotenv').config();

const app = express();



// Enable MongoDB connection using mongoose and dotenv
require('dotenv').config({ path: __dirname + '/.env' });
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('✅ Connected to MongoDB Atlas');
        console.log('📦 Using database:', mongoose.connection.name);
    })
    .catch(err => console.error('❌ MongoDB connection error:', err));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/images", express.static(path.join("backend/images")));

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    );
    next();
});

app.use("/api/user", userRoutes);
app.use("/api/orders", ordersRoutes);

// Error handling middleware (must be after all routes)
app.use((error, req, res, next) => {
    console.error('Error:', error);
    
    const status = error.status || error.statusCode || 500;
    const message = error.message || 'An error occurred';
    
    res.status(status).json({
        message: message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({ message: 'Route not found' });
});

module.exports = app;
