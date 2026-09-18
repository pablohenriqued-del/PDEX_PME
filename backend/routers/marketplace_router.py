"""Marketplace sync (mocked): pull stock & sales from Mercado Livre / Shopee etc."""
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Channel, Inventory, Product, MarketplaceSync, User
from auth import get_current_user, require_admin
from schemas import MarketplaceSyncOut
from routers.notifications_router import create_notification

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])


@router.get("/syncs", response_model=list[MarketplaceSyncOut])
async def list_syncs(_: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MarketplaceSync).order_by(MarketplaceSync.started_at.desc()).limit(50))
    return [MarketplaceSyncOut.model_validate(s) for s in result.scalars().all()]


@router.post("/sync/{channel_id}", response_model=MarketplaceSyncOut)
async def sync_channel(channel_id: str, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    ch = (await db.execute(select(Channel).where(Channel.id == channel_id))).scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Canal não encontrado")

    now = datetime.now(timezone.utc)
    sync = MarketplaceSync(channel_id=channel_id, started_at=now, status="running")
    db.add(sync)
    await db.flush()

    # Simulate: for each inventory item in this channel, adjust quantity randomly and capture sales
    invs = (await db.execute(select(Inventory).where(Inventory.channel_id == channel_id))).scalars().all()
    products_synced = 0
    stock_updated = 0
    sales_captured = 0
    log_lines = [f"[SYNC MOCK] Canal={ch.name} type={ch.type} started={now.isoformat()}"]
    alerts = []

    for inv in invs:
        products_synced += 1
        # Simulate sales: subtract 0-3 units randomly (marketplace movement)
        sold = random.randint(0, min(3, max(0, inv.quantity)))
        if sold > 0:
            inv.quantity -= sold
            sales_captured += sold
            stock_updated += 1
            log_lines.append(f"  · {inv.external_sku or inv.product_id[:8]}: -{sold} unid (venda), estoque agora {inv.quantity}")
        inv.last_sync_at = now

        # Check min_stock alert
        prod = (await db.execute(select(Product).where(Product.id == inv.product_id))).scalar_one()
        if inv.quantity <= (prod.min_stock or 0):
            alerts.append((prod.name, inv.quantity, prod.min_stock, ch.name))

    sync.finished_at = datetime.now(timezone.utc)
    sync.status = "success"
    sync.products_synced = products_synced
    sync.stock_updated = stock_updated
    sync.sales_captured = sales_captured
    sync.log = "\n".join(log_lines[:200])

    # Broadcast a sync notification for admin
    await create_notification(
        db,
        type="marketplace_sync",
        title=f"Sync {ch.name} concluído",
        body=f"{products_synced} produtos sincronizados · {sales_captured} vendas capturadas",
        link=f"/inventory",
        meta={"channel_id": channel_id, "channel_name": ch.name},
        user_id=admin.id,
    )
    # Create stock alerts
    for prod_name, qty, min_stock, ch_name in alerts:
        await create_notification(
            db,
            type="stock_alert",
            title=f"Estoque baixo: {prod_name}",
            body=f"Restam {qty} unidades em {ch_name} (mínimo {min_stock}). Reabastecer para evitar ruptura.",
            link=f"/inventory",
            meta={"product": prod_name, "quantity": qty, "min_stock": min_stock, "channel": ch_name},
            user_id=admin.id,
        )

    await db.commit()
    await db.refresh(sync)
    return MarketplaceSyncOut.model_validate(sync)


@router.post("/sync_all")
async def sync_all_channels(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    channels = (await db.execute(select(Channel).where(Channel.is_active == True, Channel.type.in_(["marketplace", "ecommerce"])))).scalars().all()  # noqa
    results = []
    for ch in channels:
        r = await sync_channel(ch.id, admin, db)
        results.append({"channel": ch.name, "sold": r.sales_captured, "products": r.products_synced})
    return {"synced": len(results), "results": results}
