const Wood = require("../models/wood");

exports.getAllWoods = async (req, res, next) => {
    try {
        console.log('Fetching all woods');
        const woods = await Wood.find({});
        console.log(`Found ${woods.length} woods`);
        res.status(200).json(woods);
    } catch (error) {
        console.error('Error fetching all woods:', error);
        res.status(500).json({ message: "Error fetching woods", error: error.message });
    }
};

