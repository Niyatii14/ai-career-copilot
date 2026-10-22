
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

const {
    generateOtp,
    hashOtp,
    getOtpExpiry,
    isOtpExpired,
    OTP_EXPIRY_MINUTES,
    OTP_RESEND_COOLDOWN_SECONDS,
    MAX_OTP_ATTEMPTS,
} = require("../utils/emailVerification");

const router = express.Router();

function getEmailVerificationHtml(name, otp) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px;">
        <h2 style="color: #6546c7;">AI Career Copilot</h2>
        <p>Hello ${name.replace(/[&<>"']/g, "")},</p>
        <p>Use this code to verify your email address:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 0;">
        ${otp}
        </div>
        <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes and can only be used once.</p>
        <p>If you didn't request this, you can ignore this email.</p>
        </div>
    `;
}

// Register a new account and send a verification OTP
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body || {};

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                error: "Name, email, and password are required.",
            });
        }

        if (name.trim().length > 100) {
            return res.status(400).json({ error: "Name is too long." });
    }

    if (password.length < 8) {
        return res.status(400).json({
            error: "Password must be at least 8 characters long.",
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail.length > 254) {
        return res.status(400).json({ error: "Email address is too long." });
    }

    const existingUser = await User.findOne({ email: normalizedEmail })
    .select("+emailVerificationOtpHash +emailVerificationOtpExpiresAt");

    if (existingUser) {
        if (existingUser.emailVerified) {
            return res.status(409).json({
                error: "An account with this email already exists. Please log in.",
            });
        }

      // Allow an unverified registration to request a fresh OTP after cooldown.
        const lastSent = existingUser.emailVerificationLastSentAt
        ? new Date(existingUser.emailVerificationLastSentAt).getTime()
        : 0;

      if (Date.now() - lastSent < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        return res.status(429).json({
            error: "A verification code was recently sent. Please wait before requesting another.",
        });
    }

    const otp = generateOtp();
    existingUser.emailVerificationOtpHash = hashOtp(otp);
    existingUser.emailVerificationOtpExpiresAt = getOtpExpiry();
    existingUser.emailVerificationLastSentAt = new Date();
    existingUser.emailVerificationAttempts = 0;

    await existingUser.save();

    try {
        await sendEmail({
            to: existingUser.email,
            subject: "Verify your AI Career Copilot email",
            text: `Your verification code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
            html: getEmailVerificationHtml(existingUser.name, otp),
        });
    } catch (emailError) {
        console.error("Verification email error:", emailError.message);
        return res.status(500).json({
            error: "Unable to send the verification email. Please try again later.",
        });
    }

    return res.status(200).json({
        message: "A new verification code has been sent to your email.",
        requiresVerification: true,
        email: existingUser.email,
    });
    }

    const otp = generateOtp();
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        emailVerified: false,
        emailVerificationOtpHash: hashOtp(otp),
        emailVerificationOtpExpiresAt: getOtpExpiry(),
        emailVerificationLastSentAt: new Date(),
        emailVerificationAttempts: 0,
    });

    try {
        await sendEmail({
            to: user.email,
            subject: "Verify your AI Career Copilot email",
            text: `Your verification code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
            html: getEmailVerificationHtml(user.name, otp),
        });
    } catch (emailError) {
        console.error("Verification email error:", emailError.message);
        await User.deleteOne({ _id: user._id });
        return res.status(500).json({
            error: "Unable to send the verification email. Please try again later.",
        });
    }

    return res.status(201).json({
        message: "Account created. Check your email for the verification code.",
        requiresVerification: true,
        email: user.email,
    });
    } catch (error) {
    if (error.code === 11000) {
        return res.status(409).json({
            error: "An account with this email already exists. Please log in.",
        });
    }

    console.error("Registration error:", error.message);
    return res.status(500).json({ error: "Failed to register." });
    }
});

// Verify the email OTP
router.post("/verify-email", async (req, res) => {
    try {
        const { email, otp } = req.body || {};

    if (
        typeof email !== "string" ||
        typeof otp !== "string" ||
        !/^\d{6}$/.test(otp)
    ) {
        return res.status(400).json({
            error: "Enter your email address and the 6-digit verification code.",
        });
    }

    const user = await User.findOne({
        email: email.trim().toLowerCase(),
    }).select(
        "+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationAttempts"
    );

    if (!user) {
        return res.status(400).json({
            error: "Unable to verify this email. Please register or request a new code.",
        });
    }

    if (user.emailVerified) {
        return res.status(200).json({
            message: "Your email is already verified. You can log in.",
        });
    }

    if (
        !user.emailVerificationOtpHash ||
        isOtpExpired(user.emailVerificationOtpExpiresAt)
    ) {
        return res.status(400).json({
            error: "Your verification code has expired. Please request a new one.",
        });
    }

    if ((user.emailVerificationAttempts || 0) >= MAX_OTP_ATTEMPTS) {
        return res.status(429).json({
            error: "Too many incorrect attempts. Please request a new code.",
        });
    }

    if (hashOtp(otp) !== user.emailVerificationOtpHash) {
        user.emailVerificationAttempts =
        (user.emailVerificationAttempts || 0) + 1;
        await user.save();

        return res.status(400).json({
            error: "Incorrect verification code.",
        });
    }

    user.emailVerified = true;
    user.emailVerificationOtpHash = undefined;
    user.emailVerificationOtpExpiresAt = undefined;
    user.emailVerificationLastSentAt = undefined;
    user.emailVerificationAttempts = 0;
    await user.save();

    try {
        await sendEmail({
            to: user.email,
            subject: "Your AI Career Copilot account is verified",
            text: `Hello ${user.name}, your email has been verified successfully. You can now log in to AI Career Copilot.`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px;">
            <h2 style="color: #6546c7;">AI Career Copilot</h2>
            <h3>Email verified successfully!</h3>
            <p>Hello ${user.name.replace(/[&<>"']/g, "")},</p>
            <p>Your email address has been verified and your account is ready to use.</p>
            <p>You can now log in to AI Career Copilot.</p>
            </div>
        `,
        });
    } catch (emailError) {
      // Verification succeeded; a confirmation-email failure should not undo it.
        console.error("Confirmation email error:", emailError.message);
    }

    return res.status(200).json({
        message: "Email verified successfully. You can now log in.",
        verified: true,
    });
    } catch (error) {
        console.error("Email verification error:", error.message);
        return res.status(500).json({
            error: "Failed to verify email.",
        });
    }
});

