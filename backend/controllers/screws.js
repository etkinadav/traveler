const Screw = require("../models/screw");
const ObjectId = require('mongoose').Types.ObjectId;

// Get all screws
exports.getAllScrews = async (req, res, next) => {
    try {
        console.log('Fetching all screws');
        const screws = await Screw.find({});
        console.log(`Found ${screws.length} screws`);
        res.status(200).json(screws);
    } catch (error) {
        console.error('Error fetching all screws:', error);
        res.status(500).json({ message: "Error fetching screws", error: error.message });
    }
};

// Get screw by ID
exports.getScrewById = async (req, res, next) => {
    const id = req.params.id;
    console.log('Fetching screw with ID:', id);
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid screw ID" });
    }
    
    try {
        const screw = await Screw.findById(id);
        if (!screw) {
            return res.status(404).json({ message: "Screw not found" });
        }
        res.status(200).json(screw);
    } catch (error) {
        console.error('Error fetching screw:', error);
        res.status(500).json({ message: "Fetching screw failed!" });
    }
};

// Get screw by length (closest match)
exports.getScrewByLength = async (req, res, next) => {
    const length = parseFloat(req.params.length);
    console.log('Fetching screw with length:', length);
    
    if (isNaN(length)) {
        return res.status(400).json({ message: "Invalid length" });
    }
    
    try {
        // מציאת הבורג עם האורך הקרוב ביותר
        const allScrews = await Screw.find({});
        
        if (allScrews.length === 0) {
            return res.status(404).json({ message: "No screws found" });
        }
        
        // מיון לפי ההפרש בין האורך המבוקש לאורך הבורג
        const closestScrew = allScrews.reduce((closest, current) => {
            const currentDiff = Math.abs(current.length - length);
            const closestDiff = Math.abs(closest.length - length);
            return currentDiff < closestDiff ? current : closest;
        });
        
        console.log(`Found closest screw: ${closestScrew.name} with length ${closestScrew.length}`);
        res.status(200).json(closestScrew);
    } catch (error) {
        console.error('Error fetching screw by length:', error);
        res.status(500).json({ message: "Fetching screw by length failed!" });
    }
};

// Create a new screw
exports.createScrew = async (req, res, next) => {
    try {
        console.log('Creating new screw:', req.body);
        const screw = new Screw(req.body);
        const savedScrew = await screw.save();
        console.log('Screw created successfully:', savedScrew._id);
        res.status(201).json(savedScrew);
    } catch (error) {
        console.error('Error creating screw:', error);
        res.status(500).json({ message: "Error creating screw", error: error.message });
    }
};

// Update a screw
exports.updateScrew = async (req, res, next) => {
    const id = req.params.id;
    console.log('Updating screw with ID:', id);
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid screw ID" });
    }
    
    try {
        const updatedScrew = await Screw.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedScrew) {
            return res.status(404).json({ message: "Screw not found" });
        }
        console.log('Screw updated successfully:', id);
        res.status(200).json(updatedScrew);
    } catch (error) {
        console.error('Error updating screw:', error);
        res.status(500).json({ message: "Error updating screw", error: error.message });
    }
};

// Delete a screw
exports.deleteScrew = async (req, res, next) => {
    const id = req.params.id;
    console.log('Deleting screw with ID:', id);
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid screw ID" });
    }
    
    try {
        const deletedScrew = await Screw.findByIdAndDelete(id);
        if (!deletedScrew) {
            return res.status(404).json({ message: "Screw not found" });
        }
        console.log('Screw deleted successfully:', id);
        res.status(200).json({ message: "Screw deleted successfully", deletedScrew });
    } catch (error) {
        console.error('Error deleting screw:', error);
        res.status(500).json({ message: "Error deleting screw", error: error.message });
    }
};

