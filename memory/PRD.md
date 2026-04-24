# StudyFlow AI — PRD

## Original Problem Statement
Build 'StudyFlow AI' — a digital tool that helps students
synthesize technical documentation by converting notes into AI-generated summaries and quizzes.

- **Core CRUD**: multi-format upload (PDF/Text) linked to user, Study Library dashboard,
  rename + edit AI summaries, cascading delete.
- **AI Integration**: Gemini AI summarization (Key Concepts) + quiz generation (5-10 MCQs).
- **System & Security**: JWT auth, Student/Admin roles, MongoDB schema (Users, Documents,
  Summaries, QuizResults), progress tracker with chart.
- **Deliverables**: clean GitHub folder structure, comprehensive README, professional UI.

## User Personas
- **Student** — signs up, uploads study PDFs/text, reviews AI key concepts, takes quizzes,
  tracks own progress.
- **Admin** — seeded user with platform overview, sees all users, all documents, all stats.

## Architecture
- Frontend: React 19 + React Router 7 + TailwindCSS + shadcn/ui + Recharts + Phosphor Icons.
- Backend: FastAPI + Motor (async MongoDB) + PyPDF2 + bcrypt + PyJWT.
- AI: Google Gemini API via `aiservices` module.
- Database: MongoDB collections `users`, `documents`, `summaries`, `quizzes`, `quiz_results`.

## Implemented (2026-02)
- JWT auth (httpOnly cookies + Bearer fallback) with Student/Admin roles
- Seeded default admin on startup (`admin@studyflow.ai` / `Admin@123`)
- Neo-brutalist pastel UI (Outfit + DM Sans, lavender/mint/sun palette, thick black borders, hard drop shadows)
- Landing page with hero + 6 feature cards
- Register/Login pages with split-image layout
- Study Library dashboard with drag-and-drop uploader, status badges, auto-polling of processing docs
- Document detail: rename, editable AI Key Concepts list, regenerate button, past attempts table
- Quiz experience: one-by-one MCQ with progress bar, scoring, review screen with correct/incorrect highlighting and explanations
- Progress tracker: Recharts line chart with 80% goal reference line + per-document stats table
- Admin panel: platform KPIs + users activity table
- Cascading delete (documents → summaries → quizzes → quiz_results)
- Data isolation: students only see their own data (enforced on every endpoint)

## Testing
- 30/30 backend pytest passing (auth, RBAC, CRUD, AI, quiz submission, progress, admin, cascade)
- Full frontend e2e flows verified via testing subagent

## Backlog
### P0 (none — MVP complete)

### P1
- Email-verification + forgot-password flow
- Gemini file-attachment support so PDFs go straight to the LLM (no PyPDF2 OCR gap for scanned PDFs)
- Per-quiz difficulty selector (easy / medium / hard)
- Shareable public study-summary link (conversion lever)

### P2
- Spaced-repetition review scheduler
- Collaborative study rooms (multi-user sessions)
- Image/diagram extraction from PDFs
- Export key concepts as Anki deck
- Billing / Pro tier (Stripe)

## Next Tasks
1. User validates the app.
2. Add email verification + password reset when users need it.
3. Consider shareable public summaries to drive organic sign-ups.
