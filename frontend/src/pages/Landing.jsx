import React from "react";
import { Link, Navigate } from "react-router-dom";
import { Brain, Sparkle, UploadSimple, ListChecks, ChartLineUp, ArrowRight } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

const HERO_IMG = "https://images.pexels.com/photos/29474097/pexels-photo-29474097.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const Feature = ({ icon: Icon, title, desc, accent }) => (
  <div className="brut-card p-6">
    <span className={`flex h-11 w-11 items-center justify-center border-2 border-ink rounded-md ${accent}`}>
      <Icon size={22} weight="duotone" />
    </span>
    <h3 className="mt-4 font-heading text-xl font-bold">{title}</h3>
    <p className="mt-1 text-ink/70">{desc}</p>
  </div>
);

const Landing = () => {
  const { user } = useAuth();

  if (user) {
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div>
      {/* Nav */}
      <header className="border-b-2 border-ink bg-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center bg-lavender border-2 border-ink rounded-md shadow-brut-sm">
              <Brain size={20} weight="duotone" />
            </span>
            <span className="font-heading text-xl font-black">StudyFlow AI</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="brut-btn-primary text-sm" data-testid="landing-dashboard">
                Go to Library <ArrowRight size={14} weight="bold" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="brut-btn-secondary text-sm" data-testid="landing-login">Sign in</Link>
                <Link to="/register" className="brut-btn-primary text-sm" data-testid="landing-register">
                  Get started <ArrowRight size={14} weight="bold" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b-2 border-ink">
        <div className="absolute inset-0 hero-grid opacity-60" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="brut-badge bg-mint">
              <Sparkle size={12} weight="fill" /> Study smarter with Gemini AI
            </span>
            <h1 className="mt-4 font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
              Turn any PDF into <span className="bg-sun px-2 border-2 border-ink rounded-md inline-block rotate-[-1deg]">key concepts</span> and a quiz.
            </h1>
            <p className="mt-5 text-lg text-ink/70 max-w-lg">
              StudyFlow AI parses your study material, extracts the ideas that actually matter,
              and generates a quick quiz so you know what you know. Loved by students.
            </p>
            <div className="mt-8 flex gap-3 flex-wrap">
              <Link to="/register" className="brut-btn-primary" data-testid="hero-cta">
                Start studying — it's free <ArrowRight size={16} weight="bold" />
              </Link>
              <Link to="/login" className="brut-btn-secondary">I have an account</Link>
            </div>
            <p className="mt-4 text-xs text-ink/60">Demo: admin@studyflow.ai / Admin@123</p>
          </div>
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-sun border-2 border-ink rounded-md rotate-6 shadow-brut" />
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-mint border-2 border-ink rounded-md -rotate-6 shadow-brut" />
            <img src={HERO_IMG} alt="Study"
              className="relative border-2 border-ink rounded-md shadow-brut-lg w-full h-[420px] object-cover" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="font-heading text-3xl sm:text-4xl font-black tracking-tight">
          A complete study loop. In one page.
        </h2>
        <p className="mt-2 text-ink/70 max-w-2xl">
          No tabs, no context-switching. Upload once, review concepts, quiz yourself, track progress.
        </p>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Feature icon={UploadSimple} title="Multi-format upload" desc="Drop any PDF or text file. StudyFlow extracts and indexes the content safely in your library."
            accent="bg-lavender" />
          <Feature icon={Sparkle} title="AI key concepts" desc="Gemini AI distils the document into 5-10 bite-sized ideas you can edit, refine, and memorise."
            accent="bg-sun" />
          <Feature icon={ListChecks} title="Instant quizzes" desc="Each document generates a multiple-choice quiz to pressure-test your understanding."
            accent="bg-mint" />
          <Feature icon={ChartLineUp} title="Progress tracker" desc="See your average and best scores plotted over time. Know when to review and when to move on."
            accent="bg-coral" />
          <Feature icon={Brain} title="Your library" desc="Organise documents, rename them, and keep quiz history in one minimalist library."
            accent="bg-mint" />
          <Feature icon={Sparkle} title="Student & Admin roles" desc="Private data for students, platform-wide insights for admins. All with secure JWT auth."
            accent="bg-lavender" />
        </div>
      </section>

      <footer className="border-t-2 border-ink bg-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-between flex-wrap gap-4">
          <p className="text-sm text-ink/60">© {new Date().getFullYear()} StudyFlow AI.</p>
          <p className="text-sm text-ink/60">Built with FastAPI · React · MongoDB · Gemini AI</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
