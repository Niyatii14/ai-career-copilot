import os
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel, Field
from google import genai

class CareerAnalysis(BaseModel):
    matching_skills: list[str] = Field(
        description="Skills from the resume that match the job description."
    )

    missing_skills: list[str] = Field(
        description="Skills required by the job description that are missing from the resume."
    )

    resume_improvements: list[str] = Field(
        description="Specific suggestions for improving the resume for this job."
    )

    interview_questions: list[str] = Field(
        description="Interview questions the candidate should prepare for."
    )

load_dotenv()

app = FastAPI()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY is not set")

client = genai.Client(api_key=api_key)


class CareerAnalysisRequest(BaseModel):
    resume: str
    job_description: str


@app.get("/")
def home():
    return {
        "message": "AI Career Copilot AI Service is running!"
    }


career_prompt = PromptTemplate(
    input_variables=["resume", "job_description"],
    template="""
You are an AI Career Copilot.

Analyze the candidate's resume against the job description.

RESUME:
{resume}

JOB DESCRIPTION:
{job_description}

Provide a useful analysis covering:

1. Skills that match the job
2. Skills missing from the resume
3. Suggestions to improve the resume
4. Interview questions the candidate should prepare for

Keep the analysis practical and specific to the provided resume
and job description.
"""
)
@app.post("/analyze-career")
def analyze_career(request: CareerAnalysisRequest):

    prompt = career_prompt.format(
        resume=request.resume,
        job_description=request.job_description
    )

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": CareerAnalysis,
        },
    )

    return response.parsed