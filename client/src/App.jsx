import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const resultsRef = useRef(null);

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


  // View an old analysis
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


  // Load history when application starts
  useEffect(() => {
    fetchHistory();
  }, []);


  // Analyze career
  const analyzeCareer = async () => {
    if (!resume.trim() || !jobDescription.trim()) {
      setError(
        "Please enter both your resume and job description."
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

      // Refresh history after creating a new analysis
      fetchHistory();

    } catch (error) {
      console.error("Analysis error:", error);

      setError(
        "Something went wrong. Please try again."
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

            <textarea
              placeholder="Paste your resume here..."
              value={resume}
              onChange={(e) =>
                setResume(e.target.value)
              }
            />

            <p className="word-count">
              {resumeWords} words
            </p>

          </div>


          {/* Job Description */}
          <div className="input-card">

            <h2>Job Description</h2>

            <textarea
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(e) =>
                setJobDescription(e.target.value)
              }
            />

            <p className="word-count">
              {jobDescriptionWords} words
            </p>

          </div>

        </section>


        {/* Buttons */}
        <div className="button-group">

          <button
            className="analyze-button"
            onClick={analyzeCareer}
            disabled={loading}
          >
            {loading
              ? "Analyzing..."
              : "Analyze Career"}
          </button>


          <button
            className="clear-button"
            onClick={clearAnalysis}
            disabled={loading}
          >
            Clear
          </button>

        </div>


        {/* Error */}
        {error && (
          <p className="error">
            {error}
          </p>
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
                  {result.match_score !== undefined
                    ? `${result.match_score}%`
                    : "N/A"}
                </h3>

              </div>


              {result.match_score !== undefined && (
                <div className="score-bar">

                  <div
                    className="score-progress"
                    style={{
                      width: `${result.match_score}%`,
                    }}
                  ></div>

                </div>
              )}

            </div>


            {/* Matching Skills */}
            <div className="result-card">

              <h3>
                ✓ Matching Skills
              </h3>

              <ul>

                {result.matching_skills?.map(
                  (skill, index) => (
                    <li key={index}>
                      {skill}
                    </li>
                  )
                )}

              </ul>

            </div>


            {/* Missing Skills */}
            <div className="result-card">

              <h3>
                ⚠ Missing Skills
              </h3>

              <ul>

                {result.missing_skills?.map(
                  (skill, index) => (
                    <li key={index}>
                      {skill}
                    </li>
                  )
                )}

              </ul>

            </div>


            {/* Resume Improvements */}
            <div className="result-card">

              <h3>
                📝 Resume Improvements
              </h3>

              <ul>

                {result.resume_improvements?.map(
                  (improvement, index) => (
                    <li key={index}>
                      {improvement}
                    </li>
                  )
                )}

              </ul>

            </div>


            {/* Interview Questions */}
            <div className="result-card">

              <h3>
                🎯 Interview Questions
              </h3>

              <ul>

                {result.interview_questions?.map(
                  (question, index) => (
                    <li key={index}>
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

          <h2>
            Analysis History
          </h2>


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
                  onClick={() =>
                    viewAnalysis(item)
                  }
                >

                  <div className="history-header">

                    <h3>
                      Career Analysis
                    </h3>


                    {item.match_score !== undefined && (
                      <span className="history-score">
                        {item.match_score}%
                      </span>
                    )}

                  </div>


                  <p className="history-date">

                    {new Date(
                      item.createdAt
                    ).toLocaleString()}

                  </p>


                  <p className="history-preview">

                    {item.job_description.length > 120
                      ? `${item.job_description.substring(
                          0,
                          120
                        )}...`
                      : item.job_description}

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