"""New feature tests: email verification, password reset, quiz options,
public sharing, exports (PDF + Anki). Runs against REACT_APP_BACKEND_URL.
"""
import os
import io
import re
import time
import uuid
import zipfile
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@studyflow.ai"
ADMIN_PASSWORD = "Admin@123"
BACKEND_LOG = "/var/log/supervisor/backend.err.log"

SAMPLE_TEXT = (
    "Cellular respiration is the process by which cells convert glucose and oxygen "
    "into ATP (energy), carbon dioxide, and water. It occurs in three main stages: "
    "glycolysis in the cytoplasm, the Krebs (citric acid) cycle in the mitochondrial matrix, "
    "and the electron transport chain on the inner mitochondrial membrane. The overall "
    "reaction is C6H12O6 + 6O2 -> 6CO2 + 6H2O + ATP. Aerobic respiration yields up to "
    "38 ATP per glucose molecule, while anaerobic respiration yields only 2 ATP via "
    "fermentation. ATP synthase uses the proton gradient to produce ATP in oxidative "
    "phosphorylation. Cellular respiration is essentially the reverse of photosynthesis."
)


def _tail_log(pattern: str, email: str, timeout_s: int = 15) -> str | None:
    """Search backend log for token URL matching pattern for given email (lowercased)."""
    end = time.time() + timeout_s
    email_lc = email.lower()
    rx = re.compile(rf"{pattern} for {re.escape(email_lc)}[\s\S]*?/(?:verify-email|reset-password)/([A-Za-z0-9_\-]+)")
    while time.time() < end:
        try:
            with open(BACKEND_LOG, "r") as f:
                data = f.read()
            m = None
            for m in rx.finditer(data):
                pass
            if m:
                return m.group(1)
        except FileNotFoundError:
            pass
        time.sleep(0.5)
    return None


# ---------------------------------------------------------------- fixtures
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def student_session():
    email = f"TEST_new_{uuid.uuid4().hex[:8]}@studyflow.ai"
    password = "Student@123"
    s = requests.Session()
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": password, "name": "TEST New"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    s.test_email = email
    s.test_password = password
    s.test_user_id = data["id"]
    # capture response flag
    s.register_response = data
    return s


@pytest.fixture(scope="module")
def student2_session():
    email = f"TEST_new2_{uuid.uuid4().hex[:8]}@studyflow.ai"
    s = requests.Session()
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "Student@123", "name": "TEST New2"}, timeout=30)
    assert r.status_code == 200
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def ready_doc(student_session):
    files = {"file": ("resp.txt", io.BytesIO(SAMPLE_TEXT.encode("utf-8")), "text/plain")}
    data = {"title": "TEST_Respiration", "difficulty": "hard", "question_count": "6"}
    r = student_session.post(f"{API}/documents/upload", files=files, data=data, timeout=60)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["difficulty"] == "hard"
    assert doc["question_count"] == 6
    # wait until ready
    deadline = time.time() + 120
    last = None
    while time.time() < deadline:
        r = student_session.get(f"{API}/documents/{doc['id']}", timeout=20)
        assert r.status_code == 200
        last = r.json()
        if last["status"] in ("ready", "failed"):
            break
        time.sleep(3)
    assert last["status"] == "ready", f"not ready: {last.get('status')} / {last.get('error')}"
    assert last.get("summary", {}).get("key_concepts")
    # verify difficulty & question_count persisted
    assert last["difficulty"] == "hard"
    assert len(last["quiz"]["questions"]) == 6
    return last


