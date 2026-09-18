"""
NexusERP PME — Comprehensive backend regression tests.

Tests all backend features enumerated in the review request:
- Auth (login, /me, RBAC on user list & register)
- Leads CRUD + scoping + messages (send)
- WhatsApp webhook (token check, upsert, message append) + simulate
- Products CRUD (admin-only writes, vendedor read-only)
- Customers (create with LGPD, anonymize, from_lead)
- Orders (create, add/remove items, list) + Payments (add, mark_paid) + scoping
- Invoicing (NFE / NFSE with tax decomposition)
- Dashboard (KPIs, monthly, tax_breakdown, receivables)
- End-to-end flow: WA webhook -> lead -> customer -> order -> payment -> invoice -> dashboard delta
"""
import os
import time
import uuid
from decimal import Decimal

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sales-crm-pro-9.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "pablohenriqued@gmail.com", "password": "NexusERP@2026"}
VENDEDOR = {"email": "vendedor@nexuserp.com", "password": "Vendedor@2026"}
WEBHOOK_TOKEN = "nexus_webhook_secret_2026"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


def _login(s, creds):
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body and body["user"]["email"] == creds["email"].lower()
    return body["access_token"], body["user"]


@pytest.fixture(scope="session")
def admin_auth(s):
    tok, user = _login(s, ADMIN)
    return {"headers": {"Authorization": f"Bearer {tok}"}, "user": user}


@pytest.fixture(scope="session")
def vendedor_auth(s):
    tok, user = _login(s, VENDEDOR)
    return {"headers": {"Authorization": f"Bearer {tok}"}, "user": user}


# ---------- Health ----------
def test_health(s):
    r = s.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth ----------
def test_admin_login_role(s):
    tok, user = _login(s, ADMIN)
    assert user["role"] == "admin"
    assert user["is_active"] is True


def test_vendedor_login_role(s):
    tok, user = _login(s, VENDEDOR)
    assert user["role"] == "vendedor"


def test_auth_me(s, admin_auth):
    r = s.get(f"{API}/auth/me", headers=admin_auth["headers"], timeout=10)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN["email"].lower()


def test_login_bad_credentials(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN["email"], "password": "wrong"}, timeout=10)
    assert r.status_code == 401


def test_admin_can_list_users(s, admin_auth):
    r = s.get(f"{API}/auth/users", headers=admin_auth["headers"], timeout=10)
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list) and len(users) >= 2


def test_vendedor_cannot_list_users(s, vendedor_auth):
    r = s.get(f"{API}/auth/users", headers=vendedor_auth["headers"], timeout=10)
    assert r.status_code == 403


