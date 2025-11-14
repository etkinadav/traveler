const mongoose = require("mongoose"),
    Schema = mongoose.Schema;

const woodSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    hardness: {
        type: Number,
        required: true
    },
    translatedName: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model("Wood", woodSchema, "woods");

