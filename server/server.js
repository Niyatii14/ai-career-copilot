
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");

require("dotenv").config();

const authRoutes = require("./Routes/authRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const CareerAnalysis = require("./models/CareerAnalysis");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Public authentication routes: register and login
app.use("/api/auth", authRoutes);

// PDF upload configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed"));
        }
    },
});

// Home route
app.get("/", (req, res) => {
    res.json({
        message: "AI Career Copilot backend is running!",
    });
});

// Analyze career — login required
app.post(
    "/api/analyze-career",
    authMiddleware,
    async (req, res) => {
        try {
            const { resume, job_description } = req.body ?? {};

            // Validate input types
            if (
                typeof resume !== "string" ||
                typeof job_description !== "string"
            ) {
                return res.status(400).json({
                    error: "Resume and job description must be strings.",
                });
            }

            const cleanResume = resume.trim();
            const cleanJobDescription = job_description.trim();

            // Validate required fields
            if (!cleanResume || !cleanJobDescription) {
                return res.status(400).json({
                    error: "Resume and job description are required.",
                });
            }

            // Validate minimum lengths
            if (cleanResume.length < 50) {
                return res.status(400).json({
                    error: "Resume must contain at least 50 characters.",
                });
            }

            if (cleanJobDescription.length < 50) {
                return res.status(400).json({
                    error: "Job description must contain at least 50 characters.",
                });
            }

            // Validate maximum lengths
            if (cleanResume.length > 15000) {
                return res.status(413).json({
                    error: "Resume exceeds the 15,000-character limit.",
                });
            }

            if (cleanJobDescription.length > 12000) {
                return res.status(413).json({
                    error: "Job description exceeds the 12,000-character limit.",
                });
            }

            // Call the FastAPI AI service
            const response = await axios.post(
                "http://127.0.0.1:8000/analyze-career",
                {
                    resume: cleanResume,
                    job_description: cleanJobDescription,
                },
                {
                    timeout: 120000,
                }
            );

            const analysis = response.data;

            // Save analysis under the authenticated user
            const savedAnalysis = await CareerAnalysis.create({
                ...analysis,
                owner: req.user.userId,
                resume: cleanResume,
                job_description: cleanJobDescription,
            });

            return res.status(200).json(savedAnalysis);
        } catch (error) {
            console.error("Career analysis error:", error.message);

            if (error.response) {
                console.error(
                    "AI service status:",
                    error.response.status
                );

                console.error(
                    "AI service response:",
                    error.response.data
                );

                return res.status(502).json({
                    error:
                        "The AI service could not complete the analysis. Please try again.",
                });
            }

            if (error.code === "ECONNABORTED") {
                return res.status(504).json({
                    error:
                        "The analysis request timed out. Please try again.",
                });
            }

            if (error.request) {
                return res.status(503).json({
                    error:
                        "The AI service is unavailable. Please try again later.",
                });
            }

            return res.status(500).json({
                error: "Failed to analyze career. Please try again.",
            });
        }
    }
);

// Get only the authenticated user's analysis history
app.get(
    "/api/analyses",
    authMiddleware,
    async (req, res) => {
        try {
            const analyses = await CareerAnalysis
                .find({ owner: req.user.userId })
                .sort({ createdAt: -1 });

            return res.json(analyses);
        } catch (error) {
            console.error("Error fetching analyses:", error.message);

            return res.status(500).json({
                error: "Failed to fetch career analyses.",
            });
        }
    }
);

// Upload and extract PDF resume
// This endpoint extracts text but does not save an analysis.
app.post(
    "/api/upload-resume",
    (req, res, next) => {
        upload.single("resume")(req, res, (error) => {
            if (error) {
                if (error instanceof multer.MulterError) {
                    const status =
                        error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

                    return res.status(status).json({
                        error:
                            error.code === "LIMIT_FILE_SIZE"
                                ? "PDF must be 5 MB or smaller."
                                : "Unable to upload the PDF.",
                    });
                }

                return res.status(400).json({
                    error: error.message || "Invalid file upload.",
                });
            }

            next();
        });
    },
    async (req, res) => {
        let parser;

        try {
            if (!req.file) {
                return res.status(400).json({
                    error: "Please upload a PDF resume.",
                });
            }

            parser = new PDFParse({
                data: req.file.buffer,
            });

            const pdfData = await parser.getText();
            const extractedText = pdfData.text.trim();

            if (!extractedText) {
                return res.status(400).json({
                    error: "Could not extract text from this PDF.",
                });
            }

            if (extractedText.length > 15000) {
                return res.status(413).json({
                    error:
                        "Extracted resume exceeds the 15,000-character limit.",
                });
            }

            return res.json({
                filename: req.file.originalname,
                text: extractedText,
            });
        } catch (error) {
            console.error("PDF extraction error:", error.message);

            return res.status(500).json({
                error: "Failed to process PDF resume.",
            });
        } finally {
            if (parser) {
                try {
                    await parser.destroy();
                } catch (error) {
                    console.error(
                        "PDF parser cleanup error:",
                        error.message
                    );
                }
            }
        }
    }
);

// Delete only an analysis owned by the authenticated user
app.delete(
    "/api/analyses/:id",
    authMiddleware,
    async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.isValidObjectId(id)) {
                return res.status(400).json({
                    error: "Invalid analysis ID.",
                });
            }

            const deletedAnalysis =
                await CareerAnalysis.findOneAndDelete({
                    _id: id,
                    owner: req.user.userId,
                });

            if (!deletedAnalysis) {
                return res.status(404).json({
                    error: "Career analysis not found.",
                });
            }

            return res.status(200).json({
                message: "Career analysis deleted successfully.",
                id: deletedAnalysis._id,
            });
        } catch (error) {
            console.error("Error deleting analysis:", error.message);

            return res.status(500).json({
                error: "Failed to delete career analysis.",
            });
        }
    }
);

// MongoDB connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((error) => {
        console.error(
            "MongoDB connection failed:",
            error.message
        );
    });

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
