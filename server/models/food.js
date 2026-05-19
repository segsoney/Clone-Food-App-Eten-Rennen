const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: true,
            unique: true
        },
        name: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        image: {
            type: String
        },
        description: {
            type: String
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Food", foodSchema);