const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const orderSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    productId: {
        type: String,
        required: [true, 'Product ID is required'],
        trim: true
    },
    productName: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    configuration: {
        type: Object,
        required: [true, 'Configuration is required']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price must be positive']
    },
    status: {
        type: String,
        enum: {
            values: ['pending', 'processing', 'completed', 'cancelled'],
            message: 'Status must be one of: pending, processing, completed, cancelled'
        },
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update updatedAt before saving
orderSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Transform output
orderSchema.set('toJSON', {
    transform: function(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model("Order", orderSchema);
