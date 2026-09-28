from langchain_core.prompts import PromptTemplate

prompt = PromptTemplate(
    input_variables=["resume", "job_description"],
    template="""
You are an AI Career Copilot.

Analyze the candidate's resume against the job description.

RESUME:
{resume}

JOB DESCRIPTION:
{job_description}

Provide:
1. Matching skills
2. Missing skills
3. Resume improvement suggestions
4. Interview questions
"""
)

formatted_prompt = prompt.format(
    resume="Python, FastAPI, React, MongoDB",
    job_description="Looking for a Python backend developer with FastAPI and PostgreSQL"
)

print(formatted_prompt)