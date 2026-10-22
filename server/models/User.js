
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            select: false,
        },

    // Email verification status
        emailVerified: {
            type: Boolean,
            default: false,
        },

    // Store only the hashed OTP, never the original code
        emailVerificationOtpHash: {
            type: String,
            select: false,
        },

    // OTP expiration time
        emailVerificationOtpExpiresAt: {
            type: Date,
            select: false,
        },

    // Used to limit repeated OTP requests
        emailVerificationLastSentAt: {
            type: Date,
            select: false,
        },

    // Limit incorrect OTP attempts
        emailVerificationAttempts: {
            type: Number,
            default: 0,
            select: false,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", userSchema);
