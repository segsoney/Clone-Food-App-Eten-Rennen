const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
    {
        food: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Food",
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        items: {
            type: [orderItemSchema],
            validate: {
                validator: (items) => Array.isArray(items) && items.length > 0,
                message: "Order should contain at least one item"
            }
        },
        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },
        deliveryAddress: {
            fullName: { type: String, required: true },
            phone: { type: String, required: true },
            line1: { type: String, required: true },
            line2: { type: String },
            city: { type: String, required: true },
            state: { type: String, required: true },
            pincode: { type: String, required: true }
        },
        paymentMethod: {
            type: String,
            required: true,
            enum: ["COD", "RAZORPAY"]
        },
        paymentStatus: {
            type: String,
            enum: ["PENDING", "PAID", "FAILED"],
            default: "PAID"
        },
        razorpayOrderId: {
            type: String,
            default: null
        },
        razorpayPaymentId: {
            type: String,
            default: null
        },
        fulfillmentStatus: {
            type: String,
            enum: ["RECEIVED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
            default: "RECEIVED"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
