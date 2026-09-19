from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Lead, LeadMessage, User
from auth import get_current_user, is_admin
from schemas import LeadIn, LeadUpdate, LeadOut, LeadDetailOut, LeadMessageOut, MessageIn
from evolution import send_message, normalize_phone

router = APIRouter(prefix="/api/leads", tags=["leads"])


def _scope(query, current: User):
    if current.tenant_id:
        query = query.where(Lead.tenant_id == current.tenant_id)
    if not is_admin(current):
        query = query.where(Lead.owner_id == current.id)
    return query


@router.get("", response_model=list[LeadOut])
async def list_leads(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Lead).order_by(Lead.updated_at.desc()), current)
    result = await db.execute(q)
    return [LeadOut.model_validate(l) for l in result.scalars().all()]


@router.post("", response_model=LeadOut)
async def create_lead(payload: LeadIn, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    if not data.get("owner_id"):
        data["owner_id"] = current.id
    elif not is_admin(current):
        data["owner_id"] = current.id
    if data.get("phone"):
        data["phone"] = normalize_phone(data["phone"])
    data["tenant_id"] = current.tenant_id
    lead = Lead(**data)
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return LeadOut.model_validate(lead)


@router.get("/{lead_id}", response_model=LeadDetailOut)
async def get_lead(lead_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Lead).options(selectinload(Lead.messages)).where(Lead.id == lead_id)
    q = _scope(q, current)
    result = await db.execute(q)
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return LeadDetailOut.model_validate(lead)


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(lead_id: str, payload: LeadUpdate, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Lead).where(Lead.id == lead_id), current)
    result = await db.execute(q)
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "phone" in data and data["phone"]:
        data["phone"] = normalize_phone(data["phone"])
    if "owner_id" in data and not is_admin(current):
        data.pop("owner_id")
    for k, v in data.items():
        setattr(lead, k, v)
    await db.commit()
    await db.refresh(lead)
    return LeadOut.model_validate(lead)


@router.delete("/{lead_id}")
async def delete_lead(lead_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Lead).where(Lead.id == lead_id), current)
    result = await db.execute(q)
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    await db.delete(lead)
    await db.commit()
    return {"ok": True}


@router.get("/{lead_id}/messages", response_model=list[LeadMessageOut])
async def list_messages(lead_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Lead).where(Lead.id == lead_id), current)
    lead = (await db.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    result = await db.execute(select(LeadMessage).where(LeadMessage.lead_id == lead_id).order_by(LeadMessage.created_at))
    return [LeadMessageOut.model_validate(m) for m in result.scalars().all()]


@router.post("/{lead_id}/messages", response_model=LeadMessageOut)
async def send_lead_message(lead_id: str, payload: MessageIn, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Lead).where(Lead.id == lead_id), current)
    lead = (await db.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    # Send via Evolution (mock or real)
    try:
        if lead.phone:
            await send_message(lead.phone, payload.body)
    except Exception:
        pass
    msg = LeadMessage(lead_id=lead_id, direction="out", channel=payload.channel, body=payload.body, author=current.name)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return LeadMessageOut.model_validate(msg)
