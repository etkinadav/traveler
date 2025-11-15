'use strict';

/**
 * Module dependencies
 */
const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

/**
 * Transaction Schema
 */
const TransactionSchema = new Schema({
  created: {
    type: Date,
    default: Date.now
  },
  responseText: {
    type: String,
    trim: true
  },
  responseCode: {
    type: String,
    trim: true
  },
  sum: {
    type: Number,
    min: [0, 'Sum must be positive']
  },
  user: {
    type: String,
    trim: true
  },
  orderID: { 
    type: Schema.Types.ObjectId, 
    ref: 'Order' 
  },
  userID: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: [true, 'User ID is required']
  },
  branchID: { 
    type: Schema.Types.ObjectId, 
    ref: 'Branch' 
  },
  printerID: { 
    type: Schema.Types.ObjectId, 
    ref: 'Printer' 
  },
}, { 
  versionKey: false, 
  timestamps: true 
});

// Transform output
TransactionSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
