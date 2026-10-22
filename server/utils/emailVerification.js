
const crypto = require("crypto");

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

function generateOtp() {
    return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
}

function hashOtp(otp) {
    return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
}

function getOtpExpiry() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

function isOtpExpired(expiryDate) {
    return !expiryDate || Date.now() > new Date(expiryDate).getTime();
}

module.exports = {
    generateOtp,
    hashOtp,
    getOtpExpiry,
    isOtpExpired,
    OTP_EXPIRY_MINUTES,
    OTP_RESEND_COOLDOWN_SECONDS,
    MAX_OTP_ATTEMPTS,
};
