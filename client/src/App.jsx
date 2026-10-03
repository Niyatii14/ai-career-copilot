import { useState } from "react";
import "./App.css";

function App() {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resumeWords = resume.trim()
  ? resume.trim().split(/\s+/).length
  : 0;

  const jobDescriptionWords = jobDescription.trim()
  ? jobDescription.trim().split(/\s+/).length
  : 0;

  const analyzeCareer = async () => {
    if (!resume.trim() || !jobDescription.trim()) {
      setError("Please enter both your resume and job description.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const response = await fetch(
        "http://localhost:5000/api/analyze-career",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            resume,
            job_description: jobDescription,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to analyze career");
      }

      const data = await response.json();

      setResult(data);
    } catch (error) {
      console.error(error);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="hero">
        <h1>AI Career Copilot</h1>

        <p>
          Analyze your resume against a job description
          and discover how to improve your chances.
        </p>
      </header>

      <main className="container">

        <section className="input-section">

          <div className="input-card">
            <h2>Your Resume</h2>

            <textarea
              placeholder="Paste your resume here..."
              value={resume}
              onChange={(e) => setResume(e.target.value)}
            />
            <p className="word-count">
              {resumeWords} words
            </p>
          </div>

          <div className="input-card">
            <h2>Job Description</h2>

            <textarea
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
            <p className="word-count">
              {jobDescriptionWords} words
            </p>
            

          </div>

        </section>

        <button
          className="analyze-button"
          onClick={analyzeCareer}
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Analyze Career"}
        </button>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

        {result && (
          <section className="results">

            <h2>Career Analysis</h2>

            <div className="result-card">
              <h3>✓ Matching Skills</h3>

              <ul>
                {result.matching_skills?.map((skill, index) => (
                  <li key={index}>{skill}</li>
                ))}
              </ul>
            </div>

            <div className="result-card">
              <h3>⚠ Missing Skills</h3>

              <ul>
                {result.missing_skills?.map((skill, index) => (
                  <li key={index}>{skill}</li>
                ))}
              </ul>
            </div>

            <div className="result-card">
              <h3>📝 Resume Improvements</h3>

              <ul>
                {result.resume_improvements?.map(
                  (improvement, index) => (
                    <li key={index}>{improvement}</li>
                  )
                )}
              </ul>
            </div>

            <div className="result-card">
              <h3>🎯 Interview Questions</h3>

              <ul>
                {result.interview_questions?.map(
                  (question, index) => (
                    <li key={index}>{question}</li>
                  )
                )}
              </ul>
            </div>

          </section>
        )}

      </main>
    </div>
  );
}

export default App;