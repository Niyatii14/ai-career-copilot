const express = require("express");

const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");

require("dotenv").config();

const CareerAnalysis = require("./models/CareerAnalysis");

const app = express();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed"));
        }
    }
});

app.use(cors());
app.use(express.json());


// Home route
app.get("/", (req, res) => {
    res.json({
        message: "AI Career Copilot backend is running!"
    });
});


const PORT = 5000;


// Analyze career
app.post("/api/analyze-career", async (req, res) => {
    try {
        const { resume, job_description } = req.body;

        const response = await axios.post(
            "http://127.0.0.1:8000/analyze-career",
            {
                resume,
                job_description
            }
        );

        const analysis = response.data;

        const savedAnalysis = await CareerAnalysis.create({
            resume,
            job_description,
            ...analysis
        });

        res.json(savedAnalysis);

    } catch (error) {
        console.error("AI Service Error:", error.message);

        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Response:", error.response.data);
        }

        res.status(500).json({
            error: "Failed to analyze career",
            details: error.message
        });
    }
});


// Get analysis history
app.get("/api/analyses", async (req, res) => {
    try {
        const analyses = await CareerAnalysis
            .find()
            .sort({ createdAt: -1 });

        res.json(analyses);

    } catch (error) {
        console.error("Error fetching analyses:", error.message);

        res.status(500).json({
            error: "Failed to fetch career analyses",
            details: error.message
        });
    }
});


// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((error) => {
        console.error(
            "MongoDB connection failed:",
            error.message
        );
    });

app.post(
    "/api/upload-resume",
    upload.single("resume"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: "Please upload a PDF resume."
                });
            }

            const parser = new PDFParse({
                data: req.file.buffer
            });

            const pdfData = await parser.getText();

            const extractedText = pdfData.text.trim();

            await parser.destroy();

            if (!extractedText) {
                return res.status(400).json({
                    error: "Could not extract text from this PDF."
                });
            }

            res.json({
                filename: req.file.originalname,
                text: extractedText
            });

        } catch (error) {
            console.error(
                "PDF extraction error:",
                error.message
            );

            res.status(500).json({
                error: "Failed to process PDF resume.",
                details: error.message
            });
        }
    }
);


// Start server
app.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`
    );
});