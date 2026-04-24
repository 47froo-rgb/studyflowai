import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import Loader from "@/components/Loader";
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Trophy } from "@phosphor-icons/react";
import { toast } from "sonner";

const QuizPage = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/quizzes/${id}`);
      setQuiz(data);
      setAnswers(new Array(data.questions.length).fill(-1));
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
      nav("/dashboard");
    }
  }, [id, nav]);

  useEffect(() => { load(); }, [load]);

  const select = (optionIdx) => {
    const next = [...answers];
    next[idx] = optionIdx;
    setAnswers(next);
  };

  const submit = async () => {
    if (answers.includes(-1)) return toast.error("Answer every question first");
    setSubmitting(true);
    try {
      const { data } = await api.post("/quizzes/submit", { quiz_id: id, answers });
      setResult(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  if (!quiz) return <Loader />;

  if (result) {
    const { result: r, review } = result;
    const level = r.percent >= 80 ? { c: "bg-mint", l: "Outstanding" }
      : r.percent >= 60 ? { c: "bg-sun", l: "Solid attempt" }
      : { c: "bg-coral", l: "Keep practising" };

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="quiz-result">
        <div className={`brut-card p-8 ${level.c}`}>
          <div className="flex items-center gap-3">
            <Trophy size={32} weight="duotone" />
            <h1 className="font-heading text-3xl sm:text-4xl font-black">{level.l}</h1>
          </div>
          <p className="mt-2 text-ink/80">
            You scored <span className="font-black">{r.score}/{r.total}</span> ({r.percent}%) on "{quiz.document_title}".
          </p>
          <div className="mt-6 flex gap-2 flex-wrap">
            <Link to={`/documents/${quiz.document_id}`} className="brut-btn-secondary" data-testid="back-to-doc">
              <ArrowLeft size={14} weight="bold" /> Back to document
            </Link>
            <Link to="/progress" className="brut-btn-primary" data-testid="go-progress">
              View progress <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </div>

        <h2 className="mt-10 font-heading text-2xl font-bold">Review</h2>
        <div className="mt-4 space-y-4">
          {review.map((q, i) => (
            <div key={i} className="brut-card p-5" data-testid={`review-${i}`}>
              <p className="font-heading font-bold text-lg">
                <span className="mr-2 brut-badge bg-lavender">{String(i + 1).padStart(2, "0")}</span>
                {q.question}
              </p>
              <div className="mt-3 grid gap-2">
                {q.options.map((opt, j) => {
                  const isRight = j === q.correct_index;
                  const isUser = j === q.user_answer;
                  const cls = isRight
                    ? "bg-mint border-ink"
                    : isUser
                    ? "bg-coral border-ink"
                    : "bg-white border-ink/40";
                  return (
                    <div key={j} className={`flex items-center gap-2 border-2 rounded-md p-3 ${cls}`}>
                      {isRight ? <CheckCircle size={16} weight="fill" /> : isUser ? <XCircle size={16} weight="fill" /> : <span className="w-4" />}
                      <span className="text-sm">{opt}</span>
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <p className="mt-3 text-sm text-ink/70 italic">↳ {q.explanation}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const total = quiz.questions.length;
  const q = quiz.questions[idx];
  const progressPct = Math.round(((idx + 1) / total) * 100);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="quiz-page">
      <Link to={`/documents/${quiz.document_id}`} className="inline-flex items-center gap-1 text-sm font-bold mb-4 hover:underline" data-testid="quiz-back">
        <ArrowLeft size={14} weight="bold" /> Back to document
      </Link>

      <p className="text-sm text-ink/60 font-bold">Quiz for</p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black">{quiz.document_title}</h1>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex-1 h-4 border-2 border-ink rounded-md overflow-hidden bg-white">
          <div className="h-full bg-lavender transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="font-heading font-bold text-sm w-20 text-right" data-testid="quiz-progress">
          {idx + 1} / {total}
        </span>
      </div>

      <div className="mt-8 brut-card p-6 sm:p-8 animate-fade-up" key={idx} data-testid={`question-${idx}`}>
        <p className="font-heading text-xl sm:text-2xl font-bold leading-snug">
          {q.question}
        </p>
        <div className="mt-6 grid gap-3">
          {q.options.map((opt, j) => {
            const selected = answers[idx] === j;
            return (
              <button
                key={j}
                onClick={() => select(j)}
                data-testid={`option-${idx}-${j}`}
                className={`text-left border-2 border-ink rounded-md p-4 transition-all font-body ${
                  selected
                    ? "bg-mint shadow-brut translate-x-0 translate-y-0"
                    : "bg-white shadow-brut hover:-translate-y-1 hover:shadow-brut-lg"
                }`}
              >
                <span className="font-heading font-bold mr-2">{String.fromCharCode(65 + j)}.</span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          disabled={idx === 0}
          onClick={() => setIdx(idx - 1)}
          className="brut-btn-secondary"
          data-testid="quiz-prev"
        >
          <ArrowLeft size={14} weight="bold" /> Previous
        </button>
        {idx < total - 1 ? (
          <button
            disabled={answers[idx] === -1}
            onClick={() => setIdx(idx + 1)}
            className="brut-btn-primary"
            data-testid="quiz-next"
          >
            Next <ArrowRight size={14} weight="bold" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting || answers.includes(-1)}
            className="brut-btn-mint"
            data-testid="quiz-submit"
          >
            {submitting ? "Scoring…" : "Submit quiz"}
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizPage;