def test_admin_register_new_vendedor(s, admin_auth):
    email = f"test_vend_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(
        f"{API}/auth/register",
        headers=admin_auth["headers"],
        json={"email": email, "password": "Vend@2026", "name": "TEST Vendedor", "role": "vendedor"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["email"] == email and body["role"] == "vendedor"


def test_vendedor_cannot_register(s, vendedor_auth):
    r = s.post(
        f"{API}/auth/register",
        headers=vendedor_auth["headers"],
        json={"email": f"nope_{uuid.uuid4().hex[:6]}@n.t", "password": "x", "name": "n", "role": "vendedor"},
        timeout=10,
    )
    assert r.status_code == 403


# ---------- Leads ----------
def test_leads_crud_and_scoping(s, admin_auth, vendedor_auth):
    # admin creates a lead assigned to vendedor
    r = s.post(
        f"{API}/leads",
        headers=admin_auth["headers"],
        json={"name": "TEST Lead Admin", "phone": "+55 11 91111-1111", "owner_id": vendedor_auth["user"]["id"]},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    admin_lead = r.json()
    assert admin_lead["owner_id"] == vendedor_auth["user"]["id"]
    assert admin_lead["phone"] == "5511911111111"  # normalized
    assert admin_lead["status"] == "novo"

    # vendedor creates its own lead
    r = s.post(
        f"{API}/leads",
        headers=vendedor_auth["headers"],
        json={"name": "TEST Lead Vendedor", "phone": "5511922223333"},
        timeout=10,
    )
    assert r.status_code == 200
    v_lead = r.json()
    assert v_lead["owner_id"] == vendedor_auth["user"]["id"]

    # vendedor lists -> should only see own leads
    r = s.get(f"{API}/leads", headers=vendedor_auth["headers"], timeout=10)
    assert r.status_code == 200
    v_leads = r.json()
    v_ids = {l["id"] for l in v_leads}
    assert v_lead["id"] in v_ids
    for l in v_leads:
        assert l["owner_id"] == vendedor_auth["user"]["id"]

    # admin lists -> sees both
    r = s.get(f"{API}/leads", headers=admin_auth["headers"], timeout=10)
    assert r.status_code == 200
    ids = {l["id"] for l in r.json()}
    assert admin_lead["id"] in ids and v_lead["id"] in ids

    # update status to move through kanban
    r = s.patch(
        f"{API}/leads/{v_lead['id']}",
        headers=vendedor_auth["headers"],
        json={"status": "qualificado"},
        timeout=10,
    )
    assert r.status_code == 200 and r.json()["status"] == "qualificado"

    # get with messages
    r = s.get(f"{API}/leads/{v_lead['id']}", headers=vendedor_auth["headers"], timeout=10)
    assert r.status_code == 200
    assert "messages" in r.json()

    # send outbound message
    r = s.post(
        f"{API}/leads/{v_lead['id']}/messages",
        headers=vendedor_auth["headers"],
        json={"body": "Olá, teste TEST"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json()["direction"] == "out"

    # vendedor cannot fetch admin_lead if it's owned by them (it is), but they can't fetch leads not owned
    # create an admin-only lead (owner = admin)
    r = s.post(
        f"{API}/leads",
        headers=admin_auth["headers"],
        json={"name": "TEST Lead Only Admin", "owner_id": admin_auth["user"]["id"]},
        timeout=10,
    )
    admin_only = r.json()
    r = s.get(f"{API}/leads/{admin_only['id']}", headers=vendedor_auth["headers"], timeout=10)
    assert r.status_code == 404  # scoped out

    # delete
    r = s.delete(f"{API}/leads/{v_lead['id']}", headers=vendedor_auth["headers"], timeout=10)
    assert r.status_code == 200
    s.delete(f"{API}/leads/{admin_lead['id']}", headers=admin_auth["headers"], timeout=10)
    s.delete(f"{API}/leads/{admin_only['id']}", headers=admin_auth["headers"], timeout=10)


# ---------- WhatsApp ----------
def test_whatsapp_webhook_wrong_token(s):
    r = s.post(f"{API}/whatsapp/webhook?token=wrong", json={"event": "messages.upsert"}, timeout=10)
    assert r.status_code == 403


def test_whatsapp_webhook_creates_lead_and_appends(s, admin_auth):
    phone_raw = f"55119{int(time.time()) % 100000000:08d}"
    remote = f"{phone_raw}@s.whatsapp.net"
    payload = {
        "event": "messages.upsert",
        "data": {
            "key": {"remoteJid": remote, "fromMe": False, "id": "MSG_" + uuid.uuid4().hex[:8]},
            "message": {"conversation": "Olá, quero saber sobre o produto TEST"},
            "pushName": "TEST Cliente WA",
        },
    }
    r = s.post(f"{API}/whatsapp/webhook?token={WEBHOOK_TOKEN}", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "lead_id" in body and "message_id" in body
    lead_id = body["lead_id"]

    # verify lead in DB via admin
    r = s.get(f"{API}/leads/{lead_id}", headers=admin_auth["headers"], timeout=10)
    assert r.status_code == 200
    lead = r.json()
    assert lead["source"] == "WhatsApp"
    assert lead["status"] == "novo"
    assert lead["phone"] == phone_raw
    assert len(lead["messages"]) >= 1
    assert lead["messages"][0]["direction"] == "in"

    # send a second webhook for same phone -> should append not create new
    payload2 = dict(payload)
    payload2["data"] = dict(payload["data"])
    payload2["data"]["message"] = {"conversation": "Segunda mensagem TEST"}
    payload2["data"]["key"] = dict(payload["data"]["key"])
    payload2["data"]["key"]["id"] = "MSG_" + uuid.uuid4().hex[:8]
    r = s.post(f"{API}/whatsapp/webhook?token={WEBHOOK_TOKEN}", json=payload2, timeout=15)
    assert r.status_code == 200
    assert r.json()["lead_id"] == lead_id

    r = s.get(f"{API}/leads/{lead_id}", headers=admin_auth["headers"], timeout=10)
    assert len(r.json()["messages"]) >= 2

    # cleanup
    s.delete(f"{API}/leads/{lead_id}", headers=admin_auth["headers"], timeout=10)


def test_whatsapp_simulate(s, admin_auth):
    phone = f"55119{int(time.time()) % 100000000:08d}"
    r = s.post(
        f"{API}/whatsapp/simulate",
        params={"phone": phone, "body": "SIM msg", "name": "TEST Sim"},
        timeout=10,
    )
    assert r.status_code == 200
    lead_id = r.json()["lead_id"]
    r = s.get(f"{API}/leads/{lead_id}", headers=admin_auth["headers"], timeout=10)
    assert r.status_code == 200
    s.delete(f"{API}/leads/{lead_id}", headers=admin_auth["headers"], timeout=10)


# ---------- Products ----------
def test_products_admin_crud_vendedor_readonly(s, admin_auth, vendedor_auth):
    # vendedor GET -> 200
    r = s.get(f"{API}/products", headers=vendedor_auth["headers"], timeout=10)
    assert r.status_code == 200

    # vendedor POST -> 403
    r = s.post(
        f"{API}/products",
        headers=vendedor_auth["headers"],
        json={"name": "TEST Prod", "type": "product", "price": "10.00"},
        timeout=10,
    )
    assert r.status_code == 403

    # admin creates a product and a service
    r = s.post(
        f"{API}/products",
        headers=admin_auth["headers"],
        json={"sku": f"TEST-{uuid.uuid4().hex[:6]}", "name": "TEST Widget", "type": "product", "price": "100.00"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    prod = r.json()
    assert prod["type"] == "product" and Decimal(prod["price"]) == Decimal("100.00")

    r = s.post(
        f"{API}/products",
        headers=admin_auth["headers"],
        json={"sku": f"TESTS-{uuid.uuid4().hex[:6]}", "name": "TEST Consultoria", "type": "service", "price": "200.00"},
        timeout=10,
    )
    assert r.status_code == 200
    serv = r.json()
    assert serv["type"] == "service"

    # patch
    r = s.patch(
        f"{API}/products/{prod['id']}",
        headers=admin_auth["headers"],
        json={"sku": prod["sku"], "name": "TEST Widget V2", "type": "product", "price": "120.00"},
        timeout=10,
    )
    assert r.status_code == 200 and r.json()["name"] == "TEST Widget V2"

    # persist store product ids for other tests via module-level cache
    _cache["product_id"] = prod["id"]
    _cache["service_id"] = serv["id"]


_cache: dict = {}


# ---------- Customers + End-to-end ----------
def test_end_to_end_flow(s, admin_auth, vendedor_auth):
    """Full flow: incoming WA -> lead -> customer(from_lead) -> order -> payment -> invoice -> dashboard delta."""
    # Ensure products exist
    assert "product_id" in _cache, "product test must run first"
    product_id = _cache["product_id"]

    # Baseline dashboard
    r = s.get(f"{API}/dashboard", headers=admin_auth["headers"], timeout=15)
    assert r.status_code == 200
    baseline = r.json()
    baseline_gross = Decimal(str(baseline["kpis"]["revenue_gross"]))
    baseline_taxes = Decimal(str(baseline["kpis"]["total_taxes"]))

    # 1. Incoming WA webhook -> creates lead
    phone_raw = f"55119{int(time.time() * 1000) % 100000000:08d}"
    remote = f"{phone_raw}@s.whatsapp.net"
    payload = {
        "event": "messages.upsert",
        "data": {
            "key": {"remoteJid": remote, "fromMe": False, "id": "E2E_" + uuid.uuid4().hex[:8]},
            "message": {"conversation": "TEST E2E - quero comprar"},
            "pushName": "TEST E2E Cliente",
        },
    }
    r = s.post(f"{API}/whatsapp/webhook?token={WEBHOOK_TOKEN}", json=payload, timeout=15)
    assert r.status_code == 200
    lead_id = r.json()["lead_id"]

    # Reassign lead to vendedor so we can test vendedor-scoped flow
    r = s.patch(
        f"{API}/leads/{lead_id}",
        headers=admin_auth["headers"],
        json={"owner_id": vendedor_auth["user"]["id"], "email": "test_e2e@nexus.test", "company": "TEST E2E Co"},
        timeout=10,
    )
    assert r.status_code == 200

    # 2. Convert lead to customer (vendedor)
    r = s.post(f"{API}/customers/from_lead/{lead_id}", headers=vendedor_auth["headers"], timeout=10)
    assert r.status_code == 200, r.text
    customer = r.json()
    assert customer["lgpd_consent"] is True and customer["lgpd_consent_at"] is not None
    assert customer["person_type"] == "PJ"
    customer_id = customer["id"]

    # Verify lead moved to 'ganho' and links to customer
    r = s.get(f"{API}/leads/{lead_id}", headers=vendedor_auth["headers"], timeout=10)
    assert r.status_code == 200
    ld = r.json()
    assert ld["status"] == "ganho"
    assert ld["customer_id"] == customer_id

    # 3. Create order with product item (vendedor)
    r = s.post(
        f"{API}/orders",
        headers=vendedor_auth["headers"],
        json={
            "customer_id": customer_id,
            "lead_id": lead_id,
            "items": [{"product_id": product_id, "quantity": "2"}],
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    order = r.json()
    order_id = order["id"]
    # product price patched to 120, qty 2 -> gross = 240
    assert Decimal(str(order["total_gross"])) == Decimal("240.00")
    assert order["seller_id"] == vendedor_auth["user"]["id"]
    assert len(order["items"]) == 1

    # vendedor sees the order in list; check scoping doesn't leak
    r = s.get(f"{API}/orders", headers=vendedor_auth["headers"], timeout=10)
    assert r.status_code == 200
    v_orders = r.json()
    for o in v_orders:
        assert o["seller_id"] == vendedor_auth["user"]["id"]

    # 4. Add another item then remove it (to test add/remove)
    r = s.post(
        f"{API}/orders/{order_id}/items",
        headers=vendedor_auth["headers"],
        json={"product_id": product_id, "quantity": "1", "unit_price": "50.00"},
        timeout=10,
    )
    assert r.status_code == 200
    o2 = r.json()
    assert Decimal(str(o2["total_gross"])) == Decimal("290.00")
    new_item_id = [i["id"] for i in o2["items"] if Decimal(str(i["unit_price"])) == Decimal("50.00")][0]
    r = s.delete(f"{API}/orders/{order_id}/items/{new_item_id}", headers=vendedor_auth["headers"], timeout=10)
    assert r.status_code == 200
    assert Decimal(str(r.json()["total_gross"])) == Decimal("240.00")

    # 5. Add payment (pending) and mark paid
    r = s.post(
        f"{API}/orders/{order_id}/payments",
        headers=vendedor_auth["headers"],
        json={"method": "pix", "amount": "240.00"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    pay = r.json()
    assert pay["status"] == "pending" and pay["method"] == "pix"
    payment_id = pay["id"]

    # a pending payment should show in dashboard receivables
    r = s.get(f"{API}/dashboard", headers=vendedor_auth["headers"], timeout=15)
    assert r.status_code == 200
    receivable_ids = [rc["payment_id"] for rc in r.json()["receivables"]]
    assert payment_id in receivable_ids

    r = s.post(
        f"{API}/orders/{order_id}/payments/{payment_id}/mark_paid",
        headers=vendedor_auth["headers"],
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "paid" and r.json()["paid_at"] is not None

    # 6. Emit invoice — product-only order -> NFE
    r = s.post(f"{API}/orders/{order_id}/invoice", headers=vendedor_auth["headers"], timeout=20)
    assert r.status_code == 200, r.text
    inv = r.json()
    assert inv["type"] == "NFE"
    assert inv["status"] == "issued"
    assert Decimal(str(inv["total_gross"])) == Decimal("240.00")
    # NFE = ICMS 0.18 + PIS 0.0165 + COFINS 0.076 + IPI 0.05 = 0.3225
    expected_taxes = (Decimal("240.00") * Decimal("0.3225")).quantize(Decimal("0.01"))
    assert Decimal(str(inv["total_taxes"])) == expected_taxes, f"expected {expected_taxes}, got {inv['total_taxes']}"
    tax_types = {t["tax_type"] for t in inv["taxes"]}
    assert tax_types == {"ICMS", "PIS", "COFINS", "IPI"}
    # order status becomes invoiced
    r = s.get(f"{API}/orders/{order_id}", headers=vendedor_auth["headers"], timeout=10)
    assert r.json()["status"] == "invoiced"
    assert Decimal(str(r.json()["total_taxes"])) == expected_taxes

    # 7. Dashboard reflects delta
    r = s.get(f"{API}/dashboard", headers=admin_auth["headers"], timeout=15)
    assert r.status_code == 200
    after = r.json()
    after_gross = Decimal(str(after["kpis"]["revenue_gross"]))
    after_taxes = Decimal(str(after["kpis"]["total_taxes"]))
    assert after_gross - baseline_gross >= Decimal("240.00")
    assert after_taxes - baseline_taxes >= expected_taxes
    # tax_breakdown contains at least one entry per NFE tax
    breakdown_types = {t["tax_type"] for t in after["tax_breakdown"]}
    assert {"ICMS", "PIS", "COFINS", "IPI"}.issubset(breakdown_types)
    # monthly has 6 buckets
    assert len(after["monthly"]) == 6

    _cache["order_id"] = order_id
    _cache["customer_id"] = customer_id
    _cache["lead_id"] = lead_id


def test_service_order_generates_nfse(s, admin_auth):
    assert "service_id" in _cache
    # Create a customer directly (admin)
    r = s.post(
        f"{API}/customers",
        headers=admin_auth["headers"],
        json={"name": "TEST Serv Cliente", "person_type": "PF", "lgpd_consent": True},
        timeout=10,
    )
    assert r.status_code == 200
    cust = r.json()
    assert cust["lgpd_consent"] and cust["lgpd_consent_at"] is not None

    r = s.post(
        f"{API}/orders",
        headers=admin_auth["headers"],
        json={"customer_id": cust["id"], "items": [{"product_id": _cache["service_id"], "quantity": "1"}]},
        timeout=15,
    )
    assert r.status_code == 200
    order = r.json()
    assert Decimal(str(order["total_gross"])) == Decimal("200.00")

    r = s.post(f"{API}/orders/{order['id']}/invoice", headers=admin_auth["headers"], timeout=20)
    assert r.status_code == 200, r.text
    inv = r.json()
    assert inv["type"] == "NFSE"
    # NFSE: ISS 0.05 + PIS 0.0165 + COFINS 0.076 = 0.1425
    expected = (Decimal("200.00") * Decimal("0.1425")).quantize(Decimal("0.01"))
    assert Decimal(str(inv["total_taxes"])) == expected
    tax_types = {t["tax_type"] for t in inv["taxes"]}
    assert tax_types == {"ISS", "PIS", "COFINS"}

    _cache["service_customer_id"] = cust["id"]


def test_customer_anonymize(s, admin_auth):
    # create then anonymize
    r = s.post(
        f"{API}/customers",
        headers=admin_auth["headers"],
        json={
            "name": "TEST To Anonymize",
            "document": "12345678900",
            "email": "anon@nexus.test",
            "phone": "5511999998888",
            "lgpd_consent": True,
        },
        timeout=10,
    )
    assert r.status_code == 200
    cust = r.json()
    r = s.post(f"{API}/customers/{cust['id']}/anonymize", headers=admin_auth["headers"], timeout=10)
    assert r.status_code == 200
    ac = r.json()
    assert ac["anonymized"] is True
    assert ac["document"] is None and ac["email"] is None and ac["phone"] is None
    assert ac["name"].startswith("Cliente Anonimizado")


# ---------- Cleanup (best-effort) ----------
def test_zzz_cleanup(s, admin_auth):
    # delete products created
    for key in ("product_id", "service_id"):
        pid = _cache.get(key)
        if pid:
            # deletion may fail if referenced by order items (FK) — that's fine
            s.delete(f"{API}/products/{pid}", headers=admin_auth["headers"], timeout=10)
    # delete e2e lead (its customer/order remain; ok for regression audit)
    lid = _cache.get("lead_id")
    if lid:
        s.delete(f"{API}/leads/{lid}", headers=admin_auth["headers"], timeout=10)
