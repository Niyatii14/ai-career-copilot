
import os
import time
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from google import genai
from google.genai import errors
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel, Field

# Logging
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
        description="Overall resume-to-job match percentage from 0 to 100.",
    )
    matching_skills: list[str] = Field(
        description="Relevant skills demonstrated in the resume."
    )
    missing_skills: list[str] = Field(
        description="Important job requirements not demonstrated in the resume."
    )
    resume_improvements: list[str] = Field(
        description="Specific, actionable resume improvement suggestions."
    )
    interview_questions: list[str] = Field(
        description="Relevant technical, project-based, and scenario-based questions."
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

List skills genuinely demonstrated in the resume and relevant
to the job description.

Do not treat similar technologies as identical:
- MySQL is not PostgreSQL.
- MongoDB is not PostgreSQL.
- Node.js is not Python.
- REST API knowledge does not automatically prove FastAPI experience.
- General backend experience does not prove experience with every framework.

Mention transferable skills where relevant without claiming
the candidate knows an unlisted technology.

2. MISSING SKILLS

Identify important requirements not demonstrated in the resume.
Prioritize essential skills, frameworks, databases, tools, and
responsibilities. Do not overemphasize optional requirements.
Do not mark a skill missing if the resume demonstrates it under
another reasonable name.

3. MATCH SCORE

Return an integer from 0 to 100.

Consider required technical skills, frameworks, tools, databases,
projects, practical experience, and role alignment.

Do not count keywords mechanically. Weight essential requirements
more heavily than optional ones. Project experience can demonstrate
practical ability but does not establish professional experience.
The score is an estimate, not a guaranteed ATS score.

4. RESUME IMPROVEMENTS

Give specific, actionable suggestions for this job.
Highlight relevant existing skills and projects, improve technical
descriptions, suggest measurable results only when supported by
evidence, and recommend learning missing skills.
Never invent qualifications, metrics, or achievements.

5. INTERVIEW QUESTIONS

Include a useful mix of technical fundamentals, frameworks and APIs,
databases, project-specific questions, and practical scenarios.
Ask about missing technologies where useful without implying
the candidate already has experience with them.

6. OUTPUT REQUIREMENTS

Return only a structured JSON response matching the provided schema.
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

    # Format prompt
    prompt = career_prompt.format(
        resume=request.resume.strip(),
        job_description=request.job_description.strip(),
    )

    # Retry temporary Gemini server errors
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": CareerAnalysis,
                },
            )

            if response.parsed is None:
                logger.error(
                    "Gemini returned no valid structured response."
                )
                raise HTTPException(
                    status_code=502,
                    detail="Gemini returned no valid structured response.",
                )

            logger.info("Career analysis completed successfully.")
            return response.parsed

        except HTTPException:
            raise

        except errors.ServerError:
            if attempt == 2:
                logger.exception(
                    "Gemini server error after all retry attempts."
                )
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "Gemini is temporarily unavailable. "
                        "Please try again later."
                    ),
                ) from None

            wait_seconds = 2 ** (attempt + 1)
            logger.warning(
                "Gemini server error. Retry %s/2 in %s seconds.",
                attempt + 1,
                wait_seconds,
            )
            time.sleep(wait_seconds)

        except Exception:
            logger.exception("Career analysis failed.")
            raise HTTPException(
                status_code=502,
                detail=(
                    "Career analysis failed. "
                    "Please try again later."
                ),
            ) from None
