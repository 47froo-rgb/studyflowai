"""StudyFlow AI backend end-to-end pytest suite.

Runs against REACT_APP_BACKEND_URL. Exercises auth, documents CRUD, AI
processing (async), quiz, progress, admin and RBAC.
"""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@studyflow.ai"
ADMIN_PASSWORD = "Admin@123"

SAMPLE_TEXT = (
    "Photosynthesis is the biological process by which green plants, algae, "
    "and some bacteria convert light energy, usually from the sun, into chemical "
    "energy stored in glucose. The process occurs mainly in the chloroplasts, "
    "using chlorophyll to capture light. The overall reaction is 6CO2 + 6H2O -> "
    "C6H12O6 + 6O2. Photosynthesis has two main stages: the light-dependent "
    "reactions, which occur in the thylakoid membranes and produce ATP and NADPH, "
    "and the Calvin cycle (light-independent reactions), which occurs in the stroma "
    "and fixes carbon dioxide into glucose. Photosynthesis is critical for life on "
    "Earth because it produces oxygen and forms the base of most food chains."
)


# ---------------------------------------------------------------- fixtures
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    token = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def student_session():
    email = f"TEST_student_{uuid.uuid4().hex[:8]}@studyflow.ai"
    password = "Student@123"
    s = requests.Session()
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": password, "name": "TEST Student"}, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    s.test_email = email
    s.test_password = password
    s.test_user_id = data["id"]
    return s


@pytest.fixture(scope="session")
def student2_session():
    email = f"TEST_student2_{uuid.uuid4().hex[:8]}@studyflow.ai"
    password = "Student@123"
    s = requests.Session()
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": password, "name": "TEST Student 2"}, timeout=30)
    assert r.status_code == 200
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


