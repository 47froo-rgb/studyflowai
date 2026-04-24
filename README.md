# StudyFlow AI

A full-stack study companion that turns PDF and text documents into AI-generated key concepts and multiple-choice quizzes. Built with a professional, modern neo-brutalist UI.

---

## Tech Stack

| Layer      | Technology |
|-----------:|:-----------|
| Frontend   | React 19 + React Router 7 + TailwindCSS + shadcn/ui + Recharts + Phosphor Icons |
| Backend    | FastAPI (Python 3) + Motor (async MongoDB) + PyPDF2 + bcrypt + PyJWT |
| AI         | Google Gemini API via `aiservices` module |
| Database   | MongoDB (collections: `users`, `documents`, `summaries`, `quizzes`, `quiz_results`) |
| Auth       | Custom JWT (httpOnly cookies + Bearer fallback), bcrypt password hashing, Student / Admin roles |

---

## Features

### Core CRUD
- **Create**: Drag-and-drop PDF / TXT / MD uploader; files are parsed, linked to the user, and queued for AI processing
- **Read**: Study Library dashboard with real-time processing status badges (Processing / Ready / Failed)
- **Update**: Rename documents; manually edit the AI-generated Key Concepts list
- **Delete**: Permanent delete cascades to summaries, quizzes, and all quiz results

### AI Integration
- **Summarization**: Gemini extracts 5-10 exam-ready key concepts per document
- **Quiz generation**: 5-10 high-quality MCQs with 4 options, correct answer, and explanation
- **Regenerate**: One-click AI re-run for any document

### Security & Roles
- JWT authentication with 12 h access tokens + 7 day refresh tokens stored as httpOnly cookies
- `student` and `admin` roles; students can only access their own data (enforced server-side on every endpoint)
- Seeded default admin on startup (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- bcrypt password hashing; email uniqueness indexed in MongoDB

### Progress Tracker
- Line chart of every quiz attempt over time with a reference "goal" line at 80%
- Average / best / last score cards and per-document breakdown table

### Admin Panel
- Platform-wide KPIs (students, documents, AI-ready docs, attempts)
- User table showing per-user document counts and quiz activity

---

## System Architecture

```
┌──────────────┐   httpOnly cookie   ┌───────────────┐      ┌────────────┐
│  React SPA   │ ───────────────────▶│ FastAPI /api  │─────▶│  MongoDB   │
│  (port 3000) │◀─────────────────── │  (port 8001)  │      └────────────┘
└──────────────┘      JSON / JWT      │               │      ┌────────────┐
                                      │               │─────▶│ Google     │
                                      └───────────────┘      │ Gemini AI  │
                                                              │ API        │
                                                             └────────────┘
```

### Database Schema (MongoDB collections)
- `users` — `id, email, name, password_hash, role, created_at`
- `documents` — `id, user_id, title, original_filename, file_type, content, content_preview, status, error, summary_id, quiz_id, created_at, updated_at`
- `summaries` — `id, document_id, key_concepts[], generated_at, edited_at`
- `quizzes` — `id, document_id, questions[{question, options[4], correct_index, explanation}], created_at`
- `quiz_results` — `id, quiz_id, document_id, user_id, score, total, percent, answers[], completed_at`

### Key API Routes (all prefixed with `/api`)
- `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`
- `POST /documents/upload` · `GET /documents` · `GET /documents/{id}` · `PATCH /documents/{id}` · `PATCH /documents/{id}/summary` · `DELETE /documents/{id}` · `POST /documents/{id}/regenerate`
- `GET /quizzes/{id}` · `POST /quizzes/submit`
- `GET /progress`
- `GET /admin/users` · `GET /admin/stats`

---

## Folder Structure

```
/app
├── backend
│   ├── server.py          # FastAPI app (auth, documents, quizzes, progress, admin)
│   ├── requirements.txt
│   └── .env               # MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_*, GEMINI_API_KEY
├── frontend
│   ├── src
│   │   ├── App.js
│   │   ├── index.js / index.css
│   │   ├── lib/api.js              # axios client
│   │   ├── context/AuthContext.js  # user state + login/register/logout
│   │   ├── components/             # Navbar, Uploader, DocumentCard, StatusBadge, Loader, ProtectedRoute
│   │   └── pages/                  # Landing, AuthPages, Dashboard, DocumentDetail, QuizPage, ProgressPage, AdminPage
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

---

## Setup

### Prerequisites
- Node 18+, Yarn (do **not** use npm)
- Python 3.10+
- Running MongoDB
- Google Gemini API Key (provided in `backend/.env`)

### Environment Variables (`/app/backend/.env`)
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
JWT_SECRET="<64-char hex>"
ADMIN_EMAIL="admin@studyflow.ai"
ADMIN_PASSWORD="Admin@123"
GEMINI_API_KEY="<your-google-gemini-api-key>"
FRONTEND_URL="https://<your-frontend-origin>"
```

### Frontend (`/app/frontend/.env`)
```
REACT_APP_BACKEND_URL=https://<your-backend-origin>
```

### Install
```bash
# backend
cd /app/backend
pip install -r requirements.txt

# frontend
cd /app/frontend
yarn install
```

### Run (handled by supervisor in this environment)
```bash
sudo supervisorctl restart backend frontend
```

Visit the frontend URL. The seeded admin login is `admin@studyflow.ai` / `Admin@123`. New sign-ups become students.

---

## Testing

- Backend is tested via the `testing_agent_v3` and direct `curl` (see `/app/memory/test_credentials.md`).
- All interactive UI elements carry `data-testid` attributes for reliable e2e automation.

---

## Credits

Designed and built with Google Gemini, FastAPI, React, MongoDB, and a neo-brutalist soul.
