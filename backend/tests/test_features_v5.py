"""Iteration 6 tests: hardened seed re-hashes ALL demo accounts every boot.

Covers:
- Login works for all 6 seeded accounts
- Idempotent reseed: corrupt password_hash in DB, restart backend, login must still work
- Wrong password rejected with expected detail
- /auth/me token validation
- Contador middleware still blocks writes / allows /auth/login
- TokenOut does not leak password_hash
"""
import os
import time
import subprocess

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

SEEDED_ACCOUNTS = [
    ("pablohenriqued@gmail.com", "NexusERP@2026", "admin"),
    ("vendedor@nexuserp.com", "Vendedor@2026", "vendedor"),
    ("contador@nexuserp.com", "Contador@2026", "contador"),
    ("ana@nexuserp.com", "Ana@2026", "vendedor"),
    ("bruno@nexuserp.com", "Bruno@2026", "vendedor"),
    ("carla@nexuserp.com", "Carla@2026", "vendedor"),
]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, email, password):
    return session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)


# ---------- Core login ----------
@pytest.mark.parametrize("email,password,role", SEEDED_ACCOUNTS)
def test_login_all_seeded_accounts(session, email, password, role):
    r = _login(session, email, password)
    assert r.status_code == 200, f"{email} -> {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and isinstance(data["access_token"], str) and len(data["access_token"]) > 10
    assert "user" in data
    u = data["user"]
    assert u["email"] == email.lower()
    assert u["role"] == role
    assert u.get("is_active") is True
    # SECURITY: no password_hash leaks
    assert "password_hash" not in u
    assert "password" not in u


def test_wrong_password_rejected(session):
    r = _login(session, "pablohenriqued@gmail.com", "totally-wrong-2026")
    assert r.status_code == 401
    assert r.json().get("detail") == "Credenciais inválidas"


def test_wrong_email_rejected(session):
    r = _login(session, "nobody@nexuserp.com", "whatever")
    assert r.status_code == 401


# ---------- /auth/me ----------
def test_auth_me_valid_token(session):
    tok = _login(session, "pablohenriqued@gmail.com", "NexusERP@2026").json()["access_token"]
    r = session.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "admin"
    assert "password_hash" not in body


def test_auth_me_no_header():
    r = requests.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code in (401, 403)


def test_auth_me_invalid_token():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
    assert r.status_code == 401


# ---------- Contador middleware ----------
@pytest.fixture(scope="module")
def contador_token(session):
    r = _login(session, "contador@nexuserp.com", "Contador@2026")
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.mark.parametrize("path,payload", [
    ("/api/orders", {"customer_id": "x", "items": []}),
    ("/api/customers", {"name": "TEST_v5_x", "person_type": "PJ"}),
    ("/api/leads", {"name": "TEST_v5_lead"}),
    ("/api/goals", {"user_id": "x", "month": "2026-01", "target_amount": 1000, "commission_rate": 0.05}),
    ("/api/goals/products", {"product_id": "x", "month": "2026-01", "target_qty": 1, "target_amount": 1}),
])
def test_contador_mutations_blocked(contador_token, path, payload):
    r = requests.post(f"{BASE_URL}{path}", json=payload, headers={"Authorization": f"Bearer {contador_token}"})
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
    assert r.json().get("detail") == "Contador é somente-leitura"


def test_contador_login_still_works(session):
    # Middleware allowlist must not accidentally block login itself
    r = _login(session, "contador@nexuserp.com", "Contador@2026")
    assert r.status_code == 200


# ---------- Idempotent reseed after restart ----------
def test_reseed_repairs_corrupt_password_hash(session):
    """Corrupt ana's password_hash in DB, restart backend, ana must still log in."""
    # Only run if we have shell + psql access
    # Use psql via subprocess (psycopg2 not installed)
    env = {**os.environ, "PGPASSWORD": "nexus_pwd_2026"}
    res = subprocess.run(
        ["psql", "-h", "localhost", "-U", "nexus", "-d", "nexus_erp", "-c",
         "UPDATE users SET password_hash='CORRUPTED_NOT_BCRYPT' WHERE email='ana@nexuserp.com';"],
        env=env, capture_output=True, text=True,
    )
    if res.returncode != 0:
        pytest.skip(f"psql not able to corrupt: {res.stderr}")

    # Confirm corruption breaks login BEFORE restart
    pre = _login(session, "ana@nexuserp.com", "Ana@2026")
    assert pre.status_code == 401, "corruption did not take effect"

    # Restart backend to trigger startup seed
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
    # Wait for backend to come up
    for _ in range(30):
        try:
            h = requests.get(f"{BASE_URL}/api/health", timeout=3)
            if h.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(1)
    else:
        pytest.fail("backend did not come back up in 30s")
    # Give seed a moment
    time.sleep(2)

    post = _login(session, "ana@nexuserp.com", "Ana@2026")
    assert post.status_code == 200, f"seed did NOT repair ana's password: {post.status_code} {post.text}"