// Resend an OTP after the cooldown
router.post("/resend-otp", async (req, res) => {
    try {
        const { email } = req.body || {};

    if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ error: "Email address is required." });
    }

    const user = await User.findOne({
        email: email.trim().toLowerCase(),
    }).select(
        "+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationLastSentAt +emailVerificationAttempts"
    );

    if (!user) {
        return res.status(404).json({
            error: "No account found for this email address.",
        });
    }

    if (user.emailVerified) {
        return res.status(400).json({
            error: "This email is already verified. Please log in.",
        });
    }

    const lastSent = user.emailVerificationLastSentAt
    ? new Date(user.emailVerificationLastSentAt).getTime()
    : 0;

    if (Date.now() - lastSent < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        return res.status(429).json({
            error: "Please wait 60 seconds before requesting another code.",
        });
    }

    const otp = generateOtp();

    user.emailVerificationOtpHash = hashOtp(otp);
    user.emailVerificationOtpExpiresAt = getOtpExpiry();
    user.emailVerificationLastSentAt = new Date();
    user.emailVerificationAttempts = 0;
    await user.save();

    try {
        await sendEmail({
            to: user.email,
            subject: "Your new AI Career Copilot verification code",
            text: `Your new verification code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
            html: getEmailVerificationHtml(user.name, otp),
        });
    } catch (emailError) {
        console.error("Resend verification email error:", emailError.message);
        return res.status(500).json({
            error: "Unable to send the verification email. Please try again later.",
        });
    }

    return res.status(200).json({
        message: "A new verification code has been sent.",
    });
    } catch (error) {
    console.error("Resend OTP error:", error.message);
    return res.status(500).json({
        error: "Failed to resend verification code.",
    });
    }
});

// Log in only verified users
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            error: "Email and password are required.",
        });
    }

    const user = await User.findOne({
        email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({
            error: "Invalid email or password.",
        });
    }

    if (!user.emailVerified) {
        return res.status(403).json({
            error: "Please verify your email before logging in.",
            requiresVerification: true,
            email: user.email,
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is not configured.");
        return res.status(500).json({
            error: "Authentication is not configured.",
        });
    }

    const token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    return res.status(200).json({
        message: "Login successful.",
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
        },
    });
    } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ error: "Failed to log in." });
    }
});

module.exports = router;