# ================================================================ EMAIL VERIFICATION
class TestEmailVerification:
    def test_register_sets_email_verified_false(self, student_session):
        assert student_session.register_response["email_verified"] is False

    def test_login_returns_email_verified(self, student_session):
        r = requests.post(f"{API}/auth/login",
                          json={"email": student_session.test_email,
                                "password": student_session.test_password}, timeout=15)
        assert r.status_code == 200
        assert "email_verified" in r.json()
        assert r.json()["email_verified"] is False

    def test_admin_is_verified(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        assert r.json()["email_verified"] is True

    def test_resend_verification_requires_auth(self):
        r = requests.post(f"{API}/auth/resend-verification", timeout=15)
        assert r.status_code == 401

    def test_resend_and_verify_email_flow(self, student_session):
        r = student_session.post(f"{API}/auth/resend-verification", timeout=15)
        assert r.status_code == 200
        token = _tail_log("EMAIL VERIFICATION", student_session.test_email, 15)
        assert token, "verify token not found in logs"
        # Verify email
        r = requests.post(f"{API}/auth/verify-email", json={"token": token}, timeout=15)
        assert r.status_code == 200
        # login now returns verified=True
        r = requests.post(f"{API}/auth/login",
                          json={"email": student_session.test_email,
                                "password": student_session.test_password}, timeout=15)
        assert r.json()["email_verified"] is True
        # token cannot be reused
        r2 = requests.post(f"{API}/auth/verify-email", json={"token": token}, timeout=15)
        assert r2.status_code == 400

    def test_verify_invalid_token(self):
        r = requests.post(f"{API}/auth/verify-email", json={"token": "nope"}, timeout=15)
        assert r.status_code == 400


# ================================================================ FORGOT / RESET
class TestPasswordReset:
    def test_forgot_unknown_email_ok(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": f"nope_{uuid.uuid4().hex[:6]}@studyflow.ai"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_full_reset_flow(self):
        # create a fresh user
        email = f"TEST_reset_{uuid.uuid4().hex[:8]}@studyflow.ai"
        pw = "OldPass@123"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": pw, "name": "Reset"}, timeout=30)
        assert r.status_code == 200
        # forgot password
        r = requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)
        assert r.status_code == 200
        token = _tail_log("PASSWORD RESET", email, 15)
        assert token, "reset token not found in logs"
        # reset
        new_pw = "NewPass@456"
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": token, "password": new_pw}, timeout=15)
        assert r.status_code == 200
        # old password fails
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
        assert r.status_code == 401
        # new password works
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": new_pw}, timeout=15)
        assert r.status_code == 200
        # token cannot be reused
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": token, "password": "ShouldNot@1"}, timeout=15)
        assert r.status_code == 400

    def test_reset_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": "invalid_xyz", "password": "AnyPass@1"}, timeout=15)
        assert r.status_code == 400


# ================================================================ QUIZ OPTIONS
class TestQuizOptions:
    def test_upload_persists_difficulty_and_count(self, ready_doc):
        # verified in ready_doc fixture
        assert ready_doc["difficulty"] == "hard"
        assert ready_doc["question_count"] == 6

    def test_upload_count_clamped(self, student_session):
        files = {"file": ("a.txt", io.BytesIO((SAMPLE_TEXT + " " + SAMPLE_TEXT).encode()), "text/plain")}
        r = student_session.post(f"{API}/documents/upload", files=files,
                                 data={"title": "TEST_clamp", "difficulty": "easy", "question_count": "50"},
                                 timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["question_count"] == 10  # clamped
        # cleanup
        student_session.delete(f"{API}/documents/{d['id']}", timeout=15)

    def test_regenerate_with_options(self, student_session, ready_doc):
        r = student_session.post(f"{API}/documents/{ready_doc['id']}/regenerate",
                                 json={"difficulty": "easy", "question_count": 5}, timeout=15)
        assert r.status_code == 200
        assert r.json()["difficulty"] == "easy"
        assert r.json()["question_count"] == 5
        # wait for ready
        deadline = time.time() + 120
        final = None
        while time.time() < deadline:
            d = student_session.get(f"{API}/documents/{ready_doc['id']}", timeout=20).json()
            if d["status"] in ("ready", "failed"):
                final = d
                break
            time.sleep(3)
        assert final and final["status"] == "ready", f"regen did not finish: {final}"
        assert final["difficulty"] == "easy"
        assert len(final["quiz"]["questions"]) == 5


# ================================================================ SHARE / PUBLIC
class TestSharing:
    def test_share_enable_returns_token(self, student_session, ready_doc):
        r = student_session.post(f"{API}/documents/{ready_doc['id']}/share",
                                 json={"enabled": True}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["enabled"] is True
        assert d.get("token") and len(d["token"]) > 5
        assert "/shared/" in d["share_url"]
        student_session.share_token = d["token"]

    def test_public_summary_accessible_no_auth(self, student_session, ready_doc):
        token = getattr(student_session, "share_token", None)
        assert token
        # no auth header
        r = requests.get(f"{API}/public/summaries/{token}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "title" in d
        assert "author_name" in d
        assert "key_concepts" in d and isinstance(d["key_concepts"], list) and d["key_concepts"]
        # must NOT include full content or quiz
        assert "content" not in d
        assert "quiz" not in d

    def test_public_summary_invalid_token_404(self):
        r = requests.get(f"{API}/public/summaries/nonexistent_{uuid.uuid4().hex}", timeout=15)
        assert r.status_code == 404

    def test_share_rbac_other_student_forbidden(self, student2_session, ready_doc):
        r = student2_session.post(f"{API}/documents/{ready_doc['id']}/share",
                                  json={"enabled": True}, timeout=15)
        assert r.status_code == 403

    def test_share_revoke(self, student_session, ready_doc):
        token = getattr(student_session, "share_token", None)
        assert token
        r = student_session.post(f"{API}/documents/{ready_doc['id']}/share",
                                 json={"enabled": False}, timeout=15)
        assert r.status_code == 200
        assert r.json()["enabled"] is False
        # public lookup now 404
        r = requests.get(f"{API}/public/summaries/{token}", timeout=15)
        assert r.status_code == 404


# ================================================================ EXPORTS
class TestExports:
    def test_export_pdf(self, student_session, ready_doc):
        r = student_session.get(f"{API}/documents/{ready_doc['id']}/export/pdf", timeout=30)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".pdf" in cd
        assert r.content.startswith(b"%PDF"), "not a valid PDF header"
        assert len(r.content) > 1000

    def test_export_anki(self, student_session, ready_doc):
        r = student_session.get(f"{API}/documents/{ready_doc['id']}/export/anki", timeout=30)
        assert r.status_code == 200
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".apkg" in cd
        # .apkg is a zip
        assert zipfile.is_zipfile(io.BytesIO(r.content)), "apkg is not a valid zip"
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            names = zf.namelist()
            assert any("collection.anki" in n for n in names), f"unexpected apkg contents: {names}"

    def test_export_requires_auth(self, ready_doc):
        r = requests.get(f"{API}/documents/{ready_doc['id']}/export/pdf", timeout=15)
        assert r.status_code == 401
        r = requests.get(f"{API}/documents/{ready_doc['id']}/export/anki", timeout=15)
        assert r.status_code == 401

    def test_export_rbac_other_student(self, student2_session, ready_doc):
        r = student2_session.get(f"{API}/documents/{ready_doc['id']}/export/pdf", timeout=15)
        assert r.status_code == 403
        r = student2_session.get(f"{API}/documents/{ready_doc['id']}/export/anki", timeout=15)
        assert r.status_code == 403

    def test_export_400_when_no_summary(self, student_session):
        # upload a doc but don't wait for summary
        files = {"file": ("pending.txt", io.BytesIO(SAMPLE_TEXT.encode()), "text/plain")}
        r = student_session.post(f"{API}/documents/upload", files=files,
                                 data={"title": "TEST_pending"}, timeout=30)
        assert r.status_code == 200
        doc_id = r.json()["id"]
        # immediately try export (summary likely not yet generated)
        r = student_session.get(f"{API}/documents/{doc_id}/export/pdf", timeout=60)
        # If already ready, skip; else expect 400
        if r.status_code == 200:
            pytest.skip("summary already generated before export call")
        assert r.status_code == 400
        # cleanup
        student_session.delete(f"{API}/documents/{doc_id}", timeout=15)


# ================================================================ CLEANUP
def test_zz_cleanup(student_session, ready_doc):
    student_session.delete(f"{API}/documents/{ready_doc['id']}", timeout=15)
