const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const screwSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    translatedName: {
        type: String,
        required: true
    },
    length: {
        type: Number,
        required: true
    },
    width: {
        type: Number,
        required: true
    },
    packages: [
        {
            name: { type: String, required: true },
            translatedName: { type: String, required: true },
            amount: { type: Number, required: true },
            price: { type: Number, required: true }
        }
    ]
});

module.exports = mongoose.model("Screw", screwSchema);

