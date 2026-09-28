const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "AI Career Copilot backend is running!"
    });
});

const PORT = 5000;

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

        res.json(response.data);

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


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});