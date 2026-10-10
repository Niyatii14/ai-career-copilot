
import { useEffect, useRef, useState } from "react";
import "./App.css";

const MAX_RESUME_LENGTH = 15000;
const MAX_JOB_DESCRIPTION_LENGTH = 12000;

function App() {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [resumeFile, setResumeFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  const resultsRef = useRef(null);
  const fileInputRef = useRef(null);

  // Word counts
  const resumeWords = resume.trim()
    ? resume.trim().split(/\s+/).length
    : 0;

  const jobDescriptionWords = jobDescription.trim()
    ? jobDescription.trim().split(/\s+/).length
    : 0;

  // Clear current analysis
  const clearAnalysis = () => {
    setResume("");
    setJobDescription("");
    setResult(null);
    setError("");
    setResumeFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Fetch analysis history
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/analyses"
      );

      if (!response.ok) {
        throw new Error("Failed to fetch analysis history");
      }

      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error("History error:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // View a previous analysis
  const viewAnalysis = (analysis) => {
    setResult(analysis);
    setError("");

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  // Load history when the application starts
  useEffect(() => {
    fetchHistory();
  }, []);

  // Upload PDF resume
  const uploadResume = async (file) => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("PDF must be smaller than 5 MB.");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    try {
      setUploadingResume(true);
      setError("");

      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch(
        "http://localhost:5000/api/upload-resume",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to upload resume."
        );
      }

      if (typeof data.text !== "string" || !data.text.trim()) {
        throw new Error(
          "No readable text was extracted from this PDF."
        );
      }

      if (data.text.length > MAX_RESUME_LENGTH) {
        throw new Error(
          "Extracted resume exceeds the 15,000-character limit. Please use a shorter resume."
        );
      }

      setResumeFile(file);
      setResume(data.text);
      setResult(null);
    } catch (error) {
      console.error("Resume upload error:", error);

      setError(
        error.message || "Failed to upload resume."
      );

      setResumeFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setUploadingResume(false);
    }
  };

  // Remove uploaded resume
  const removeResume = () => {
    setResumeFile(null);
    setResume("");
    setResult(null);
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Analyze career
  const analyzeCareer = async () => {
    if (loading || uploadingResume) return;

    const cleanResume = resume.trim();
    const cleanJobDescription = jobDescription.trim();

    // Required fields
    if (!cleanResume || !cleanJobDescription) {
      setError(
        "Please enter both your resume and job description."
      );
      return;
    }

    // Minimum lengths
    if (cleanResume.length < 50) {
      setError(
        "Your resume is too short. Please provide at least 50 characters."
      );
      return;
    }

    if (cleanJobDescription.length < 50) {
      setError(
        "The job description is too short. Please provide at least 50 characters."
      );
      return;
    }

    // Maximum lengths
    if (cleanResume.length > MAX_RESUME_LENGTH) {
      setError(
        "Resume exceeds the 15,000-character limit."
      );
      return;
    }

    if (
      cleanJobDescription.length >
      MAX_JOB_DESCRIPTION_LENGTH
    ) {
      setError(
        "Job description exceeds the 12,000-character limit."
      );
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
            resume: cleanResume,
            job_description: cleanJobDescription,
          }),
        }
      );

      if (!response.ok) {
        let message = "Failed to analyze career.";

        try {
          const errorData = await response.json();

          if (typeof errorData.detail === "string") {
            message = errorData.detail;
          } else if (typeof errorData.error === "string") {
            message = errorData.error;
          }
        } catch {
          // Keep the default error message.
        }

        throw new Error(message);
      }

      const data = await response.json();

      setResult(data);

      // Refresh history without delaying the result
      void fetchHistory();
    } catch (error) {
      console.error("Analysis error:", error);

      setError(
        "Unable to analyze your resume right now. Please check that the backend and AI service are running, then try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Hero Section */}
      <header className="hero">
        <h1>AI Career Copilot</h1>

        <p>
          Analyze your resume against a job description
          and discover how to improve your chances.
        </p>
      </header>

      <main className="container">
        {/* Input Section */}
        <section className="input-section">
          {/* Resume */}
          <div className="input-card">
            <h2>Your Resume</h2>

            <label className="upload-label">
              {uploadingResume
                ? "Processing PDF..."
                : "Upload Resume PDF"}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                disabled={uploadingResume || loading}
                onChange={(e) => {
                  uploadResume(e.target.files?.[0]);
                }}
              />
            </label>

            {resumeFile && (
              <div className="file-info">
                <div>
                  <strong>
                    📄 {resumeFile.name}
                  </strong>

                  <p>
                    {(resumeFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                <button
                  type="button"
                  className="remove-file"
                  onClick={removeResume}
                  disabled={uploadingResume || loading}
                >
                  Remove
                </button>
              </div>
            )}

            <p className="or-text">
              or paste your resume below
            </p>

            <textarea
              placeholder="Paste your resume here..."
              value={resume}
              maxLength={MAX_RESUME_LENGTH}
              disabled={uploadingResume || loading}
              onChange={(e) => {
                setResume(e.target.value);
                setResumeFile(null);
                setResult(null);
                setError("");
              }}
            />

            <p className="word-count">
              {resumeWords} words · {resume.length}/
              {MAX_RESUME_LENGTH} characters
            </p>
          </div>

          {/* Job Description */}
          <div className="input-card">
            <h2>Job Description</h2>

            <textarea
              placeholder="Paste the job description here..."
              value={jobDescription}
              maxLength={MAX_JOB_DESCRIPTION_LENGTH}
              disabled={loading || uploadingResume}
              onChange={(e) => {
                setJobDescription(e.target.value);
                setResult(null);
                setError("");
              }}
            />

            <p className="word-count">
              {jobDescriptionWords} words ·{" "}
              {jobDescription.length}/
              {MAX_JOB_DESCRIPTION_LENGTH} characters
            </p>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="button-group">
          <button
            type="button"
            className="analyze-button"
            onClick={analyzeCareer}
            disabled={loading || uploadingResume}
          >
            {loading ? (
              <span className="loading-content">
                <span className="spinner"></span>
                Analyzing...
              </span>
            ) : uploadingResume ? (
              "Processing Resume..."
            ) : (
              "Analyze Career"
            )}
          </button>

          <button
            type="button"
            className="clear-button"
            onClick={clearAnalysis}
            disabled={loading || uploadingResume}
          >
            Clear
          </button>
        </div>

        {/* Error and Retry */}
        {error && (
          <div className="error-container">
            <p className="error">{error}</p>

            {resume.trim() &&
              jobDescription.trim() &&
              !loading &&
              !uploadingResume && (
                <button
                  type="button"
                  className="retry-button"
                  onClick={analyzeCareer}
                  disabled={loading || uploadingResume}
                >
                  Retry Analysis
                </button>
              )}
          </div>
        )}

        {/* Career Analysis Results */}
        {result && (
          <section
            className="results"
            ref={resultsRef}
          >
            <h2>Career Analysis</h2>

            {/* Match Score */}
            <div className="score-card">
              <div>
                <p className="score-label">
                  Resume Match Score
                </p>

                <h3>
                  {typeof result.match_score === "number"
                    ? `${result.match_score}%`
                    : "N/A"}
                </h3>
              </div>

              {typeof result.match_score === "number" && (
                <div
                  className="score-bar"
                  role="progressbar"
                  aria-label="Resume match score"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(
                    100,
                    Math.max(0, result.match_score)
                  )}
                >
                  <div
                    className="score-progress"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, result.match_score)
                      )}%`,
                    }}
                  ></div>
                </div>
              )}
            </div>

            {/* Matching Skills */}
            <div className="result-card">
              <h3>✓ Matching Skills</h3>

              <ul>
                {result.matching_skills?.map(
                  (skill, index) => (
                    <li key={`${skill}-${index}`}>
                      {skill}
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Missing Skills */}
            <div className="result-card">
              <h3>⚠ Missing Skills</h3>

              <ul>
                {result.missing_skills?.map(
                  (skill, index) => (
                    <li key={`${skill}-${index}`}>
                      {skill}
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Resume Improvements */}
            <div className="result-card">
              <h3>📝 Resume Improvements</h3>

              <ul>
                {result.resume_improvements?.map(
                  (improvement, index) => (
                    <li key={`${improvement}-${index}`}>
                      {improvement}
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Interview Questions */}
            <div className="result-card">
              <h3>🎯 Interview Questions</h3>

              <ul>
                {result.interview_questions?.map(
                  (question, index) => (
                    <li key={`${question}-${index}`}>
                      {question}
                    </li>
                  )
                )}
              </ul>
            </div>
          </section>
        )}

        {/* Analysis History */}
        <section className="history">
          <h2>Analysis History</h2>

          {historyLoading ? (
            <p className="history-message">
              Loading history...
            </p>
          ) : history.length === 0 ? (
            <p className="history-message">
              No previous analyses yet.
            </p>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <div
                  className="history-card"
                  key={item._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => viewAnalysis(item)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" ||
                      e.key === " "
                    ) {
                      e.preventDefault();
                      viewAnalysis(item);
                    }
                  }}
                >
                  <div className="history-header">
                    <h3>Career Analysis</h3>

                    {typeof item.match_score === "number" && (
                      <span className="history-score">
                        {item.match_score}%
                      </span>
                    )}
                  </div>

                  <p className="history-date">
                    {item.createdAt
                      ? new Date(
                          item.createdAt
                        ).toLocaleString()
                      : "Date unavailable"}
                  </p>

                  <p className="history-preview">
                    {(item.job_description || "").length > 120
                      ? `${item.job_description.substring(
                          0,
                          120
                        )}...`
                      : item.job_description ||
                        "No job description available"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
