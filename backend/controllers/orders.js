const Order = require("../models/order");
const ObjectId = require('mongoose').Types.ObjectId;

// Get number of pending orders for a user
exports.getNumOfPendingOrders = async (req, res, next) => {
    const userId = req.params.userId;
    console.log('Fetching pending orders for user:', userId);
    
    if (!ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }
    
    try {
        // Count pending orders for the user
        const numOfPendingOrders = await Order.countDocuments({ 
            userId: userId, 
            status: 'pending' 
        });
        
        console.log(`Found ${numOfPendingOrders} pending orders for user ${userId}`);
        res.status(200).json({ 
            message: "Pending orders count retrieved successfully",
            numOfPendingOrders: numOfPendingOrders 
        });
    } catch (error) {
        console.error('Error fetching pending orders count:', error);
        res.status(500).json({ message: "Error fetching pending orders count", error: error.message });
    }
};
