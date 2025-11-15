const mongoose = require("mongoose"),
    Schema = mongoose.Schema;

const paramSchema = new Schema({
    name: String,
    type: String,
    default: Schema.Types.Mixed,
    min: Number,
    max: Number,
    round: Number,
    // השדות החסרים שנדרשים לשמירת קונפיגורציות:
    configurations: [Schema.Types.Mixed], // מערך של ערכים מעורבים (מספרים, מערכים, וכו')
    translatedName: String, // שם מתורגם
    selectedTypeIndex: Number, // אינדקס סוג נבחר
    isVisual: Boolean // האם פרמטר ויזואלי בלבד
}, { _id: false });

const productsSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    names: {
        type: Object,
        required: false
    },
    singleNames: {
        type: Object,
        required: false
    },
    model: {
        type: String,
        required: false
    },
    matirials: {
        type: Object,
        required: false
    },
    params: [paramSchema],
    restrictions: {
        type: Array,
        required: true
    },
    configurations: {
        type: Array,
        required: false
    },
    instructions: {
        type: Array,
        required: false
    }
});

module.exports = mongoose.model("Product", productsSchema, "products");