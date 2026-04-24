from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import json
import uuid
import secrets
import tempfile
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse, Response as FastAPIResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from PyPDF2 import PdfReader

import genanki
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from aiservices.llm.chat import LlmChat, UserMessage

# -----------------------------------------------------------------------------
# App setup
# -----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("studyflow")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="StudyFlow AI")
api = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
ACCESS_MINUTES = 60 * 12  # 12 hrs for a study session
REFRESH_DAYS = 7
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
AI_MODEL_PROVIDER = "google"
AI_MODEL_NAME = "gemini-2.0-flash"


# -----------------------------------------------------------------------------
# Utility
# -----------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": now_utc() + timedelta(minutes=ACCESS_MINUTES),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": now_utc() + timedelta(days=REFRESH_DAYS),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=ACCESS_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=REFRESH_DAYS * 86400, path="/")


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Literal["student", "admin"]
    created_at: datetime


class DocumentOut(BaseModel):
    id: str
    user_id: str
    title: str
    original_filename: str
    file_type: str
    status: Literal["processing", "ready", "failed"]
    error: Optional[str] = None
    content_preview: str
    created_at: datetime
    updated_at: datetime


class DocumentDetail(DocumentOut):
    content: str
    summary: Optional[dict] = None
    quiz: Optional[dict] = None


class RenameIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class SummaryUpdateIn(BaseModel):
    key_concepts: List[str]


class QuizAnswerIn(BaseModel):
    quiz_id: str
    answers: List[int]


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6)


class VerifyIn(BaseModel):
    token: str


class QuizOptionsIn(BaseModel):
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    question_count: int = Field(default=8, ge=5, le=10)


class DocumentShareIn(BaseModel):
    enabled: bool


def _frontend_base() -> str:
    return os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")


async def _issue_verification_token(user_id: str, email: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.email_verification_tokens.insert_one({
        "token": token, "user_id": user_id, "email": email,
        "expires_at": now_utc() + timedelta(hours=24),
        "used": False,
    })
    link = f"{_frontend_base()}/verify-email/{token}"
    logger.info("=== EMAIL VERIFICATION for %s ===\n   %s\n===============================", email, link)
    return token


async def _issue_reset_token(user_id: str, email: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token": token, "user_id": user_id, "email": email,
        "expires_at": now_utc() + timedelta(hours=1),
        "used": False,
    })
    link = f"{_frontend_base()}/reset-password/{token}"
    logger.info("=== PASSWORD RESET for %s ===\n   %s\n==============================", email, link)
    return token


# -----------------------------------------------------------------------------
# Auth routes
# -----------------------------------------------------------------------------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    user_doc = {
        "id": uid,
        "email": email,
        "name": payload.name.strip(),
        "password_hash": hash_password(payload.password),
        "role": "student",
        "email_verified": False,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user_doc)
    await _issue_verification_token(uid, email)
    access = create_access_token(uid, email, "student")
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": user_doc["name"], "role": "student",
            "email_verified": False,
            "created_at": user_doc["created_at"], "token": access}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"id": user["id"], "email": user["email"], "name": user["name"],
            "role": user["role"],
            "email_verified": bool(user.get("email_verified", False)),
            "created_at": user["created_at"], "token": access}


