from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Channel, Inventory, Product, User
from auth import get_current_user, require_admin
from schemas import ChannelIn, ChannelOut, InventoryIn, InventoryUpdate, InventoryOut, InventoryDetail
from routers.notifications_router import create_notification


async def _maybe_alert(db, inv, admin_user_id: str | None = None):
    prod = (await db.execute(select(Product).where(Product.id == inv.product_id))).scalar_one_or_none()
    ch = (await db.execute(select(Channel).where(Channel.id == inv.channel_id))).scalar_one_or_none()
    if prod and ch and inv.quantity <= (prod.min_stock or 0):
        await create_notification(
            db, type="stock_alert",
            title=f"Estoque baixo: {prod.name}",
            body=f"Restam {inv.quantity} unidades em {ch.name} (mínimo {prod.min_stock}).",
            link="/inventory",
            meta={"product": prod.name, "channel": ch.name, "quantity": inv.quantity, "min_stock": prod.min_stock},
            user_id=admin_user_id,
        )

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


# ---- Channels ----
@router.get("/channels", response_model=list[ChannelOut])
async def list_channels(_: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).order_by(Channel.name))
    return [ChannelOut.model_validate(c) for c in result.scalars().all()]


@router.post("/channels", response_model=ChannelOut)
async def create_channel(payload: ChannelIn, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(Channel).where(Channel.name == payload.name))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Canal já existe")
    c = Channel(**payload.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return ChannelOut.model_validate(c)


@router.patch("/channels/{channel_id}", response_model=ChannelOut)
async def update_channel(channel_id: str, payload: ChannelIn, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Channel).where(Channel.id == channel_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Canal não encontrado")
    for k, v in payload.model_dump().items():
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return ChannelOut.model_validate(c)


@router.delete("/channels/{channel_id}")
async def delete_channel(channel_id: str, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Channel).where(Channel.id == channel_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Canal não encontrado")
    await db.delete(c)
    await db.commit()
    return {"ok": True}


# ---- Inventory items ----
@router.get("", response_model=list[InventoryDetail])
async def list_inventory(product_id: str | None = Query(None), channel_id: str | None = Query(None),
                          _: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Inventory, Product.name, Channel.name, Channel.type).join(
        Product, Product.id == Inventory.product_id
    ).join(Channel, Channel.id == Inventory.channel_id)
    if product_id:
        q = q.where(Inventory.product_id == product_id)
    if channel_id:
        q = q.where(Inventory.channel_id == channel_id)
    q = q.order_by(Product.name)
    rows = (await db.execute(q)).all()
    out = []
    for inv, prod_name, ch_name, ch_type in rows:
        d = InventoryDetail.model_validate(inv).model_dump()
        d["product_name"] = prod_name
        d["channel_name"] = ch_name
        d["channel_type"] = ch_type
        out.append(InventoryDetail(**d))
    return out


@router.post("", response_model=InventoryOut)
async def create_inventory(payload: InventoryIn, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(Inventory).where(Inventory.product_id == payload.product_id, Inventory.channel_id == payload.channel_id)
    )).scalar_one_or_none()
    if existing:
        for k, v in payload.model_dump().items():
            setattr(existing, k, v)
        existing.last_sync_at = datetime.now(timezone.utc)
        await _maybe_alert(db, existing, admin.id)
        await db.commit()
        await db.refresh(existing)
        return InventoryOut.model_validate(existing)
    inv = Inventory(**payload.model_dump(), last_sync_at=datetime.now(timezone.utc))
    db.add(inv)
    await db.flush()
    await _maybe_alert(db, inv, admin.id)
    await db.commit()
    await db.refresh(inv)
    return InventoryOut.model_validate(inv)


@router.patch("/{inventory_id}", response_model=InventoryOut)
async def update_inventory(inventory_id: str, payload: InventoryUpdate, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    inv = (await db.execute(select(Inventory).where(Inventory.id == inventory_id))).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventário não encontrado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(inv, k, v)
    inv.last_sync_at = datetime.now(timezone.utc)
    await _maybe_alert(db, inv, admin.id)
    await db.commit()
    await db.refresh(inv)
    return InventoryOut.model_validate(inv)


@router.delete("/{inventory_id}")
async def delete_inventory(inventory_id: str, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    inv = (await db.execute(select(Inventory).where(Inventory.id == inventory_id))).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventário não encontrado")
    await db.delete(inv)
    await db.commit()
    return {"ok": True}


@router.get("/summary")
async def inventory_summary(_: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Aggregate: total stock per channel and per product."""
    per_channel_q = select(Channel.name, Channel.type, func.coalesce(func.sum(Inventory.quantity), 0)).outerjoin(
        Inventory, Inventory.channel_id == Channel.id
    ).group_by(Channel.name, Channel.type).order_by(Channel.name)
    rows = (await db.execute(per_channel_q)).all()

    per_product_q = select(Product.name, func.coalesce(func.sum(Inventory.quantity), 0)).outerjoin(
        Inventory, Inventory.product_id == Product.id
    ).where(Product.type == "product").group_by(Product.name).order_by(Product.name)
    prod_rows = (await db.execute(per_product_q)).all()

    return {
        "per_channel": [{"channel": r[0], "type": r[1], "quantity": int(r[2])} for r in rows],
        "per_product": [{"product": r[0], "quantity": int(r[1])} for r in prod_rows],
    }
