"""NexusERP PME — FastAPI entrypoint."""
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


logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("nexus")

app = FastAPI(title="NexusERP PME", version="1.0.0")

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


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "nexus-erp"}


@app.on_event("startup")
async def on_startup():
    logger.info("Booting NexusERP: init_db + seed")
    await init_db()
    try:
        await run_seed()
    except Exception as e:
        logger.exception(f"Seed failed: {e}")
