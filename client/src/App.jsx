import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";
const MAX_RESUME_LENGTH = 15000;
const MAX_JOB_DESCRIPTION_LENGTH = 12000;

/* ---------- Small UI helpers ---------- */
const ICONS = {
  sun: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  upload: "M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5",
  check: "m5 12.5 4.5 4.5L19 7.5",
  info: "M12 8h.01M11 12h1v5h1m8-5a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  alert: "M12 8v5m0 3.5h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  spark: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z",
  logout: "M15 17l5-5-5-5m5 5H9m4 8H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7",
};

function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark"><Icon name="spark" /></span>
      VocaFit AI
    </span>
  );
}

function ThemeToggle({ theme, onToggle }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="icon-btn" onClick={onToggle}
      aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}

// Your app stores every message in one `error` state, so pick a tone from the text.
function toneOf(message) {
  if (/sent|verified successfully|success/i.test(message)) return "success";
  if (/wait|verify your email|enter the 6-digit/i.test(message)) return "info";
  return "error";
}

function Notice({ message, children }) {
  if (!message) return null;
  const tone = toneOf(message);
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "success" ? "check" : tone === "info" ? "info" : "alert"} />
      <div style={{ flex: 1 }}>
        <p>{message}</p>
        {children}
      </div>
    </div>
  );
}

const tierOf = (score) => (score >= 75 ? "high" : score >= 50 ? "mid" : "low");
const TIER_TEXT = {
  high: ["Strong match", "Your resume lines up well with this role. Polish the points below before you apply."],
  mid: ["Good start", "You have a solid base. Closing the skill gaps below will raise your chances."],
  low: ["Needs work", "There are real gaps for this role. Focus on the missing skills and improvements below."],
};