# ---------------------------------------------------------------- health
def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------------------------------------------------------------- auth
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin"
        assert d["email"] == ADMIN_EMAIL
        assert "token" in d and len(d["token"]) > 10
        # cookies set
        assert "access_token" in r.cookies

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_register_student(self, student_session):
        assert student_session.test_user_id

    def test_register_duplicate(self, student_session):
        r = student_session.post(f"{API}/auth/register",
                                 json={"email": student_session.test_email,
                                       "password": "x"*8, "name": "dup"}, timeout=30)
        assert r.status_code == 400

    def test_me_with_token(self, student_session):
        r = student_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "student"
        assert "password_hash" not in d
        assert "_id" not in d

    def test_me_without_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_logout(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200
        r2 = s.post(f"{API}/auth/logout", timeout=15)
        assert r2.status_code == 200


# ---------------------------------------------------------------- documents + AI
@pytest.fixture(scope="session")
def uploaded_doc(student_session):
    files = {"file": ("photosynthesis.txt", io.BytesIO(SAMPLE_TEXT.encode("utf-8")), "text/plain")}
    r = student_session.post(f"{API}/documents/upload", files=files, data={"title": "TEST_Photo"}, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "processing"
    assert "_id" not in d
    return d


@pytest.fixture(scope="session")
def ready_doc(student_session, uploaded_doc):
    doc_id = uploaded_doc["id"]
    deadline = time.time() + 90
    last = None
    while time.time() < deadline:
        r = student_session.get(f"{API}/documents/{doc_id}", timeout=20)
        assert r.status_code == 200
        last = r.json()
        if last["status"] in ("ready", "failed"):
            break
        time.sleep(3)
    assert last["status"] == "ready", f"AI processing did not complete: {last.get('status')} err={last.get('error')}"
    assert last.get("summary") and last["summary"].get("key_concepts")
    assert last.get("quiz") and last["quiz"].get("questions")
    return last


class TestDocuments:
    def test_upload_empty_rejected(self, student_session):
        files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
        r = student_session.post(f"{API}/documents/upload", files=files, timeout=30)
        assert r.status_code == 400

    def test_upload_too_short(self, student_session):
        files = {"file": ("short.txt", io.BytesIO(b"hello"), "text/plain")}
        r = student_session.post(f"{API}/documents/upload", files=files, timeout=30)
        assert r.status_code == 400

    def test_upload_unsupported_ext(self, student_session):
        files = {"file": ("x.docx", io.BytesIO(SAMPLE_TEXT.encode()), "application/octet-stream")}
        r = student_session.post(f"{API}/documents/upload", files=files, timeout=30)
        assert r.status_code == 400

    def test_list_documents(self, student_session, uploaded_doc):
        r = student_session.get(f"{API}/documents", timeout=15)
        assert r.status_code == 200
        docs = r.json()
        assert any(d["id"] == uploaded_doc["id"] for d in docs)
        for d in docs:
            assert "_id" not in d

    def test_get_document_self(self, student_session, uploaded_doc):
        r = student_session.get(f"{API}/documents/{uploaded_doc['id']}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == uploaded_doc["id"]

    def test_rbac_other_student_forbidden(self, student2_session, uploaded_doc):
        r = student2_session.get(f"{API}/documents/{uploaded_doc['id']}", timeout=15)
        assert r.status_code == 403

    def test_rbac_admin_can_view(self, admin_session, uploaded_doc):
        r = admin_session.get(f"{API}/documents/{uploaded_doc['id']}", timeout=15)
        assert r.status_code == 200

    def test_rename(self, student_session, uploaded_doc):
        r = student_session.patch(f"{API}/documents/{uploaded_doc['id']}",
                                  json={"title": "TEST_Renamed"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Renamed"
        verify = student_session.get(f"{API}/documents/{uploaded_doc['id']}", timeout=15).json()
        assert verify["title"] == "TEST_Renamed"

    def test_ai_ready_has_summary_and_quiz(self, ready_doc):
        summary = ready_doc["summary"]
        quiz = ready_doc["quiz"]
        assert 3 <= len(summary["key_concepts"]) <= 15
        qs = quiz["questions"]
        assert 3 <= len(qs) <= 10
        for q in qs:
            assert len(q["options"]) == 4
            assert 0 <= q["correct_index"] <= 3

    def test_edit_summary(self, student_session, ready_doc):
        new_concepts = ["TEST concept A", "TEST concept B"]
        r = student_session.patch(f"{API}/documents/{ready_doc['id']}/summary",
                                  json={"key_concepts": new_concepts}, timeout=15)
        assert r.status_code == 200
        assert r.json()["key_concepts"] == new_concepts
        verify = student_session.get(f"{API}/documents/{ready_doc['id']}", timeout=15).json()
        assert verify["summary"]["key_concepts"] == new_concepts

    def test_edit_summary_empty_rejected(self, student_session, ready_doc):
        r = student_session.patch(f"{API}/documents/{ready_doc['id']}/summary",
                                  json={"key_concepts": []}, timeout=15)
        assert r.status_code == 400


# ---------------------------------------------------------------- quiz
class TestQuiz:
    def test_get_quiz_hides_answers(self, student_session, ready_doc):
        quiz_id = ready_doc["quiz"]["id"]
        r = student_session.get(f"{API}/quizzes/{quiz_id}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for q in d["questions"]:
            assert "correct_index" not in q
            assert "explanation" not in q
            assert len(q["options"]) == 4

    def test_submit_quiz(self, student_session, ready_doc):
        quiz_id = ready_doc["quiz"]["id"]
        qv = student_session.get(f"{API}/quizzes/{quiz_id}", timeout=15).json()
        answers = [0] * qv["count"]
        r = student_session.post(f"{API}/quizzes/submit",
                                 json={"quiz_id": quiz_id, "answers": answers}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "result" in d and "review" in d
        assert d["result"]["total"] == qv["count"]
        assert len(d["review"]) == qv["count"]
        for rev in d["review"]:
            assert "correct_index" in rev and "explanation" in rev

    def test_submit_quiz_mismatch(self, student_session, ready_doc):
        quiz_id = ready_doc["quiz"]["id"]
        r = student_session.post(f"{API}/quizzes/submit",
                                 json={"quiz_id": quiz_id, "answers": [0]}, timeout=15)
        assert r.status_code == 400

    def test_quiz_rbac(self, student2_session, ready_doc):
        quiz_id = ready_doc["quiz"]["id"]
        r = student2_session.get(f"{API}/quizzes/{quiz_id}", timeout=15)
        assert r.status_code == 403


# ---------------------------------------------------------------- progress
class TestProgress:
    def test_progress_returns_series(self, student_session):
        r = student_session.get(f"{API}/progress", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["attempts", "average", "best", "last", "series", "by_document"]:
            assert k in d
        assert d["attempts"] >= 1
        assert isinstance(d["series"], list)
        assert isinstance(d["by_document"], list)


# ---------------------------------------------------------------- admin
class TestAdmin:
    def test_stats_admin(self, admin_session):
        r = admin_session.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["users_total", "students_total", "documents_total", "documents_ready", "attempts_total"]:
            assert k in d

    def test_users_admin(self, admin_session):
        r = admin_session.get(f"{API}/admin/users", timeout=15)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 1
        for u in users:
            assert "password_hash" not in u
            assert "_id" not in u
            assert "document_count" in u
            assert "attempts" in u

    def test_admin_stats_forbidden_for_student(self, student_session):
        r = student_session.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code == 403

    def test_admin_users_forbidden_for_student(self, student_session):
        r = student_session.get(f"{API}/admin/users", timeout=15)
        assert r.status_code == 403


# ---------------------------------------------------------------- regenerate + delete (last)
class TestLifecycleCleanup:
    def test_regenerate(self, student_session, ready_doc):
        r = student_session.post(f"{API}/documents/{ready_doc['id']}/regenerate", timeout=15)
        assert r.status_code == 200
        time.sleep(2)
        verify = student_session.get(f"{API}/documents/{ready_doc['id']}", timeout=15).json()
        assert verify["status"] in ("processing", "ready")

    def test_delete_cascades(self, student_session, ready_doc):
        doc_id = ready_doc["id"]
        r = student_session.delete(f"{API}/documents/{doc_id}", timeout=15)
        assert r.status_code == 200
        r2 = student_session.get(f"{API}/documents/{doc_id}", timeout=15)
        assert r2.status_code == 404
