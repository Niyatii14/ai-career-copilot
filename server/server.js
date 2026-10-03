const express = require("express");
const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");

require("dotenv").config();

const CareerAnalysis = require("./models/CareerAnalysis");

const app = express();

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


// Start server
app.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`
    );
});