function ScoreRing({ score }) {
  const value = Math.min(100, Math.max(0, score));
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" role="progressbar" aria-label="Resume match score"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle className="ring-track" cx="66" cy="66" r={r} fill="none" strokeWidth="12" />
        <circle className="ring-fill" cx="66" cy="66" r={r} fill="none" strokeWidth="12"
          strokeDasharray={`${(value / 100) * c} ${c}`} />
      </svg>
      <div className="ring-value">{value}%</div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [authToken, setAuthToken] = useState(() => sessionStorage.getItem("authToken") || "");
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("currentUser") || "null");
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [verificationOtp, setVerificationOtp] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const resumeWords = resume.trim() ? resume.trim().split(/\s+/).length : 0;
  const jobDescriptionWords = jobDescription.trim() ? jobDescription.trim().split(/\s+/).length : 0;
  const busy = loading || uploadingResume;

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearAnalysis = () => {
    setResume("");
    setJobDescription("");
    setResult(null);
    setError("");
    setResumeFile(null);
    resetFileInput();
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      if (!authToken) {
        setHistory([]);
        return;
      }
      const response = await fetch(`${API}/analyses`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) throw new Error("Failed to fetch analysis history");
      setHistory(await response.json());
    } catch (err) {
      console.error("History error:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const postJson = (path, body) =>
    fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  // Register or log in, then save the session for this browser tab.
  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (authLoading) return;

    const cleanEmail = authEmail.trim().toLowerCase();
    const cleanName = authName.trim();

    if (authMode === "register" && !cleanName) return setError("Please enter your name.");
    if (!cleanEmail || !authPassword) return setError("Please enter your email and password.");
    if (authMode === "register" && authPassword.length < 8)
      return setError("Password must be at least 8 characters long.");

    try {
      setAuthLoading(true);
      setError("");

      if (authMode === "register") {
        const res = await postJson("/auth/register", { name: cleanName, email: cleanEmail, password: authPassword });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || "Failed to create account.");

        setAuthEmail(cleanEmail);
        setAuthPassword("");
        setVerificationOtp("");
        setAuthMode("verify");
        setError(data.message || "We sent a 6-digit verification code to your email.");
        return;
      }

      const res = await postJson("/auth/login", { email: cleanEmail, password: authPassword });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.requiresVerification) {
          setAuthMode("verify");
          setVerificationOtp("");
          throw new Error(data.error || data.message || "Please verify your email first.");
        }
        throw new Error(data.error || data.message || "Failed to log in.");
      }

      sessionStorage.setItem("authToken", data.token);
      sessionStorage.setItem("currentUser", JSON.stringify(data.user));
      setAuthToken(data.token);
      setCurrentUser(data.user);
      setAuthPassword("");
      setError("");
    } catch (authError) {
      console.error("Authentication error:", authError);
      setError(authError.message || "Authentication failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyEmail = async (event) => {
    event.preventDefault();
    if (authLoading) return;

    const cleanEmail = authEmail.trim().toLowerCase();
    const cleanOtp = verificationOtp.trim();
    if (!cleanEmail || !/^\d{6}$/.test(cleanOtp))
      return setError("Enter the 6-digit code sent to your email.");

    try {
      setAuthLoading(true);
      setError("");
      const res = await postJson("/auth/verify-email", { email: cleanEmail, otp: cleanOtp });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Email verification failed.");

      setVerificationOtp("");
      setAuthPassword("");
      setAuthMode("login");
      setError(data.message || "Email verified successfully. You can now log in.");
    } catch (verifyError) {
      console.error("Email verification error:", verifyError);
      setError(verifyError.message || "Email verification failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (authLoading) return;
    const cleanEmail = authEmail.trim().toLowerCase();
    if (!cleanEmail) return setError("Enter your email address first.");

    try {
      setAuthLoading(true);
      setError("");
      const res = await postJson("/auth/resend-otp", { email: cleanEmail });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Could not resend the code.");
      setError(data.message || "A new verification code has been sent.");
    } catch (resendError) {
      console.error("Resend OTP error:", resendError);
      setError(resendError.message || "Could not resend the code. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("currentUser");
    setAuthToken("");
    setCurrentUser(null);
    setHistory([]);
    setHistoryLoading(false);
    setResult(null);
    setResume("");
    setJobDescription("");
    setResumeFile(null);
    setError("");
    setAuthMode("login");
    resetFileInput();
  };

  const deleteAnalysis = async (id) => {
    if (!window.confirm("Are you sure you want to delete this analysis?")) return;

    try {
      const response = await fetch(`${API}/analyses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete analysis.");

      setHistory((prev) => prev.filter((item) => item._id !== id));
      setResult((prev) => (prev?._id === id ? null : prev));
      setError("");
    } catch (err) {
      console.error("Delete analysis error:", err);
      setError(err.message || "Failed to delete analysis.");
    }
  };

  const viewAnalysis = (analysis) => {
    setResult(analysis);
    setError("");
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  useEffect(() => {
    if (authToken) {
      fetchHistory();
    } else {
      setHistory([]);
      setHistoryLoading(false);
    }
  }, [authToken]);

  const uploadResume = async (file) => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      resetFileInput();
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("PDF must be smaller than 5 MB.");
      resetFileInput();
      return;
    }

    try {
      setUploadingResume(true);
      setError("");

      const formData = new FormData();
      formData.append("resume", file);

      
const response = await fetch(`${API}/upload-resume`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${authToken}`,
  },
  body: formData,
});

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to upload resume.");

      if (typeof data.text !== "string" || !data.text.trim())
        throw new Error("No readable text was extracted from this PDF.");
      if (data.text.length > MAX_RESUME_LENGTH)
        throw new Error("Extracted resume exceeds the 15,000-character limit. Please use a shorter resume.");

      setResumeFile(file);
      setResume(data.text);
      setResult(null);
    } catch (err) {
      console.error("Resume upload error:", err);
      setError(err.message || "Failed to upload resume.");
      setResumeFile(null);
      resetFileInput();
    } finally {
      setUploadingResume(false);
    }
  };

  const removeResume = () => {
    setResumeFile(null);
    setResume("");
    setResult(null);
    setError("");
    resetFileInput();
  };

  const analyzeCareer = async () => {
    if (busy) return;

    const cleanResume = resume.trim();
    const cleanJob = jobDescription.trim();

    if (!cleanResume || !cleanJob) return setError("Please enter both your resume and job description.");
    if (cleanResume.length < 50) return setError("Your resume is too short. Please provide at least 50 characters.");
    if (cleanJob.length < 50) return setError("The job description is too short. Please provide at least 50 characters.");
    if (cleanResume.length > MAX_RESUME_LENGTH) return setError("Resume exceeds the 15,000-character limit.");
    if (cleanJob.length > MAX_JOB_DESCRIPTION_LENGTH) return setError("Job description exceeds the 12,000-character limit.");

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const response = await fetch(`${API}/analyze-career`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ resume: cleanResume, job_description: cleanJob }),
      });

      if (!response.ok) {
        let message = "Failed to analyze career.";
        try {
          const errorData = await response.json();
          if (typeof errorData.detail === "string") message = errorData.detail;
          else if (typeof errorData.error === "string") message = errorData.error;
        } catch {
          // Keep the default error message.
        }
        throw new Error(message);
      }

      setResult(await response.json());
      void fetchHistory();
    } catch (err) {
      console.error("Analysis error:", err);
      setError(
        "We couldn't analyze your resume right now. Check that the backend and AI service are running, then try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Login / Register / Verify ---------- */
  if (!authToken || !currentUser) {
    const titles = { login: "Welcome back", register: "Create your account", verify: "Verify your email" };
    const subs = {
      login: "Log in to see your saved career reports.",
      register: "Your reports stay private and only you can see them.",
      verify: `Enter the 6-digit code we sent to ${authEmail.trim() || "your email"}. It expires in 10 minutes.`,
    };

    return (
      <div className="auth">
        <aside className="auth-brand">
          <Logo />
          <div>
            <h1>Find out how well your resume fits the job.</h1>
            <p className="lead">
              Get a clear report with your match score, missing skills, and interview questions to practice.
            </p>
            <ol className="steps">
              <li><b>1</b>Upload your resume or paste it in</li>
              <li><b>2</b>Paste the job description</li>
              <li><b>3</b>Get your report in seconds</li>
            </ol>
          </div>
          <span />
        </aside>

        <main className="auth-panel">
          <div className="theme-slot"><ThemeToggle theme={theme} onToggle={toggleTheme} /></div>

          <section className="auth-card">
            <h2>{titles[authMode]}</h2>
            <p className="sub">{subs[authMode]}</p>

            <Notice message={error} />

            {authMode === "verify" ? (
              <form onSubmit={handleVerifyEmail}>
                <label className="field">
                  <span>Email</span>
                  <input className="input" type="email" value={authEmail} autoComplete="email" required
                    onChange={(e) => setAuthEmail(e.target.value)} />
                </label>
                <label className="field">
                  <span>6-digit code</span>
                  <input className="input otp" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                    value={verificationOtp} autoComplete="one-time-code" required placeholder="000000"
                    onChange={(e) => setVerificationOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                </label>
                <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={authLoading}>
                  {authLoading ? "Please wait..." : "Verify email"}
                </button>
                <p className="resend">
                  Didn't get a code?{" "}
                  <button type="button" className="link-button" onClick={handleResendOtp} disabled={authLoading}>
                    Resend code
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleAuthSubmit}>
                {authMode === "register" && (
                  <label className="field">
                    <span>Name</span>
                    <input className="input" type="text" value={authName} autoComplete="name" required
                      placeholder="Your full name" onChange={(e) => setAuthName(e.target.value)} />
                  </label>
                )}
                <label className="field">
                  <span>Email</span>
                  <input className="input" type="email" value={authEmail} autoComplete="email" required
                    placeholder="you@example.com" onChange={(e) => setAuthEmail(e.target.value)} />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input className="input" type="password" value={authPassword} required
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    minLength={authMode === "register" ? 8 : undefined}
                    onChange={(e) => setAuthPassword(e.target.value)} />
                  {authMode === "register" && <small>Use at least 8 characters.</small>}
                </label>
                <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={authLoading}>
                  {authLoading ? "Please wait..." : authMode === "login" ? "Log in" : "Create account"}
                </button>
              </form>
            )}

            <p className="auth-switch">
              {authMode === "verify" ? (
                <button type="button" className="link-button"
                  onClick={() => { setAuthMode("login"); setVerificationOtp(""); setError(""); }}>
                  Back to log in
                </button>
              ) : (
                <>
                  {authMode === "login" ? "New here? " : "Already have an account? "}
                  <button type="button" className="link-button"
                    onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }}>
                    {authMode === "login" ? "Create an account" : "Log in"}
                  </button>
                </>
              )}
            </p>
          </section>
        </main>
      </div>
    );
  }

  /* ---------- Dashboard ---------- */
  const firstName = (currentUser.name || "there").split(" ")[0];
  const hasScore = result && typeof result.match_score === "number";
  const tier = hasScore ? tierOf(result.match_score) : "mid";

  return (
    <div>
      <header className="topbar">
        <Logo />
        <div className="topbar-right">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <div className="user-chip">
            <span className="avatar">{firstName.charAt(0).toUpperCase()}</span>
            <span className="name">{currentUser.name}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            <Icon name="logout" />Log out
          </button>
        </div>
      </header>

      <main className="page">
        <section className="intro">
          <h1>Hi {firstName}, let's check your fit for a job.</h1>
          <p>Add your resume and the job description. You'll get your match score, the skills to work on, and questions to practice.</p>
        </section>

        <section className="panels">
          <div className="panel">
            <h2>Your resume</h2>
            <p className="hint">Upload a PDF or paste the text.</p>

            <label className="dropzone">
              <span className="icon-wrap"><Icon name="upload" /></span>
              <span>
                <strong>{uploadingResume ? "Reading your PDF..." : "Upload resume PDF"}</strong>
                <span>PDF up to 5 MB</span>
              </span>
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" disabled={busy}
                onChange={(e) => uploadResume(e.target.files?.[0])} />
            </label>

            {resumeFile && (
              <div className="file-chip">
                <div>
                  <strong>{resumeFile.name}</strong>
                  <small>{(resumeFile.size / 1024).toFixed(1)} KB</small>
                </div>
                <button type="button" className="btn btn-danger" onClick={removeResume} disabled={busy}>
                  Remove
                </button>
              </div>
            )}

            <div className="divider">or paste your resume</div>

            <textarea className="textarea" placeholder="Paste your resume here..." value={resume}
              maxLength={MAX_RESUME_LENGTH} disabled={busy}
              onChange={(e) => { setResume(e.target.value); setResumeFile(null); setResult(null); setError(""); }} />
            <p className="counter">{resumeWords} words · {resume.length.toLocaleString()} / {MAX_RESUME_LENGTH.toLocaleString()}</p>
          </div>

          <div className="panel">
            <h2>Job description</h2>
            <p className="hint">Paste the full job post you're applying for.</p>

            <textarea className="textarea" style={{ minHeight: 330 }} placeholder="Paste the job description here..."
              value={jobDescription} maxLength={MAX_JOB_DESCRIPTION_LENGTH} disabled={busy}
              onChange={(e) => { setJobDescription(e.target.value); setResult(null); setError(""); }} />
            <p className="counter">{jobDescriptionWords} words · {jobDescription.length.toLocaleString()} / {MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()}</p>
          </div>
        </section>

        <div className="actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={analyzeCareer} disabled={busy}>
            {loading ? (<><span className="spinner" />Analyzing...</>)
              : uploadingResume ? "Reading resume..."
              : (<><Icon name="spark" />Analyze my career</>)}
          </button>
          <button type="button" className="btn btn-secondary btn-lg" onClick={clearAnalysis} disabled={busy}>
            Clear
          </button>
        </div>

        <div className="status-wrap">
          <Notice message={error}>
            {resume.trim() && jobDescription.trim() && !busy && toneOf(error) === "error" && (
              <div className="notice-actions">
                <button type="button" className="btn btn-secondary" onClick={analyzeCareer}>Try again</button>
              </div>
            )}
          </Notice>
        </div>

        {result && (
          <section ref={resultsRef}>
            <h2 className="section-title">Your career report</h2>
            <div className="report">
              <div className={`score-card tier-${tier}`}>
                {hasScore && <ScoreRing score={result.match_score} />}
                <div>
                  <h3>{hasScore ? TIER_TEXT[tier][0] : "Score not available"}</h3>
                  <p>{hasScore ? TIER_TEXT[tier][1] : "We couldn't calculate a match score, but the details are below."}</p>
                </div>
              </div>

              <div className="two-col">
                <div className="result-card">
                  <h3>Skills you already have</h3>
                  <p className="hint">These match what the job asks for.</p>
                  <div className="chips">
                    {result.matching_skills?.length
                      ? result.matching_skills.map((s, i) => <span key={`${s}-${i}`} className="chip chip-ok">{s}</span>)
                      : <p className="empty-line">No matching skills found.</p>}
                  </div>
                </div>
                <div className="result-card">
                  <h3>Skills to add</h3>
                  <p className="hint">The job asks for these and your resume doesn't show them yet.</p>
                  <div className="chips">
                    {result.missing_skills?.length
                      ? result.missing_skills.map((s, i) => <span key={`${s}-${i}`} className="chip chip-warn">{s}</span>)
                      : <p className="empty-line">Nothing missing. Nice work.</p>}
                  </div>
                </div>
              </div>

              <div className="result-card">
                <h3>How to improve your resume</h3>
                <p className="hint">Small changes that make a big difference.</p>
                <ul className="check-list">
                  {result.resume_improvements?.map((item, i) => (
                    <li key={`${item}-${i}`}><Icon name="check" /><span>{item}</span></li>
                  ))}
                </ul>
              </div>

              <div className="result-card">
                <h3>Interview questions to practice</h3>
                <p className="hint">Prepare an answer for each before your interview.</p>
                <ul className="q-list">
                  {result.interview_questions?.map((q, i) => <li key={`${q}-${i}`}>{q}</li>)}
                </ul>
              </div>
            </div>
          </section>
        )}

        <section>
          <h2 className="section-title">Your past reports</h2>
          {historyLoading ? (
            <p className="empty-line">Loading your reports...</p>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <strong>No reports yet</strong>
              Run your first analysis above and it will be saved here.
            </div>
          ) : (
            <div className="history-grid">
              {history.map((item) => {
                const scored = typeof item.match_score === "number";
                return (
                  <article className="history-card" key={item._id}>
                    <button type="button" className="history-view" onClick={() => viewAnalysis(item)}>
                      <div className="history-top">
                        <span className="history-date">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Date unavailable"}
                        </span>
                        {scored && (
                          <span className={`score-pill tier-${tierOf(item.match_score)}`}>{item.match_score}%</span>
                        )}
                      </div>
                      <p className="history-preview">
                        {item.job_description || "No job description available"}
                      </p>
                    </button>
                    <div className="history-foot">
                      <span className="view-label">View report</span>
                      <button type="button" className="btn btn-danger" onClick={() => deleteAnalysis(item._id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
