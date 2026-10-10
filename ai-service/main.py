
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from google import genai
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel, Field

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(
    title="AI Career Copilot",
    description="AI-powered resume and job description analysis",
    version="1.0.0",
)

# Initialize Gemini client
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY is not set")

client = genai.Client(api_key=api_key)


# Structured AI response
class CareerAnalysis(BaseModel):
    match_score: int = Field(
        ge=0,
        le=100,
        description=(
            "Overall percentage match between the resume "
            "and job description, from 0 to 100."
        ),
    )

    matching_skills: list[str] = Field(
        description=(
            "Skills demonstrated in the resume that are "
            "relevant to the job description."
        )
    )

    missing_skills: list[str] = Field(
        description=(
            "Important job requirements not demonstrated "
            "in the resume."
        )
    )

    resume_improvements: list[str] = Field(
        description=(
            "Specific, actionable suggestions for improving "
            "the resume for this job."
        )
    )

    interview_questions: list[str] = Field(
        description=(
            "Relevant technical, project-based, and "
            "scenario-based interview questions."
        )
    )


# Request validation
class CareerAnalysisRequest(BaseModel):
    resume: str = Field(
        min_length=1,
        description="The candidate's resume text.",
    )

    job_description: str = Field(
        min_length=1,
        description="The job description to analyze.",
    )


# Health check
@app.get("/")
def home():
    return {
        "message": "AI Career Copilot AI Service is running!"
    }


# Career analysis prompt
career_prompt = PromptTemplate(
    input_variables=["resume", "job_description"],
    template="""
You are an expert technical recruiter and career advisor.

Analyze the candidate's resume against the job description.
Base your analysis on evidence in the provided text.
Never invent candidate experience, skills, or achievements.

====================
RESUME
====================
{resume}

====================
JOB DESCRIPTION
====================
{job_description}

====================
ANALYSIS RULES
====================

1. MATCHING SKILLS

List skills that are genuinely demonstrated in the resume
and relevant to the job description.

Do not treat similar technologies as identical.

Examples:
- MySQL is not PostgreSQL.
- MongoDB is not PostgreSQL.
- Node.js is not Python.
- Knowledge of REST APIs does not automatically prove
  experience with FastAPI.
- General backend experience does not prove experience
  with every backend framework.

Mention a transferable skill only when relevant, without
claiming the candidate knows an unlisted technology.

2. MISSING SKILLS

Identify important requirements that are not demonstrated
in the resume.

Prioritize:
- Explicitly required skills
- Important frameworks and technologies
- Relevant databases and development tools
- Responsibilities central to the role

Consider optional skills separately and do not overemphasize
minor nice-to-have requirements.

Do not label a skill as missing if the resume clearly
demonstrates it under another reasonable name.

3. MATCH SCORE

Return an integer between 0 and 100.

Consider:
- Required technical skills
- Relevant frameworks and tools
- Database knowledge
- Relevant projects and practical experience
- Responsibilities and role alignment
- Experience level specified in the job description

Do not calculate the score simply by counting keywords.

Give greater weight to essential requirements than optional
ones. Relevant project experience can provide evidence of
practical ability, but do not assume professional experience
when only a project is described.

Be consistent and realistic. The score is an estimate of
resume-to-job alignment, not a guaranteed ATS score.

4. RESUME IMPROVEMENTS

Provide specific, actionable suggestions for this job.

Focus on:
- Highlighting relevant existing skills
- Emphasizing relevant projects
- Improving technical descriptions
- Adding measurable results when supported by evidence
- Learning important missing skills

Never invent qualifications, experience, metrics, or
achievements. Recommend learning a missing technology
rather than falsely claiming proficiency.

5. INTERVIEW QUESTIONS

Generate questions based on the job requirements and the
candidate's demonstrated background.

Include a useful mix of:
- Technical fundamentals
- Framework and API questions
- Database questions
- Project-specific questions
- Practical scenarios

Include questions about missing technologies where useful,
but do not imply the candidate already has experience with
them.

6. OUTPUT REQUIREMENTS

Return only the structured JSON response matching the
provided schema.

Keep every list item clear, relevant, and actionable.
Do not include markdown fences or additional commentary.
""",
)


# Analyze resume against job description
@app.post(
    "/analyze-career",
    response_model=CareerAnalysis,
)
def analyze_career(request: CareerAnalysisRequest):

    # Reject whitespace-only input
    if not request.resume.strip():
        raise HTTPException(
            status_code=422,
            detail="Resume text cannot be empty.",
        )

    if not request.job_description.strip():
        raise HTTPException(
            status_code=422,
            detail="Job description cannot be empty.",
        )

    # Format the prompt
    prompt = career_prompt.format(
        resume=request.resume,
        job_description=request.job_description,
    )

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": CareerAnalysis,
            },
        )

        print("Gemini response received")

        if response.parsed is None:
            print("Parsed response is None")
            print("Raw response:", response.text)

            raise HTTPException(
                status_code=502,
                detail="Gemini returned no valid structured response.",
            )

        return response.parsed

    except HTTPException:
        raise

    except Exception:
        logger.exception("Career analysis failed")

        raise HTTPException(
            status_code=502,
            detail=(
                "Career analysis failed. "
                "Please try again later."
            ),
        ) from None