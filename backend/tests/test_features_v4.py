"""Iteration 5 tests: fiscal_regime persistence, product goals CRUD+progress, contador role."""
import os
import time
import uuid
import subprocess
from decimal import Decimal
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("pablohenriqued@gmail.com", "NexusERP@2026")
VENDEDOR = ("vendedor@nexuserp.com", "Vendedor@2026")
CONTADOR = ("contador@nexuserp.com", "Contador@2026")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def vendedor_token():
    return _login(*VENDEDOR)


@pytest.fixture(scope="module")
def contador_token():
    return _login(*CONTADOR)


# ---------------- CONTADOR LOGIN & /auth/me ----------------
class TestContadorLogin:
    def test_contador_login_and_me(self, contador_token):
        r = requests.get(f"{API}/auth/me", headers=_h(contador_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == CONTADOR[0]
        assert data["role"] == "contador"

    def test_register_contador_role(self, admin_token):
        email = f"test_contador_{uuid.uuid4().hex[:6]}@nexuserp.com"
        r = requests.post(
            f"{API}/auth/register",
            headers=_h(admin_token),
            json={"email": email, "password": "TestPwd@2026", "name": "Test Contador", "role": "contador"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "contador"
        assert data["email"] == email

    def test_register_vendedor_and_admin_roles_still_work(self, admin_token):
        for role in ("vendedor", "admin"):
            email = f"test_{role}_{uuid.uuid4().hex[:6]}@nexuserp.com"
            r = requests.post(
                f"{API}/auth/register", headers=_h(admin_token),
                json={"email": email, "password": "TestPwd@2026", "name": f"Test {role}", "role": role},
                timeout=10,
            )
            assert r.status_code == 200, r.text
            assert r.json()["role"] == role


# ---------------- FISCAL REGIME PERSISTENCE ----------------
class TestFiscalRegimePersistence:
    def test_set_regime_reforma_persists_immediately(self, admin_token):
        r = requests.post(f"{API}/dashboard/fiscal_regime?mode=reforma", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["mode"] == "reforma"
        assert body.get("persisted") is True

        r2 = requests.get(f"{API}/dashboard/fiscal_regime", headers=_h(admin_token), timeout=10)
        assert r2.status_code == 200
        assert r2.json()["mode"] == "reforma"

    def test_set_regime_requires_admin(self, vendedor_token):
        r = requests.post(f"{API}/dashboard/fiscal_regime?mode=classic", headers=_h(vendedor_token), timeout=10)
        assert r.status_code in (403, 401), f"expected 403, got {r.status_code}: {r.text}"

    def test_set_regime_invalid_mode(self, admin_token):
        r = requests.post(f"{API}/dashboard/fiscal_regime?mode=bogus", headers=_h(admin_token), timeout=10)
        assert r.status_code == 400

    def test_persistence_survives_backend_restart(self, admin_token):
        # Set to reforma
        r = requests.post(f"{API}/dashboard/fiscal_regime?mode=reforma", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        # Restart backend
        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
        # Wait for backend to come back
        for _ in range(30):
            try:
                h = requests.get(f"{API}/health", timeout=3)
                if h.status_code == 200:
                    break
            except Exception:
                pass
            time.sleep(1)
        # Re-login (JWT may still be valid but be safe)
        token = _login(*ADMIN)
        r2 = requests.get(f"{API}/dashboard/fiscal_regime", headers=_h(token), timeout=10)
        assert r2.status_code == 200
        assert r2.json()["mode"] == "reforma", f"persistence failed after restart: {r2.json()}"

        # Reset to classic
        r3 = requests.post(f"{API}/dashboard/fiscal_regime?mode=classic", headers=_h(token), timeout=10)
        assert r3.status_code == 200
        r4 = requests.get(f"{API}/dashboard/fiscal_regime", headers=_h(token), timeout=10)
        assert r4.json()["mode"] == "classic"


# ---------------- PRODUCT GOALS CRUD ----------------
class TestProductGoalsCRUD:
    @pytest.fixture(scope="class")
    def seller_and_product(self, admin_token):
        # Find vendedor user id
        users = requests.get(f"{API}/auth/users", headers=_h(admin_token), timeout=10).json()
        seller = next(u for u in users if u["email"] == VENDEDOR[0])
        prods = requests.get(f"{API}/products", headers=_h(admin_token), timeout=10).json()
        prod = prods[0]
        return seller["id"], prod["id"]

    def test_create_product_goal(self, admin_token, seller_and_product):
        seller_id, product_id = seller_and_product
        payload = {"user_id": seller_id, "product_id": product_id, "month": "2026-01",
                   "target_qty": 5, "target_amount": "1000.00"}
        r = requests.post(f"{API}/goals/products", headers=_h(admin_token), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["user_id"] == seller_id
        assert g["product_id"] == product_id
        assert g["target_qty"] == 5
        assert Decimal(str(g["target_amount"])) == Decimal("1000.00")

    def test_upsert_product_goal_on_duplicate(self, admin_token, seller_and_product):
        seller_id, product_id = seller_and_product
        payload = {"user_id": seller_id, "product_id": product_id, "month": "2026-01",
                   "target_qty": 10, "target_amount": "2000.00"}
        r = requests.post(f"{API}/goals/products", headers=_h(admin_token), json=payload, timeout=10)
        assert r.status_code == 200
        g = r.json()
        assert g["target_qty"] == 10
        assert Decimal(str(g["target_amount"])) == Decimal("2000.00")

        # List should have 1 entry for this (user, product, month)
        lst = requests.get(f"{API}/goals/products?month=2026-01", headers=_h(admin_token), timeout=10).json()
        matches = [x for x in lst if x["user_id"] == seller_id and x["product_id"] == product_id and x["month"] == "2026-01"]
        assert len(matches) == 1, f"expected single upserted entry, got {len(matches)}"

    def test_patch_product_goal(self, admin_token, seller_and_product):
        seller_id, product_id = seller_and_product
        lst = requests.get(f"{API}/goals/products?month=2026-01", headers=_h(admin_token), timeout=10).json()
        goal = next(x for x in lst if x["user_id"] == seller_id and x["product_id"] == product_id)
        r = requests.patch(f"{API}/goals/products/{goal['id']}", headers=_h(admin_token),
                           json={"target_qty": 15}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["target_qty"] == 15

    def test_delete_product_goal_and_verify(self, admin_token, seller_and_product):
        seller_id, product_id = seller_and_product
        # Create a throwaway
        payload = {"user_id": seller_id, "product_id": product_id, "month": "2025-12",
                   "target_qty": 1, "target_amount": "100.00"}
        r = requests.post(f"{API}/goals/products", headers=_h(admin_token), json=payload, timeout=10)
        gid = r.json()["id"]
        r2 = requests.delete(f"{API}/goals/products/{gid}", headers=_h(admin_token), timeout=10)
        assert r2.status_code == 200
        lst = requests.get(f"{API}/goals/products?month=2025-12", headers=_h(admin_token), timeout=10).json()
        assert all(x["id"] != gid for x in lst)

    def test_vendedor_sees_only_own_goals(self, admin_token, vendedor_token, seller_and_product):
        lst = requests.get(f"{API}/goals/products", headers=_h(vendedor_token), timeout=10).json()
        # vendedor id
        me = requests.get(f"{API}/auth/me", headers=_h(vendedor_token), timeout=10).json()
        for g in lst:
            assert g["user_id"] == me["id"]

    def test_vendedor_cannot_create_product_goal(self, vendedor_token, seller_and_product):
        seller_id, product_id = seller_and_product
        r = requests.post(f"{API}/goals/products", headers=_h(vendedor_token),
                          json={"user_id": seller_id, "product_id": product_id, "month": "2026-02",
                                "target_qty": 1, "target_amount": "10"}, timeout=10)
        assert r.status_code in (401, 403)


# ---------------- PRODUCT GOALS PROGRESS MATH ----------------
class TestProductGoalProgressMath:
    def test_progress_end_to_end(self, admin_token):
        # 1. Find/create a customer, pick a product, create order for vendedor, invoice it
        users = requests.get(f"{API}/auth/users", headers=_h(admin_token), timeout=10).json()
        seller = next(u for u in users if u["email"] == VENDEDOR[0])
        prods = requests.get(f"{API}/products", headers=_h(admin_token), timeout=10).json()
        prod = prods[0]
        # Create dedicated customer to isolate
        cust_payload = {"name": f"TEST_v4_customer_{uuid.uuid4().hex[:6]}",
                        "person_type": "PJ", "document": "12.345.678/0001-90",
                        "state": "SP", "city": "São Paulo", "lgpd_consent": True}
        rc = requests.post(f"{API}/customers", headers=_h(admin_token), json=cust_payload, timeout=10)
        assert rc.status_code in (200, 201), rc.text
        cust_id = rc.json()["id"]

        # Create order with qty=3 unit_price=100
        order_payload = {
            "customer_id": cust_id,
            "seller_id": seller["id"],
            "items": [{"product_id": prod["id"], "quantity": "3", "unit_price": "100.00", "description": prod["name"]}],
        }
        ro = requests.post(f"{API}/orders", headers=_h(admin_token), json=order_payload, timeout=10)
        assert ro.status_code == 200, ro.text
        order = ro.json()
        order_id = order["id"]
        assert Decimal(str(order["total_gross"])) == Decimal("300.00")

        # Emit invoice
        ri = requests.post(f"{API}/orders/{order_id}/invoice", headers=_h(admin_token), timeout=10)
        assert ri.status_code == 200, ri.text

        # Determine the month bucket that this order.created_at falls into
        details = requests.get(f"{API}/orders/{order_id}", headers=_h(admin_token), timeout=10).json()
        created_at = details["created_at"]
        month = created_at[:7]

        # Create product goal: target_qty=5, target_amount=1000
        gp = {"user_id": seller["id"], "product_id": prod["id"], "month": month,
              "target_qty": 5, "target_amount": "1000.00"}
        rg = requests.post(f"{API}/goals/products", headers=_h(admin_token), json=gp, timeout=10)
        assert rg.status_code == 200, rg.text

        # Fetch progress
        rp = requests.get(f"{API}/goals/products/progress?month={month}", headers=_h(admin_token), timeout=10)
        assert rp.status_code == 200, rp.text
        rows = rp.json()
        row = next((x for x in rows if x["user_id"] == seller["id"] and x["product_id"] == prod["id"]), None)
        assert row is not None, f"no progress row found; rows={rows}"
        # NOTE: progress aggregates ALL invoiced orders for this seller+product in the month, not just our new one.
        # Assert AT LEAST our 3 units / R$300 are counted.
        assert row["achieved_qty"] >= 3, f"expected >=3, got {row['achieved_qty']}"
        assert Decimal(str(row["achieved_amount"])) >= Decimal("300.00"), row
        # progress_pct math check
        target_amount = Decimal(str(row["target_amount"]))
        achieved_amount = Decimal(str(row["achieved_amount"]))
        expected_pct = (achieved_amount / target_amount * 100).quantize(Decimal("0.01"))
        assert Decimal(str(row["progress_pct"])) == expected_pct

    def test_progress_uses_qty_when_target_amount_zero(self, admin_token):
        users = requests.get(f"{API}/auth/users", headers=_h(admin_token), timeout=10).json()
        seller = next(u for u in users if u["email"] == VENDEDOR[0])
        prods = requests.get(f"{API}/products", headers=_h(admin_token), timeout=10).json()
        prod = prods[1]
        # Set target_amount=0, target_qty=10 in future month with no orders -> 0%
        month = "2027-06"
        gp = {"user_id": seller["id"], "product_id": prod["id"], "month": month,
              "target_qty": 10, "target_amount": "0"}
        rg = requests.post(f"{API}/goals/products", headers=_h(admin_token), json=gp, timeout=10)
        assert rg.status_code == 200
        rp = requests.get(f"{API}/goals/products/progress?month={month}", headers=_h(admin_token), timeout=10).json()
        row = next(x for x in rp if x["user_id"] == seller["id"] and x["product_id"] == prod["id"])
        assert row["target_qty"] == 10
        assert Decimal(str(row["target_amount"])) == Decimal("0")
        assert row["achieved_qty"] == 0
        assert Decimal(str(row["progress_pct"])) == Decimal("0")


# ---------------- CONTADOR READ ACCESS ----------------
class TestContadorReadAccess:
    @pytest.mark.parametrize("path", [
        "/dashboard", "/dashboard/team_ranking", "/dashboard/company_goal",
        "/dashboard/fiscal_regime",
        "/reports/invoices.csv", "/reports/sped.txt?block=C", "/reports/sped.txt?block=M",
        "/reports/summary",
    ])
    def test_contador_can_read(self, contador_token, path):
        r = requests.get(f"{API}{path}", headers=_h(contador_token), timeout=15)
        assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text[:200]}"

    def test_contador_csv_contains_all_invoices(self, admin_token, contador_token):
        r_adm = requests.get(f"{API}/reports/invoices.csv", headers=_h(admin_token), timeout=15)
        r_con = requests.get(f"{API}/reports/invoices.csv", headers=_h(contador_token), timeout=15)
        assert r_adm.status_code == 200 and r_con.status_code == 200
        # Both should have same number of data rows
        adm_lines = r_adm.text.strip().split("\n")
        con_lines = r_con.text.strip().split("\n")
        assert len(adm_lines) == len(con_lines), f"admin={len(adm_lines)} vs contador={len(con_lines)}"
        assert len(con_lines) > 1, "csv appears empty"


# ---------------- CONTADOR WRITE BLOCKED (middleware) ----------------
class TestContadorWriteBlocked:
    @pytest.mark.parametrize("method,path,body", [
        ("POST", "/orders", {"customer_id": "x", "items": []}),
        ("POST", "/customers", {"name": "x"}),
        ("POST", "/products", {"name": "x", "price": "1"}),
        ("POST", "/leads", {"name": "x"}),
        ("POST", "/goals", {"user_id": "x", "month": "2026-01", "target_amount": "1"}),
        ("POST", "/goals/products", {"user_id": "x", "product_id": "y", "month": "2026-01", "target_qty": 1, "target_amount": "1"}),
        ("POST", "/dashboard/fiscal_regime?mode=classic", None),
        ("PATCH", "/goals/products/nonexistent", {"target_qty": 1}),
        ("DELETE", "/goals/products/nonexistent", None),
        ("DELETE", "/orders/nonexistent", None),
    ])
    def test_mutation_blocked_403(self, contador_token, method, path, body):
        url = f"{API}{path}"
        kwargs = {"headers": _h(contador_token), "timeout": 10}
        if body is not None:
            kwargs["json"] = body
        r = requests.request(method, url, **kwargs)
        assert r.status_code == 403, f"{method} {path} -> {r.status_code}: {r.text[:200]}"
        # detail check
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = r.text
        assert "somente-leitura" in detail.lower() or "contador" in detail.lower(), \
            f"expected 'Contador é somente-leitura' style detail, got: {detail}"

    def test_allowlist_paths_still_work_for_contador(self, contador_token):
        # /api/auth/logout may not exist; /api/notifications should be reachable
        r = requests.get(f"{API}/notifications", headers=_h(contador_token), timeout=10)
        assert r.status_code == 200, f"contador GET /notifications -> {r.status_code}: {r.text[:150]}"
