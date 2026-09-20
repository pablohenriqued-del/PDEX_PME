"""PDEX — PME · ERP · Sem Limites — FastAPI entrypoint."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from seed import run_seed
from settings_store import load_settings_cache
from routers.auth_router import router as auth_router
from routers.leads_router import router as leads_router
from routers.whatsapp_router import router as whatsapp_router
from routers.customers_router import router as customers_router
from routers.products_router import router as products_router
from routers.orders_router import router as orders_router
from routers.dashboard_router import router as dashboard_router
from routers.goals_router import router as goals_router
from routers.inventory_router import router as inventory_router
from routers.reports_router import router as reports_router
from routers.notifications_router import router as notifications_router
from routers.marketplace_router import router as marketplace_router
from routers.tenant_router import router as tenant_router
from routers.public_router import router as public_router
from routers.tenants_router import router as tenants_router, switch_router as tenant_switch_router


logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("nexus")

app = FastAPI(title="PDEX ERP", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(leads_router)
app.include_router(whatsapp_router)
app.include_router(customers_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(dashboard_router)
app.include_router(goals_router)
app.include_router(inventory_router)
app.include_router(reports_router)
app.include_router(notifications_router)
app.include_router(marketplace_router)
app.include_router(tenant_router)
app.include_router(tenant_switch_router)  # /api/tenant/switch/{id}
app.include_router(tenants_router)         # /api/tenants CRUD
app.include_router(public_router)


@app.middleware("http")
async def contador_readonly_guard(request, call_next):
    """Contador role: read-only. Reject POST/PATCH/PUT/DELETE except allowlisted endpoints."""
    if request.method in ("POST", "PATCH", "PUT", "DELETE"):
        # Allowlist: auth login/logout/me, notifications read (read-only actions)
        path = request.url.path
        allow_prefixes = ("/api/auth/login", "/api/auth/logout", "/api/notifications/", "/api/public/")
        if not any(path.startswith(p) for p in allow_prefixes):
            auth_header = request.headers.get("authorization", "")
            if auth_header.lower().startswith("bearer "):
                token = auth_header.split(None, 1)[1]
                try:
                    import jwt as _jwt
                    payload = _jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[os.environ.get("JWT_ALGORITHM", "HS256")])
                    if payload.get("role") == "contador":
                        from fastapi.responses import JSONResponse
                        return JSONResponse(status_code=403, content={"detail": "Contador é somente-leitura"})
                except Exception:
                    pass
    return await call_next(request)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "nexus-erp"}


@app.on_event("startup")
async def on_startup():
    logger.info("Booting PDEX: init_db + seed + settings cache")
    await init_db()
    await load_settings_cache()
    try:
        await run_seed()
    except Exception as e:
        logger.exception(f"Seed failed: {e}")