@api.post("/auth/logout")
async def logout(response: Response, _: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    # Always respond ok (don't reveal whether email exists)
    if user:
        await _issue_reset_token(user["id"], email)
    return {"ok": True, "message": "If the email exists, a reset link has been generated. Check the backend logs for the link."}


@api.post("/auth/reset-password")
async def reset_password(payload: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": payload.token})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or used token")
    expires = rec.get("expires_at")
    if isinstance(expires, datetime) and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not expires or expires < now_utc():
        raise HTTPException(status_code=400, detail="Token expired")
    await db.users.update_one(
        {"id": rec["user_id"]},
        {"$set": {"password_hash": hash_password(payload.password)}},
    )
    await db.password_reset_tokens.update_one(
        {"token": payload.token}, {"$set": {"used": True}},
    )
    return {"ok": True}


@api.post("/auth/verify-email")
async def verify_email(payload: VerifyIn):
    rec = await db.email_verification_tokens.find_one({"token": payload.token})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or used token")
    expires = rec.get("expires_at")
    if isinstance(expires, datetime) and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not expires or expires < now_utc():
        raise HTTPException(status_code=400, detail="Token expired")
    await db.users.update_one(
        {"id": rec["user_id"]}, {"$set": {"email_verified": True}},
    )
    await db.email_verification_tokens.update_one(
        {"token": payload.token}, {"$set": {"used": True}},
    )
    return {"ok": True}


@api.post("/auth/resend-verification")
async def resend_verification(user: dict = Depends(get_current_user)):
    if user.get("email_verified"):
        return {"ok": True, "message": "Already verified"}
    await _issue_verification_token(user["id"], user["email"])
    return {"ok": True, "message": "Verification link generated. Check backend logs."}


# -----------------------------------------------------------------------------
# AI Service
# -----------------------------------------------------------------------------
async def _ai_chat(system: str, user_text: str, session_id: str) -> str:
    # Read key dynamically so .env changes are picked up without restart
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    chat = LlmChat(api_key=api_key, session_id=session_id,
                   system_message=system).with_model(AI_MODEL_PROVIDER, AI_MODEL_NAME)
    return await chat.send_message(UserMessage(text=user_text))


def _extract_json(text: str):
    text = text.strip()
    if text.startswith("```"):
        # strip fenced block
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]
    return json.loads(text)


async def generate_summary(content: str, doc_id: str) -> List[str]:
    truncated = content[:16000]
    system = (
        "You are an expert study coach. Extract 5-10 clear, exam-ready key concepts "
        "from the document. Each concept should be one or two sentences, self-contained, "
        "and focused on an idea, definition, formula, or relationship a student must know. "
        "Return ONLY JSON with shape: {\"key_concepts\": [\"...\", \"...\"]}."
    )
    raw = await _ai_chat(system, truncated, f"summary-{doc_id}")
    data = _extract_json(raw)
    concepts = data.get("key_concepts", [])
    return [str(c).strip() for c in concepts if str(c).strip()]


async def generate_quiz(content: str, doc_id: str,
                        difficulty: str = "medium",
                        question_count: int = 8) -> List[dict]:
    truncated = content[:16000]
    question_count = max(5, min(10, int(question_count or 8)))
    difficulty_guide = {
        "easy": "straightforward recall of stated facts, definitions and basic ideas.",
        "medium": "a mix of recall and application — test understanding, not just memorisation.",
        "hard": "deep application, edge cases, comparisons and subtle distinctions between concepts.",
    }.get(difficulty, "medium")
    system = (
        "You are an expert exam writer. Based on the document, create exactly "
        f"{question_count} high-quality multiple-choice questions at {difficulty.upper()} difficulty. "
        f"Focus on: {difficulty_guide} "
        "Each question must have exactly 4 options with exactly one correct answer. "
        "Options should be plausible and close in meaning when difficulty is hard. "
        "Return ONLY JSON: {\"questions\": [{\"question\": \"...\", \"options\": [\"a\",\"b\",\"c\",\"d\"], "
        "\"correct_index\": 0, \"explanation\": \"...\"}]}"
    )
    raw = await _ai_chat(system, truncated, f"quiz-{doc_id}")
    data = _extract_json(raw)
    questions = []
    for q in data.get("questions", []):
        opts = q.get("options", [])
        if not isinstance(opts, list) or len(opts) != 4:
            continue
        idx = int(q.get("correct_index", 0))
        if idx < 0 or idx > 3:
            idx = 0
        questions.append({
            "question": str(q.get("question", "")).strip(),
            "options": [str(o).strip() for o in opts],
            "correct_index": idx,
            "explanation": str(q.get("explanation", "")).strip(),
        })
    if not questions:
        raise ValueError("No questions produced")
    return questions[:question_count]


# -----------------------------------------------------------------------------
# Documents
# -----------------------------------------------------------------------------
def extract_pdf_text(raw: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(raw))
        pages = []
        for p in reader.pages:
            try:
                pages.append(p.extract_text() or "")
            except Exception:
                continue
        return "\n\n".join(pages).strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse PDF: {e}")


