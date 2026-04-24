# StudyFlow AI — Technical Documentation

**Version:** 1.0  
**Date:** April 2026  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Data Model](#4-data-model)
5. [API Reference](#5-api-reference)
6. [AI Integration](#6-ai-integration)
7. [Authentication & Security](#7-authentication--security)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Installation & Usage Instructions](#9-installation--usage-instructions)
10. [Testing](#10-testing)

---

## 1. Project Overview

**StudyFlow AI** is a full-stack AI-powered study companion. It allows students to upload PDF or text documents and automatically generates exam-ready key concept summaries and multiple-choice quizzes using Google Gemini AI.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| Document Upload | Drag-and-drop PDF, TXT, and MD file ingestion with real-time processing status |
| AI Summarisation | Extracts 5–10 exam-ready key concepts per document |
| AI Quiz Generation | Generates 5–10 multiple-choice questions with explanations at easy/medium/hard difficulty |
| Progress Tracking | Line chart of quiz scores over time, per-document breakdown, goal reference line |
| Admin Panel | Platform-wide KPIs, user activity table, document statistics |
| Export | Anki flashcard deck (.apkg) and printable PDF flashcard export |
| Public Sharing | Shareable public summary links for collaboration |

### User Roles

- **Student** — Signs up, uploads documents, reviews AI summaries, takes quizzes, tracks progress.
- **Admin** — Seeded on startup; has platform-wide visibility into all users, documents, and statistics.

---

## 2. System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────┐
│      CLIENT BROWSER     │
│  React 19 SPA (Port 3000)│
│  TailwindCSS + shadcn/ui │
└────────────┬────────────┘
             │  HTTPS (JSON + httpOnly cookies)
             ▼
┌─────────────────────────┐
│     FASTAPI BACKEND     │
│     (Port 8001)         │
│  ┌───────────────────┐  │
│  │   Auth Module     │  │  ← JWT tokens, bcrypt hashing
│  │   (register/login)│  │
│  ├───────────────────┤  │
│  │   Document Module │  │  ← Upload, CRUD, PDF parsing
│  │   (upload/manage) │  │
│  ├───────────────────┤  │
│  │   AI Module       │  │  ← Summary & quiz generation
│  │   (Gemini API)    │  │
│  ├───────────────────┤  │
│  │   Quiz Module     │  │  ← Quiz delivery & scoring
│  │   (submit/score)  │  │
│  ├───────────────────┤  │
│  │   Admin Module    │  │  ← Stats & user management
│  └───────────────────┘  │
└────────────┬────────────┘
             │
     ┌───────┴────────┐
     ▼                ▼
┌──────────┐   ┌──────────────┐
│ MongoDB  │   │ Google Gemini│
│ Database │   │ AI API       │
└──────────┘   └──────────────┘
```

### Request Flow

1. The React SPA sends API requests to the FastAPI backend over HTTPS.
2. Authentication is handled via JWT tokens stored in httpOnly cookies (with Bearer header fallback).
3. The backend validates the token, queries MongoDB via the Motor async driver, and returns JSON.
4. For document uploads, the backend parses the file content (PyPDF2 for PDFs), stores it in MongoDB, and kicks off an async background task for AI processing.
5. The AI module calls the Google Gemini API to generate summaries and quizzes, then writes results back to MongoDB.
6. The frontend polls for processing status and displays results when ready.

### Deployment Architecture

| Component | Platform | URL Pattern |
|-----------|----------|-------------|
| Frontend | Vercel | `https://<app>.vercel.app` |
| Backend | Render | `https://<app>.onrender.com` |
| Database | MongoDB Atlas | Cloud-hosted cluster |

---

## 3. Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.0.0 | UI framework |
| React Router | 7.5.1 | Client-side routing |
| TailwindCSS | 3.4.17 | Utility-first CSS framework |
| shadcn/ui (Radix UI) | Various | Accessible UI component primitives |
| Recharts | 3.6.0 | Data visualisation (progress charts) |
| Phosphor Icons | 2.1.10 | Neo-brutalist icon set |
| Axios | 1.8.4 | HTTP client with cookie support |
| Sonner | 2.0.3 | Toast notifications |
| CRACO | 7.1.0 | Create React App configuration override |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11.8 | Runtime |
| FastAPI | 0.110.1 | Async web framework |
| Uvicorn | 0.25.0 | ASGI server |
| Motor | 3.3.1 | Async MongoDB driver |
| PyPDF2 | 3.0.1 | PDF text extraction |
| bcrypt | 4.1.3 | Password hashing |
| PyJWT | 2.12.1 | JWT token encoding/decoding |
| google-genai | 1.71.0 | Google Gemini AI SDK |
| genanki | 0.13.1 | Anki flashcard deck generation |
| ReportLab | 4.4.10 | PDF flashcard generation |
| Pydantic | 2.12.5 | Request/response validation |

### Database

| Technology | Purpose |
|------------|---------|
| MongoDB (Atlas) | NoSQL document database |
| Motor (PyMongo async) | Async Python driver |

### AI Services

| Service | Model | Purpose |
|---------|-------|---------|
| Google Gemini | gemini-2.0-flash (primary) | AI summarisation and quiz generation |
| Google Gemini | gemini-2.0-flash-lite (fallback) | Fallback on quota exhaustion |
| Google Gemini | gemini-2.5-flash (fallback) | Secondary fallback |

### Design System

| Aspect | Choice |
|--------|--------|
| Theme | Pastel & Soft with Neo-Brutalist twist |
| Heading Font | Outfit (Black/Bold) |
| Body Font | DM Sans |
| Palette | Lavender (#B1A9FF), Mint (#A7F3D0), Sun (#FDE047), Pitch Black (#09090B) |
| Surfaces | 2px black borders, 4px hard drop shadows, rounded-md corners |

---

## 4. Data Model

### Entity Relationship Diagram

```
┌──────────────────┐
│      USERS       │
├──────────────────┤         1
│ id (UUID, PK)    │─────────────────┐
│ email (unique)   │                 │
│ name             │                 │
│ password_hash    │                 │
│ role (enum)      │                 │
│ email_verified   │                 │
│ created_at       │                 │
└──────────────────┘                 │
                                     │  owns (1:N)
                                     ▼
┌──────────────────┐          ┌──────────────────┐
│    SUMMARIES     │          │    DOCUMENTS     │
├──────────────────┤          ├──────────────────┤
│ id (UUID, PK)    │◄─────── │ id (UUID, PK)    │
│ document_id (FK) │  1:1    │ user_id (FK)     │
│ key_concepts[]   │          │ title            │
│ generated_at     │          │ original_filename│
│ edited_at        │          │ file_type (enum) │
└──────────────────┘          │ content          │
                              │ content_preview  │
┌──────────────────┐          │ status (enum)    │
│     QUIZZES      │          │ error            │
├──────────────────┤          │ summary_id (FK)  │
│ id (UUID, PK)    │◄─────── │ quiz_id (FK)     │
│ document_id (FK) │  1:1    │ difficulty (enum) │
│ questions[]      │          │ question_count   │
│ difficulty       │          │ public_share_token│
│ question_count   │          │ created_at       │
│ created_at       │          │ updated_at       │
└──────────────────┘          └──────────────────┘
                                     │
                                     │  has results (1:N)
                                     ▼
                              ┌──────────────────┐
                              │  QUIZ_RESULTS    │
                              ├──────────────────┤
                              │ id (UUID, PK)    │
                              │ quiz_id (FK)     │
                              │ document_id (FK) │
                              │ user_id (FK)     │
                              │ score            │
                              │ total            │
                              │ percent          │
                              │ answers[]        │
                              │ completed_at     │
                              └──────────────────┘
```

### Collection Schemas

**users**
| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID string | Primary key |
| email | string | Unique, indexed |
| name | string | Max 80 chars |
| password_hash | string | bcrypt hash |
| role | enum | `"student"` or `"admin"` |
| email_verified | boolean | Default false |
| created_at | ISO datetime | Auto-set |

**documents**
| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID string | Primary key |
| user_id | UUID string | FK → users.id |
| title | string | Max 200 chars |
| original_filename | string | Original upload name |
| file_type | enum | `"pdf"` or `"text"` |
| content | string | Full extracted text |
| content_preview | string | First 280 chars |
| status | enum | `"processing"`, `"ready"`, `"failed"` |
| error | string / null | Error message if failed |
| summary_id | UUID / null | FK → summaries.id |
| quiz_id | UUID / null | FK → quizzes.id |
| difficulty | enum | `"easy"`, `"medium"`, `"hard"` |
| question_count | integer | 5–10 |
| public_share_token | string / null | For public sharing |
| created_at | ISO datetime | Auto-set |
| updated_at | ISO datetime | Auto-updated |

**summaries**
| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID string | Primary key |
| document_id | UUID string | FK → documents.id |
| key_concepts | array of strings | 5–10 concepts |
| generated_at | ISO datetime | Auto-set |
| edited_at | ISO datetime / null | Set on manual edit |

**quizzes**
| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID string | Primary key |
| document_id | UUID string | FK → documents.id |
| questions | array of objects | Each: `{question, options[4], correct_index, explanation}` |
| difficulty | string | `"easy"`, `"medium"`, `"hard"` |
| question_count | integer | Number of questions |
| created_at | ISO datetime | Auto-set |

**quiz_results**
| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID string | Primary key |
| quiz_id | UUID string | FK → quizzes.id |
| document_id | UUID string | FK → documents.id |
| user_id | UUID string | FK → users.id |
| score | integer | Correct answers count |
| total | integer | Total questions |
| percent | float | Score percentage |
| answers | array of integers | User's selected indices |
| completed_at | ISO datetime | Auto-set |

### MongoDB Indexes

| Collection | Index | Type |
|------------|-------|------|
| users | email | Unique |
| documents | (user_id, created_at) | Compound, descending |
| documents | public_share_token | Single |
| quiz_results | (user_id, completed_at) | Compound, descending |
| password_reset_tokens | token | Unique |
| email_verification_tokens | token | Unique |

---

## 5. API Reference

All endpoints are prefixed with `/api`.

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Create new student account | No |
| POST | `/auth/login` | Login and receive JWT | No |
| POST | `/auth/logout` | Clear auth cookies | Yes |
| GET | `/auth/me` | Get current user profile | Yes |
| POST | `/auth/forgot-password` | Generate password reset token | No |
| POST | `/auth/reset-password` | Reset password with token | No |
| POST | `/auth/verify-email` | Verify email with token | No |
| POST | `/auth/resend-verification` | Resend verification link | Yes |

### Documents

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/documents/upload` | Upload PDF/TXT/MD (multipart form) | Yes |
| GET | `/documents` | List user's documents (admin sees all) | Yes |
| GET | `/documents/{id}` | Get document detail + summary + quiz + results | Yes |
| PATCH | `/documents/{id}` | Rename document | Yes (owner/admin) |
| PATCH | `/documents/{id}/summary` | Edit key concepts | Yes (owner/admin) |
| DELETE | `/documents/{id}` | Delete document (cascading) | Yes (owner/admin) |
| POST | `/documents/{id}/regenerate` | Re-run AI processing | Yes (owner/admin) |
| POST | `/documents/{id}/share` | Toggle public share link | Yes (owner/admin) |
| GET | `/documents/{id}/export/anki` | Download Anki deck (.apkg) | Yes (owner/admin) |
| GET | `/documents/{id}/export/pdf` | Download PDF flashcards | Yes (owner/admin) |

### Quizzes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/quizzes/{id}` | Get quiz questions (answers hidden) | Yes |
| POST | `/quizzes/submit` | Submit answers and receive score + review | Yes |

### Progress & Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/progress` | Get user's quiz history and statistics | Yes |
| GET | `/admin/users` | List all users with doc/attempt counts | Admin |
| GET | `/admin/stats` | Platform-wide KPIs | Admin |

### Public

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/public/summaries/{token}` | View a shared summary | No |

---

## 6. AI Integration

### Architecture

The AI module uses a wrapper (`aiservices/llm/chat.py`) around the Google Gemini API. This provides a clean `LlmChat` interface with automatic model fallback on quota exhaustion.

### Model Fallback Chain

1. `gemini-2.0-flash` (primary)
2. `gemini-2.0-flash-lite` (first fallback)
3. `gemini-2.5-flash` (second fallback)
4. `gemini-flash-latest` (final fallback)

If all models are quota-exhausted, a `RuntimeError` is raised.

### AI Workflows

**Summarisation Pipeline:**
1. Document content is truncated to 16,000 characters.
2. A system prompt instructs the model to extract 5–10 exam-ready key concepts.
3. The response is parsed as JSON (`{"key_concepts": [...]}`).
4. Concepts are stored in the `summaries` collection.

**Quiz Generation Pipeline:**
1. Document content is truncated to 16,000 characters.
2. A system prompt specifies question count (5–10) and difficulty level (easy/medium/hard).
3. The response is parsed as JSON with `questions[]` containing `question`, `options[4]`, `correct_index`, and `explanation`.
4. Questions are validated (must have exactly 4 options, valid correct index).
5. Quiz is stored in the `quizzes` collection.

Both pipelines run as async background tasks via `asyncio.create_task()`, allowing the upload endpoint to return immediately while processing continues.

---

## 7. Authentication & Security

### JWT Token Flow

```
  Client                    Server                    MongoDB
    │                         │                          │
    │── POST /auth/login ────▶│                          │
    │                         │── find user by email ───▶│
    │                         │◀── user document ────────│
    │                         │                          │
    │                         │  verify bcrypt password  │
    │                         │  create access token     │
    │                         │  create refresh token    │
    │                         │                          │
    │◀── Set-Cookie (httpOnly)│                          │
    │◀── JSON {token, user}   │                          │
    │                         │                          │
    │── GET /api/* ──────────▶│                          │
    │   Cookie: access_token  │  decode JWT              │
    │   (or Authorization:    │  verify expiry           │
    │    Bearer <token>)      │  lookup user             │
    │                         │                          │
```

### Security Measures

| Measure | Implementation |
|---------|---------------|
| Password Hashing | bcrypt with auto-generated salt |
| JWT Storage | httpOnly, Secure, SameSite=None cookies |
| Token Expiry | Access: 12 hours, Refresh: 7 days |
| Data Isolation | Every endpoint verifies `user_id` ownership |
| Role-Based Access | Admin-only endpoints use `require_admin` dependency |
| Input Validation | Pydantic models with constraints (min/max length, email format) |
| File Size Limit | Maximum 10 MB upload |
| CORS | Restricted to configured frontend origin |

---

## 8. Frontend Architecture

### Component Hierarchy

```
App
├── AuthProvider (global auth state)
├── BrowserRouter
│   └── Shell (conditional Navbar)
│       ├── Landing (public)
│       ├── LoginPage / RegisterPage (public)
│       ├── ForgotPasswordPage / ResetPasswordPage (public)
│       ├── VerifyEmailPage (public)
│       ├── PublicSummaryPage (public)
│       ├── ProtectedRoute
│       │   ├── Dashboard
│       │   │   ├── Uploader (drag-and-drop)
│       │   │   └── DocumentCard[] (with StatusBadge)
│       │   ├── DocumentDetail
│       │   ├── QuizPage
│       │   └── ProgressPage (Recharts)
│       └── ProtectedRoute (adminOnly)
│           └── AdminPage
└── Toaster (sonner notifications)
```

### Key Design Decisions

- **Neo-brutalist UI**: Thick 2px black borders, 4px hard drop shadows, pastel palette (lavender/mint/sun).
- **Cookie-first auth with Bearer fallback**: Handles environments where third-party cookies are restricted.
- **Auto-polling**: Dashboard polls for document processing status updates.
- **Accessible components**: All interactive elements include `data-testid` attributes; shadcn/ui provides WCAG-compliant primitives.

---

## 9. Installation & Usage Instructions

### Prerequisites

- **Node.js** 18+ and **Yarn** (do not use npm)
- **Python** 3.10+
- **MongoDB** instance (local or Atlas)
- **Google Gemini API Key**

### Environment Variables

**Backend** (`backend/.env`):
```env
MONGO_URL="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net"
DB_NAME="studyflow"
JWT_SECRET="<64-character-hex-string>"
ADMIN_EMAIL="admin@studyflow.ai"
ADMIN_PASSWORD="Admin@123"
GEMINI_API_KEY="<your-google-gemini-api-key>"
FRONTEND_URL="http://localhost:3000"
```

**Frontend** (`frontend/.env`):
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd studyflowai-main

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate        # macOS/Linux
pip install -r requirements.txt

# Frontend setup
cd ../frontend
yarn install
```

### Running Locally

```bash
# Terminal 1 — Backend
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 — Frontend
cd frontend
yarn start
```

The frontend will be available at `http://localhost:3000`.  
The backend API will be available at `http://localhost:8001/api`.

### Default Admin Login

| Field | Value |
|-------|-------|
| Email | `admin@studyflow.ai` |
| Password | `Admin@123` |

New user sign-ups are automatically assigned the `student` role.

### Production Deployment

| Component | Platform | Build Command |
|-----------|----------|---------------|
| Frontend | Vercel | `yarn build` (auto-detected) |
| Backend | Render | `pip install -r requirements.txt` → `uvicorn server:app --host 0.0.0.0 --port $PORT` |
| Database | MongoDB Atlas | Configured via `MONGO_URL` |

---

## 10. Testing

### Backend Tests

- **Framework:** pytest
- **Coverage:** 30/30 tests passing
- **Areas covered:** Authentication, RBAC, document CRUD, AI generation, quiz submission, progress tracking, admin endpoints, cascading delete

### Frontend Tests

- **Method:** End-to-end flows verified via automated testing agent
- **Test attributes:** All interactive UI elements include `data-testid` attributes for reliable automation

### Running Tests

```bash
cd backend
pytest tests/ -v
```

---

*End of Technical Documentation*
