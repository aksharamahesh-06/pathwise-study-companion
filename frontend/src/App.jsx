import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")
  .replace(/\/+$/, "");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function App() {
  const [studyHistory, setStudyHistory] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("pathwise.studyHistory") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [showStudyLibrary, setShowStudyLibrary] = useState(false);
  const [file, setFile] = useState(null);
  const [activeStudyName, setActiveStudyName] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [summary, setSummary] = useState("");
  const [flashcards, setFlashcards] = useState([]);
  const [longAnswerQuestions, setLongAnswerQuestions] = useState([]);
  const [mcqs, setMcqs] = useState([]);
  const [quizSize, setQuizSize] = useState(10);
  const [quizStarted, setQuizStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [revealedCards, setRevealedCards] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [analysisNotice, setAnalysisNotice] = useState("");
  const resultsRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      window.localStorage.setItem("pathwise.studyHistory", JSON.stringify(studyHistory));
    } catch {
      // Keep the app usable if this browser blocks or fills local storage.
    }
  }, [studyHistory]);
  const quizQuestions = mcqs.slice(0, quizSize);
  const quizScore = quizQuestions.filter(
    (question, index) => answers[index] === question.answer
  ).length;
  const topicResults = quizQuestions.reduce((results, question, index) => {
    const topic = question.topic || "General concepts";
    results[topic] ??= { correct: 0, total: 0 };
    results[topic].total += 1;
    if (answers[index] === question.answer) results[topic].correct += 1;
    return results;
  }, {});
  const weakTopics = Object.entries(topicResults)
    .filter(([, result]) => result.correct < result.total)
    .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);

  const downloadStudyPack = () => {
    const summaryHtml = document.querySelector(".summary-content")?.innerHTML
      || "<p>No summary was generated.</p>";
    const flashcardHtml = flashcards.map((card, index) => `
      <article class="flashcard">
        <h3>Flashcard ${index + 1}</h3>
        <p><strong>Question:</strong> ${escapeHtml(card.front)}</p>
        <p><strong>Answer:</strong> ${escapeHtml(card.back)}</p>
      </article>
    `).join("");
    const questionHtml = longAnswerQuestions.map((item) => `
      <li>${escapeHtml(item.question)}</li>
    `).join("");
    const answerGuideHtml = longAnswerQuestions.map((item, index) => `
      <article class="answer-guide">
        <h3>Question ${index + 1}</h3>
        <p>${escapeHtml(item.question)}</p>
        <p><strong>Answer guide:</strong> ${escapeHtml(item.answer_guide)}</p>
      </article>
    `).join("");
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PathWise Study Pack</title>
  <style>
    body{max-width:850px;margin:40px auto;padding:0 24px;color:#202331;font:16px/1.7 Arial,sans-serif}
    h1{color:#76550b;border-bottom:2px solid #f0dfb5;padding-bottom:12px}
    h2{margin-top:32px;padding:10px 14px;border:1px solid #f0dfb5;border-left:5px solid #c89d2d;border-radius:8px;background:#fff8e6;color:#8a650e}
    h3{color:#76550b}.flashcard,.answer-guide{margin:14px 0;padding:16px;border:1px solid #eadfc3;border-radius:10px;background:#fffdf8}
    li{margin:14px 0}.answer-key{break-before:page;page-break-before:always}
    @media print{body{margin:0 auto}.answer-key{break-before:page;page-break-before:always}h2,.flashcard,.answer-guide{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style>
</head>
<body>
  <h1>PathWise Study Pack</h1>
  <section><h2>Summary</h2>${summaryHtml}</section>
  ${flashcards.length ? `<section><h2>Flashcards</h2>${flashcardHtml}</section>` : ""}
  ${longAnswerQuestions.length ? `<section><h2>Long-answer practice</h2><p>Try these questions in your notebook before checking the answer guide.</p><ol>${questionHtml}</ol><div class="answer-key"><h2>Suggested answer guide</h2>${answerGuideHtml}</div></section>` : ""}
</body>
</html>`;
    const studyPackFile = new Blob([html], { type: "text/html;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(studyPackFile);
    const link = document.createElement("a");
    const baseName = (activeStudyName || file?.name || "PathWise-Study-Pack")
      .replace(/\.pdf$/i, "")
      .replace(/[<>:"/\\|?*]/g, "-");
    link.href = downloadUrl;
    link.download = `${baseName}-study-pack.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  };

  const openStudySession = (session) => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setActiveStudyName(session.fileName || "Study session");
    setCurrentSessionId(session.id);
    setSummary(session.summary || "");
    setFlashcards(session.flashcards || []);
    setLongAnswerQuestions(session.longAnswerQuestions || []);
    setMcqs(session.mcqs || []);
    setQuizSize(Math.min(10, session.mcqs?.length || 10));
    setQuizStarted(false);
    setAnswers({});
    setQuizSubmitted(false);
    setRevealedCards({});
    setAnalysisNotice(session.analysisNotice || "");
    setAnalysisError("");
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const submitTest = () => {
    setQuizSubmitted(true);
    if (!currentSessionId) return;
    const savedScore = {
      score: quizScore,
      total: quizQuestions.length,
      weakTopics: weakTopics.map(([topic, result]) => ({
        topic,
        correct: result.correct,
        total: result.total,
      })),
      completedAt: new Date().toISOString(),
    };
    setStudyHistory((current) => current.map((session) => (
      session.id === currentSessionId ? { ...session, lastScore: savedScore } : session
    )));
  };

  const features = [
    {
      title: "Smart Summaries",
      description:
        "Generate concise, exam-ready summaries from lengthy study materials.",
    },
    {
      title: "AI Flashcards",
      description:
        "Automatically create revision flashcards for faster learning.",
    },
    {
      title: "Assessments",
      description:
        "Practice with AI-generated questions based on your notes.",
    },
    {
      title: "Learning Analytics",
      description:
        "Identify weak areas and improve your study performance.",
    },
  ];

  const handleAnalyze = async () => {
  if (!file) {
    setUploadError("Choose a PDF before starting the analysis.");
    return;
  }

  try {
    setLoading(true);
    setUploadError("");
    setAnalysisError("");
    setAnalysisNotice("");
    setActiveStudyName(file.name);
    setCurrentSessionId(null);
    setSummary("");
    setFlashcards([]);
    setLongAnswerQuestions([]);
    setMcqs([]);
    setQuizSize(10);
    setQuizStarted(false);
    setAnswers({});
    setQuizSubmitted(false);
    setRevealedCards({});

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/materials/upload`, {
      method: "POST",
      body: formData,
    });

    console.log("STATUS:", response.status);

    const data = await response.json().catch(() => ({}));

    console.log("DATA:", data);

    if (!response.ok) {
      throw new Error(
        data.detail || "Backend error"
      );
    }

    setSummary(data.summary || "");
    setFlashcards(data.flashcards || []);
    setLongAnswerQuestions(data.long_answer_questions || []);
    setMcqs(data.mcqs || []);
    setQuizSize(Math.min(10, data.mcqs?.length || 10));
    setAnalysisNotice(data.analysis_notice || "");
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setCurrentSessionId(sessionId);
    const savedSession = {
      id: sessionId,
      fileName: file.name,
      createdAt: new Date().toISOString(),
      summary: data.summary || "",
      flashcards: data.flashcards || [],
      longAnswerQuestions: data.long_answer_questions || [],
      mcqs: data.mcqs || [],
      analysisNotice: data.analysis_notice || "",
      lastScore: null,
    };
    setStudyHistory((current) => [savedSession, ...current].slice(0, 10));
    const generationErrors = [...new Set(
      [data.summary_error, data.mcq_error].filter(Boolean)
    )];
    if (generationErrors.length) {
      setAnalysisError(generationErrors.join(" "));
    }
  } catch (error) {
    console.error("FULL ERROR:", error);
    setAnalysisError(error.message || "Failed to analyze the PDF.");
  } finally {
    setLoading(false);
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
};
  return (
    <div className="app">
      <nav className="navbar">
        <a className="logo" href="#top" aria-label="PathWise home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>PathWise</span>
        </a>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How It Works</a>
          <a href="#benefits">Benefits</a>
          <button
            className={`library-trigger${showStudyLibrary ? " is-open" : ""}`}
            type="button"
            aria-expanded={showStudyLibrary}
            aria-controls="study-library"
            onClick={() => setShowStudyLibrary((open) => !open)}
          >
            <span aria-hidden="true">▤</span> My Studies
            {studyHistory.length > 0 && <span className="library-count">{studyHistory.length}</span>}
          </button>
          <button className="nav-btn" onClick={() => fileInputRef.current?.click()}>
            <span aria-hidden="true">＋</span> Upload PDF
          </button>
        </div>
        {showStudyLibrary && (
          <div className="study-library" id="study-library" role="dialog" aria-label="My Studies">
            <div className="study-library-header">
              <div>
                <span className="library-eyebrow">YOUR LIBRARY</span>
                <h2>My Studies</h2>
              </div>
              <button className="library-close" type="button" onClick={() => setShowStudyLibrary(false)} aria-label="Close study library">×</button>
            </div>
            <p className="library-description">Open past summaries, flashcards, questions and scores. Saved in this browser on this device.</p>
            {studyHistory.length === 0 ? (
              <div className="library-empty">
                <span className="library-empty-icon" aria-hidden="true">✦</span>
                <strong>Your study space is ready</strong>
                <span>Analyze your first PDF and it will appear here.</span>
                <button type="button" className="history-open-btn" onClick={() => {
                  setShowStudyLibrary(false);
                  fileInputRef.current?.click();
                }}>Choose a PDF</button>
              </div>
            ) : (
              <div className="study-library-list">
                {studyHistory.map((session) => (
                  <article className={`library-session${currentSessionId === session.id ? " is-current" : ""}`} key={session.id}>
                    <button className="library-session-open" type="button" onClick={() => {
                      openStudySession(session);
                      setShowStudyLibrary(false);
                    }}>
                      <span className="library-file-icon" aria-hidden="true">PDF</span>
                      <span className="library-session-copy">
                        <strong title={session.fileName}>{session.fileName || "Study session"}</strong>
                        <span>{new Date(session.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          {session.lastScore ? ` · Score ${session.lastScore.score}/${session.lastScore.total}` : " · Ready to study"}
                        </span>
                      </span>
                      <span className="library-chevron" aria-hidden="true">›</span>
                    </button>
                    <button type="button" className="library-delete" onClick={() => {
                      setStudyHistory((current) => current.filter((item) => item.id !== session.id));
                      if (currentSessionId === session.id) setCurrentSessionId(null);
                    }} aria-label={`Remove ${session.fileName || "study session"}`}>×</button>
                  </article>
                ))}
              </div>
            )}
            <div className="library-footer"><span>Study results only · Up to 10 studies · PDFs are not stored</span></div>
          </div>
        )}
      </nav>

      <section className="hero" id="top">
        <div className="hero-left">
          <span className="badge">
            YOUR PERSONAL STUDY SPACE
          </span>

          <h1>
            Make your notes
            <br />
            work <em>for you.</em>
          </h1>

          <p>
            Turn a PDF into clear summaries, quick-review flashcards, and a practice test—all in one calm, focused place.
          </p>

          <div className="upload-card">
            <div className="upload-card-heading">
              <span className="upload-card-icon" aria-hidden="true">↑</span>
              <div>
                <strong>Start with your study material</strong>
                <span>PDF files · up to 20 MB</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              id="study-pdf"
              type="file"
              accept=".pdf"
              className="visually-hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0] || null;
                setUploadError("");
                setAnalysisError("");
                if (selected && selected.size > 20 * 1024 * 1024) {
                  setFile(null);
                  e.target.value = "";
                  setUploadError("That PDF is over 20 MB. Choose a smaller file.");
                  return;
                }
                if (selected && !selected.name.toLowerCase().endsWith(".pdf")) {
                  setFile(null);
                  e.target.value = "";
                  setUploadError("Please choose a PDF file.");
                  return;
                }
                setFile(selected);
              }}
            />
            <label className="file-picker" htmlFor="study-pdf">
              <span className="file-picker-name">{file?.name || "Choose a PDF from your device"}</span>
              <span className="file-picker-action">{file ? "Change" : "Browse"}</span>
            </label>
            <button
              className="primary-btn"
              onClick={handleAnalyze}
              disabled={!file || loading}
            >
              {loading ? <><span className="button-spinner" aria-hidden="true" /> Creating your study kit…</> : <>Create my study kit <span aria-hidden="true">→</span></>}
            </button>
            {uploadError && <p className="upload-error" role="alert">{uploadError}</p>}
            {file && !loading && <p className="upload-ready">✓ Ready to analyze {file.name}</p>}
          </div>

          {loading && <p className="upload-progress" role="status">Reading your PDF and preparing your study materials. This may take a moment.</p>}
        </div>

        <div className="hero-right">
          <div className="preview-card">
            <div className="preview-card-topline"><span className="preview-sparkle" aria-hidden="true">✦</span><span>THE PATHWISE STUDY FLOW</span></div>
            <h3>One upload.<br /><em>A whole plan.</em></h3>
            <p className="preview-intro">Everything you need to understand, remember, and practice.</p>
            <div className="preview-flow-list">
              <div className="preview-flow-item"><span className="flow-number">01</span><span className="flow-copy"><strong>Get the big picture</strong><small>A clear, structured summary</small></span><span className="flow-arrow" aria-hidden="true">↗</span></div>
              <div className="preview-flow-item"><span className="flow-number">02</span><span className="flow-copy"><strong>Remember the details</strong><small>Flashcards for active recall</small></span><span className="flow-arrow" aria-hidden="true">↗</span></div>
              <div className="preview-flow-item"><span className="flow-number">03</span><span className="flow-copy"><strong>Know what to revisit</strong><small>A test with topic feedback</small></span><span className="flow-arrow" aria-hidden="true">↗</span></div>
            </div>
            <div className="preview-card-footer"><span className="preview-dots"><i /><i /><i /></span><span>Made for focused learning</span></div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="features-section"
      >
        <div className="section-title">
          <h2>Everything You Need</h2>
          <p>
            Powerful AI tools designed for students.
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="feature-card"
            >
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="how-section">
        <div className="section-title">
          <h2>How It Works</h2>
        </div>

        <div className="steps">
          <div className="step">
            <span>01</span>
            <h3>Upload</h3>
            <p>Upload notes, textbooks or PDFs.</p>
          </div>

          <div className="step">
            <span>02</span>
            <h3>Analyze</h3>
            <p>AI processes and understands content.</p>
          </div>

          <div className="step">
            <span>03</span>
            <h3>Learn</h3>
            <p>Study using summaries and flashcards.</p>
          </div>
        </div>
      </section>

      {(summary || flashcards.length > 0 || longAnswerQuestions.length > 0 || mcqs.length > 0 || analysisError || analysisNotice) && (
        <section
          ref={resultsRef}
          className="results-section"
          style={{
            padding: "60px 5%",
          }}
        >
          <div className="results-header">
            <h2>Analysis Results</h2>
            <button
              className="study-pack-download"
              type="button"
              onClick={downloadStudyPack}
            >
              Download Study Pack (.html)
            </button>
          </div>
          <p className="download-hint">Downloads a file. Open it in a browser to print or save as PDF.</p>

          {analysisNotice && (
            <p className="analysis-notice" role="status">
              {analysisNotice}
            </p>
          )}

          {analysisError && (
            <p className="analysis-error" role="alert">
              {analysisError}
            </p>
          )}

          <div
            className="feature-card summary-card"
            style={{
              marginBottom: "30px",
            }}
          >
            <h3>Summary</h3>
         <div
           className="summary-content"
           style={{
           marginTop: "15px",
         }}
>
         {summary ? (
           <ReactMarkdown>{summary}</ReactMarkdown>
         ) : (
           <p>No summary was generated.</p>
         )}
         </div>
          </div>

          {flashcards.length > 0 && (
            <div className="feature-card study-card">
              <h3>Flashcards</h3>
              <p className="study-card-hint">Select a card to reveal its answer.</p>
              <div className="flashcard-grid">
                {flashcards.map((card, index) => (
                  <button
                    key={index}
                    type="button"
                    className="flashcard"
                    aria-pressed={Boolean(revealedCards[index])}
                    onClick={() => setRevealedCards((current) => ({
                      ...current,
                      [index]: !current[index],
                    }))}
                  >
                    <span className="flashcard-label">
                      {revealedCards[index] ? "Answer" : "Question"}
                    </span>
                    <span>{revealedCards[index] ? card.back : card.front}</span>
                    <span className="print-only print-flashcard-content">
                      <b>Question:</b> {card.front}<br />
                      <b>Answer:</b> {card.back}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {longAnswerQuestions.length > 0 && (
            <div className="feature-card study-card long-answer-card">
              <h3>Long-answer practice</h3>
              <p className="study-card-hint">
                Write your answers in a notebook, then check the answer guide on the next page.
              </p>
              <ol className="long-answer-list">
                {longAnswerQuestions.map((item, index) => (
                  <li key={index}>{item.question}</li>
                ))}
              </ol>
              <div className="answer-guides">
                <h4>Suggested answer guide</h4>
                {longAnswerQuestions.map((item, index) => (
                  <details key={index} className="answer-guide">
                    <summary>Question {index + 1}</summary>
                    <p>{item.answer_guide}</p>
                  </details>
                ))}
              </div>
            </div>
          )}

          <div className="feature-card mcq-card quiz-card">
            <h3>Practice Test</h3>
            {mcqs.length === 0 ? (
              <p>No questions were generated.</p>
            ) : !quizStarted ? (
              <div className="quiz-start">
                <label htmlFor="quiz-size">Number of questions</label>
                <select
                  id="quiz-size"
                  value={quizSize}
                  onChange={(event) => setQuizSize(Number(event.target.value))}
                >
                  <option value={Math.min(10, mcqs.length)}>
                    {Math.min(10, mcqs.length)} questions
                  </option>
                  {mcqs.length >= 20 && <option value={20}>20 questions</option>}
                </select>
                <button
                  className="primary-btn"
                  type="button"
                  onClick={() => {
                    setAnswers({});
                    setQuizSubmitted(false);
                    setQuizStarted(true);
                  }}
                >
                  Start Test
                </button>
              </div>
            ) : (
              <>
                <p className="quiz-progress">
                  Answer the questions, then submit to see your score and topics to review.
                </p>
                {quizQuestions.map((mcq, index) => (
                  <fieldset key={index} className="quiz-question">
                    <legend>Q{index + 1}. {mcq.question}</legend>
                    <div className="quiz-options">
                      {mcq.options?.map((option, optionIndex) => (
                        <label key={optionIndex} className="quiz-option">
                          <input
                            type="radio"
                            name={`question-${index}`}
                            value={option}
                            checked={answers[index] === option}
                            disabled={quizSubmitted}
                            onChange={() => setAnswers((current) => ({
                              ...current,
                              [index]: option,
                            }))}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                    {quizSubmitted && (
                      <div
                        className={`answer-review ${
                          answers[index] === mcq.answer ? "answer-correct" : "answer-incorrect"
                        }`}
                      >
                        <strong>
                          {answers[index] === mcq.answer ? "Correct" : "Not quite"}
                        </strong>
                        {answers[index] && answers[index] !== mcq.answer && (
                          <p>Your answer: {answers[index]}</p>
                        )}
                        <p><b>Correct answer:</b> {mcq.answer}</p>
                      </div>
                    )}
                  </fieldset>
                ))}
                {!quizSubmitted ? (
                  <button
                    className="primary-btn submit-test-btn"
                    type="button"
                    onClick={submitTest}
                  >
                    Submit Test
                  </button>
                ) : (
                  <div className="quiz-results" role="status">
                    <h4>Your score: {quizScore}/{quizQuestions.length}</h4>
                    {weakTopics.length === 0 ? (
                      <p>Excellent work—you answered every topic correctly.</p>
                    ) : (
                      <>
                        <p>Topics to review:</p>
                        <ul>
                          {weakTopics.map(([topic, result]) => (
                            <li key={topic}>
                              {topic}: {result.correct}/{result.total} correct
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <button
                      className="secondary-btn retake-test-btn"
                      type="button"
                      onClick={() => {
                        setAnswers({});
                        setQuizSubmitted(false);
                      }}
                    >
                      Retake Test
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      <section
        id="benefits"
        className="benefits-section"
      >
        <div className="section-title">
          <h2>Built For Better Learning</h2>
        </div>

        <div className="benefits-grid">
          <div>
            <h3>Save Time</h3>
            <p>
              Reduce hours spent creating notes.
            </p>
          </div>

          <div>
            <h3>Focus Better</h3>
            <p>
              Identify weak areas instantly.
            </p>
          </div>

          <div>
            <h3>Improve Results</h3>
            <p>
              Learn faster and perform better.
            </p>
          </div>
        </div>
      </section>

      <footer>
        © 2026 PathWise. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