async def _process_document(doc_id: str, content: str,
                            difficulty: str = "medium",
                            question_count: int = 8):
    """Run summary + quiz generation and update DB."""
    try:
        summary_concepts = await generate_summary(content, doc_id)
        summary_id = str(uuid.uuid4())
        await db.summaries.insert_one({
            "id": summary_id,
            "document_id": doc_id,
            "key_concepts": summary_concepts,
            "generated_at": now_utc().isoformat(),
            "edited_at": None,
        })

        quiz_questions = await generate_quiz(content, doc_id, difficulty, question_count)
        quiz_id = str(uuid.uuid4())
        await db.quizzes.insert_one({
            "id": quiz_id,
            "document_id": doc_id,
            "questions": quiz_questions,
            "difficulty": difficulty,
            "question_count": len(quiz_questions),
            "created_at": now_utc().isoformat(),
        })

        await db.documents.update_one(
            {"id": doc_id},
            {"$set": {"status": "ready", "updated_at": now_utc().isoformat(),
                      "summary_id": summary_id, "quiz_id": quiz_id,
                      "difficulty": difficulty, "question_count": len(quiz_questions)}},
        )
    except Exception as e:
        logger.exception("AI processing failed for %s", doc_id)
        await db.documents.update_one(
            {"id": doc_id},
            {"$set": {"status": "failed", "error": str(e)[:300],
                      "updated_at": now_utc().isoformat()}},
        )


@api.post("/documents/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    difficulty: Literal["easy", "medium", "hard"] = Form("medium"),
    question_count: int = Form(8),
    user: dict = Depends(get_current_user),
):
    filename = file.filename or "untitled"
    ext = (filename.rsplit(".", 1)[-1] or "").lower()
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    if ext == "pdf":
        content = extract_pdf_text(raw)
        file_type = "pdf"
    elif ext in ("txt", "md"):
        try:
            content = raw.decode("utf-8", errors="ignore")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid text file")
        file_type = "text"
    else:
        raise HTTPException(status_code=400, detail="Only PDF, TXT, MD supported")

    content = content.strip()
    if len(content) < 50:
        raise HTTPException(status_code=400,
                            detail="Document content is too short to analyse (min 50 chars).")

    question_count = max(5, min(10, int(question_count or 8)))
    doc_id = str(uuid.uuid4())
    doc = {
        "id": doc_id,
        "user_id": user["id"],
        "title": (title or filename.rsplit(".", 1)[0]).strip()[:200],
        "original_filename": filename,
        "file_type": file_type,
        "content": content,
        "content_preview": content[:280],
        "status": "processing",
        "error": None,
        "summary_id": None,
        "quiz_id": None,
        "difficulty": difficulty,
        "question_count": question_count,
        "public_share_token": None,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }
    await db.documents.insert_one(doc)

    # Kick off AI processing in background
    import asyncio
    asyncio.create_task(_process_document(doc_id, content, difficulty, question_count))

    doc.pop("_id", None)
    return {k: v for k, v in doc.items() if k != "content"}


