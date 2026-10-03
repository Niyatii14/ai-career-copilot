const mongoose = require("mongoose");

const careerAnalysisSchema = new mongoose.Schema(
    {
        resume: {
            type: String,
            required: true
        },

        job_description: {
            type: String,
            required: true
        },
        match_score: {
            type: Number,
            required: true
        },

        matching_skills: {
            type: [String],
            default: []
        },

        missing_skills: {
            type: [String],
            default: []
        },

        resume_improvements: {
            type: [String],
            default: []
        },

        interview_questions: {
            type: [String],
            default: []
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "CareerAnalysis",
    careerAnalysisSchema
);