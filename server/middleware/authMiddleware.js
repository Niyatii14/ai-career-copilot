
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Please log in to access this resource.",
        });
    }

    const token = authHeader.slice(7);

    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is not configured.");
        return res.status(500).json({
            error: "Authentication is not configured.",
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.userId) {
            return res.status(401).json({
                error: "Invalid authentication token.",
            });
        }

        req.user = { userId: decoded.userId };
        next();
    } catch (error) {
        return res.status(401).json({
            error: "Invalid or expired login session. Please log in again.",
        });
    }
};

module.exports = authMiddleware;