@api.get("/documents")
async def list_documents(user: dict = Depends(get_current_user)):
    query = {} if user["role"] == "admin" else {"user_id": user["id"]}
    docs = await db.documents.find(query, {"_id": 0, "content": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.get("/documents/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    summary = None
    quiz = None
    if doc.get("summary_id"):
        summary = await db.summaries.find_one({"id": doc["summary_id"]}, {"_id": 0})
    if doc.get("quiz_id"):
        quiz = await db.quizzes.find_one({"id": doc["quiz_id"]}, {"_id": 0})
        if quiz:
            # Include correct answers only for admin; students see at submission
            pass

    results = await db.quiz_results.find(
        {"document_id": doc_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("completed_at", -1).to_list(100)

    return {**doc, "summary": summary, "quiz": quiz, "results": results}


@api.patch("/documents/{doc_id}")
async def rename_document(doc_id: str, payload: RenameIn, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.documents.update_one(
        {"id": doc_id},
        {"$set": {"title": payload.title.strip()[:200], "updated_at": now_utc().isoformat()}},
    )
    return {"ok": True, "title": payload.title.strip()[:200]}


@api.patch("/documents/{doc_id}/summary")
async def update_summary(doc_id: str, payload: SummaryUpdateIn, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    concepts = [c.strip() for c in payload.key_concepts if c and c.strip()]
    if not concepts:
        raise HTTPException(status_code=400, detail="At least one key concept required")

    if doc.get("summary_id"):
        await db.summaries.update_one(
            {"id": doc["summary_id"]},
            {"$set": {"key_concepts": concepts, "edited_at": now_utc().isoformat()}},
        )
    else:
        sid = str(uuid.uuid4())
        await db.summaries.insert_one({
            "id": sid, "document_id": doc_id, "key_concepts": concepts,
            "generated_at": now_utc().isoformat(), "edited_at": now_utc().isoformat(),
        })
        await db.documents.update_one({"id": doc_id}, {"$set": {"summary_id": sid}})

    updated = await db.summaries.find_one({"document_id": doc_id}, {"_id": 0})
    return updated


@api.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    await db.summaries.delete_many({"document_id": doc_id})
    await db.quizzes.delete_many({"document_id": doc_id})
    await db.quiz_results.delete_many({"document_id": doc_id})
    await db.documents.delete_one({"id": doc_id})
    return {"ok": True}


@api.post("/documents/{doc_id}/regenerate")
async def regenerate_ai(doc_id: str, payload: Optional[QuizOptionsIn] = None,
                        user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    difficulty = (payload.difficulty if payload else None) or doc.get("difficulty") or "medium"
    count = (payload.question_count if payload else None) or doc.get("question_count") or 8

    await db.summaries.delete_many({"document_id": doc_id})
    await db.quizzes.delete_many({"document_id": doc_id})
    await db.documents.update_one(
        {"id": doc_id},
        {"$set": {"status": "processing", "error": None, "summary_id": None,
                  "quiz_id": None, "difficulty": difficulty, "question_count": count,
                  "updated_at": now_utc().isoformat()}},
    )
    import asyncio
    asyncio.create_task(_process_document(doc_id, doc["content"], difficulty, count))
    return {"ok": True, "difficulty": difficulty, "question_count": count}


# -----------------------------------------------------------------------------
# Quiz
# -----------------------------------------------------------------------------
@api.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str, user: dict = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    doc = await db.documents.find_one({"id": quiz["document_id"]}, {"_id": 0})
    if not doc or (user["role"] != "admin" and doc["user_id"] != user["id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    # hide correct answers from students
    questions_view = [
        {"question": q["question"], "options": q["options"]} for q in quiz["questions"]
    ]
    return {
        "id": quiz["id"],
        "document_id": quiz["document_id"],
        "document_title": doc["title"],
        "questions": questions_view,
        "count": len(questions_view),
    }


@api.post("/quizzes/submit")
async def submit_quiz(payload: QuizAnswerIn, user: dict = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"id": payload.quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    doc = await db.documents.find_one({"id": quiz["document_id"]}, {"_id": 0})
    if not doc or (user["role"] != "admin" and doc["user_id"] != user["id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    qs = quiz["questions"]
    if len(payload.answers) != len(qs):
        raise HTTPException(status_code=400, detail="Answer count mismatch")

    correct = 0
    review = []
    for i, q in enumerate(qs):
        user_ans = payload.answers[i]
        is_right = user_ans == q["correct_index"]
        if is_right:
            correct += 1
        review.append({
            "question": q["question"],
            "options": q["options"],
            "user_answer": user_ans,
            "correct_index": q["correct_index"],
            "is_correct": is_right,
            "explanation": q.get("explanation", ""),
        })

    total = len(qs)
    score_pct = round((correct / total) * 100, 1) if total else 0.0
    result_doc = {
        "id": str(uuid.uuid4()),
        "quiz_id": quiz["id"],
        "document_id": quiz["document_id"],
        "user_id": user["id"],
        "score": correct,
        "total": total,
        "percent": score_pct,
        "answers": payload.answers,
        "completed_at": now_utc().isoformat(),
    }
    await db.quiz_results.insert_one(result_doc)
    result_doc.pop("_id", None)
    return {"result": result_doc, "review": review}


# -----------------------------------------------------------------------------
# Progress
# -----------------------------------------------------------------------------
@api.get("/progress")
async def progress(user: dict = Depends(get_current_user)):
    results = await db.quiz_results.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("completed_at", 1).to_list(1000)

    if not results:
        return {"attempts": 0, "average": 0, "best": 0, "last": 0, "series": [], "by_document": []}

    percents = [r["percent"] for r in results]
    series = [{"date": r["completed_at"], "percent": r["percent"],
               "document_id": r["document_id"]} for r in results]

    # group by document
    doc_map: dict = {}
    for r in results:
        doc_map.setdefault(r["document_id"], []).append(r["percent"])

    by_doc = []
    for did, vals in doc_map.items():
        d = await db.documents.find_one({"id": did}, {"_id": 0, "title": 1})
        by_doc.append({
            "document_id": did,
            "title": d["title"] if d else "(deleted)",
            "attempts": len(vals),
            "average": round(sum(vals) / len(vals), 1),
            "best": max(vals),
        })

    return {
        "attempts": len(results),
        "average": round(sum(percents) / len(percents), 1),
        "best": max(percents),
        "last": percents[-1],
        "series": series,
        "by_document": by_doc,
    }


# -----------------------------------------------------------------------------
# Sharing + Exports
# -----------------------------------------------------------------------------
@api.post("/documents/{doc_id}/share")
async def toggle_share(doc_id: str, payload: DocumentShareIn,
                       user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.enabled:
        token = doc.get("public_share_token") or secrets.token_urlsafe(16)
        await db.documents.update_one(
            {"id": doc_id},
            {"$set": {"public_share_token": token, "updated_at": now_utc().isoformat()}},
        )
        return {"enabled": True, "token": token,
                "share_url": f"{_frontend_base()}/shared/{token}"}
    else:
        await db.documents.update_one(
            {"id": doc_id},
            {"$set": {"public_share_token": None, "updated_at": now_utc().isoformat()}},
        )
        return {"enabled": False}


@api.get("/public/summaries/{token}")
async def public_summary(token: str):
    doc = await db.documents.find_one({"public_share_token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Share link not found or revoked")
    summary = None
    if doc.get("summary_id"):
        summary = await db.summaries.find_one({"id": doc["summary_id"]}, {"_id": 0})
    author = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0, "name": 1})
    return {
        "title": doc["title"],
        "author_name": author["name"] if author else "StudyFlow student",
        "key_concepts": (summary or {}).get("key_concepts", []),
        "created_at": doc.get("created_at"),
        "status": doc.get("status"),
    }


def _build_anki_deck(title: str, concepts: List[str]) -> bytes:
    deck_id = abs(hash(title)) % (10 ** 10)
    model_id = 1607392319
    model = genanki.Model(
        model_id,
        "StudyFlow Basic",
        fields=[{"name": "Front"}, {"name": "Back"}],
        templates=[{
            "name": "Card 1",
            "qfmt": "<div style='font-family:sans-serif;font-size:20px'>{{Front}}</div>",
            "afmt": "{{FrontSide}}<hr><div style='font-family:sans-serif;font-size:18px'>{{Back}}</div>",
        }],
    )
    deck = genanki.Deck(deck_id, f"StudyFlow — {title}")
    for i, c in enumerate(concepts, start=1):
        front = f"Concept {i} — {title}"
        back = c
        deck.add_note(genanki.Note(model=model, fields=[front, back]))
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".apkg")
    tmp.close()
    genanki.Package(deck).write_to_file(tmp.name)
    with open(tmp.name, "rb") as f:
        data = f.read()
    try:
        os.unlink(tmp.name)
    except Exception:
        pass
    return data


def _build_pdf_flashcards(title: str, concepts: List[str]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=1.5*cm, rightMargin=1.5*cm,
                            topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("t", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, spaceAfter=18)
    intro_style = ParagraphStyle("i", parent=styles["BodyText"], fontSize=11, textColor=colors.HexColor("#52525B"), spaceAfter=18)
    num_style = ParagraphStyle("n", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=10, textColor=colors.HexColor("#7C6DFF"))
    body_style = ParagraphStyle("b", parent=styles["BodyText"], fontSize=13, leading=18)
    flow = [
        Paragraph(f"StudyFlow AI — {title}", title_style),
        Paragraph("Printable flashcards. Fold along each card border, or cut out.", intro_style),
    ]
    rows = []
    for i, c in enumerate(concepts, start=1):
        cell = [
            Paragraph(f"CONCEPT {i:02d}", num_style),
            Spacer(1, 6),
            Paragraph(c, body_style),
        ]
        rows.append(cell)
    # Arrange 2 cards per row
    data = []
    for i in range(0, len(rows), 2):
        left = rows[i]
        right = rows[i + 1] if i + 1 < len(rows) else ""
        data.append([left, right])
    if data:
        t = Table(data, colWidths=[8.5*cm, 8.5*cm], rowHeights=[6*cm] * len(data))
        t.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 2, colors.HexColor("#09090B")),
            ("INNERGRID", (0, 0), (-1, -1), 2, colors.HexColor("#09090B")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ]))
        flow.append(t)
    doc.build(flow)
    return buf.getvalue()


def _safe_filename(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in name)[:60] or "studyflow"


@api.get("/documents/{doc_id}/export/anki")
async def export_anki(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    summary = await db.summaries.find_one({"id": doc.get("summary_id") or ""}, {"_id": 0})
    concepts = (summary or {}).get("key_concepts") or []
    if not concepts:
        raise HTTPException(status_code=400, detail="No key concepts to export yet.")
    data = _build_anki_deck(doc["title"], concepts)
    fname = f"{_safe_filename(doc['title'])}.apkg"
    return FastAPIResponse(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api.get("/documents/{doc_id}/export/pdf")
async def export_pdf(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    summary = await db.summaries.find_one({"id": doc.get("summary_id") or ""}, {"_id": 0})
    concepts = (summary or {}).get("key_concepts") or []
    if not concepts:
        raise HTTPException(status_code=400, detail="No key concepts to export yet.")
    data = _build_pdf_flashcards(doc["title"], concepts)
    fname = f"{_safe_filename(doc['title'])}_flashcards.pdf"
    return FastAPIResponse(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# -----------------------------------------------------------------------------
# Admin
# -----------------------------------------------------------------------------
@api.get("/admin/users")
async def admin_users(_: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    enriched = []
    for u in users:
        doc_count = await db.documents.count_documents({"user_id": u["id"]})
        attempt_count = await db.quiz_results.count_documents({"user_id": u["id"]})
        enriched.append({**u, "document_count": doc_count, "attempts": attempt_count})
    return enriched


@api.get("/admin/stats")
async def admin_stats(_: dict = Depends(require_admin)):
    users_total = await db.users.count_documents({})
    students_total = await db.users.count_documents({"role": "student"})
    docs_total = await db.documents.count_documents({})
    docs_ready = await db.documents.count_documents({"status": "ready"})
    attempts_total = await db.quiz_results.count_documents({})
    return {
        "users_total": users_total,
        "students_total": students_total,
        "documents_total": docs_total,
        "documents_ready": docs_ready,
        "attempts_total": attempts_total,
    }


# -----------------------------------------------------------------------------
# Root / health
# -----------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "StudyFlow AI", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Startup
# -----------------------------------------------------------------------------
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@studyflow.ai").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": admin_email,
            "name": "Admin",
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "email_verified": True,
            "created_at": now_utc().isoformat(),
        })
        logger.info("Seeded admin user: %s", admin_email)
    else:
        # keep admin password in sync with .env and ensure verified
        update: dict = {"email_verified": True, "role": "admin"}
        if not verify_password(admin_password, existing["password_hash"]):
            update["password_hash"] = hash_password(admin_password)
        await db.users.update_one({"email": admin_email}, {"$set": update})


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.documents.create_index([("user_id", 1), ("created_at", -1)])
        await db.documents.create_index("public_share_token")
        await db.quiz_results.create_index([("user_id", 1), ("completed_at", -1)])
        await db.password_reset_tokens.create_index("token", unique=True)
        await db.email_verification_tokens.create_index("token", unique=True)
    except Exception as e:
        logger.warning("Index creation warning: %s", e)
    await seed_admin()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
