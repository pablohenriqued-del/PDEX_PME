from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Customer, Lead, User
from auth import get_current_user, is_admin
from schemas import CustomerIn, CustomerUpdate, CustomerOut

router = APIRouter(prefix="/api/customers", tags=["customers"])


def _scope(query, current: User):
    if not is_admin(current):
        return query.where(Customer.owner_id == current.id)
    return query


@router.get("", response_model=list[CustomerOut])
async def list_customers(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Customer).order_by(Customer.created_at.desc()), current)
    return [CustomerOut.model_validate(c) for c in (await db.execute(q)).scalars().all()]


@router.post("", response_model=CustomerOut)
async def create_customer(payload: CustomerIn, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    data["owner_id"] = current.id
    if data.get("lgpd_consent"):
        data["lgpd_consent_at"] = datetime.now(timezone.utc)
    c = Customer(**data)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return CustomerOut.model_validate(c)


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Customer).where(Customer.id == customer_id), current)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return CustomerOut.model_validate(c)


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(customer_id: str, payload: CustomerUpdate, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Customer).where(Customer.id == customer_id), current)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    if c.anonymized:
        raise HTTPException(status_code=400, detail="Cliente anonimizado")
    data = payload.model_dump(exclude_unset=True)
    if data.get("lgpd_consent") and not c.lgpd_consent:
        data["lgpd_consent_at"] = datetime.now(timezone.utc)
    for k, v in data.items():
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return CustomerOut.model_validate(c)


@router.post("/{customer_id}/anonymize", response_model=CustomerOut)
async def anonymize_customer(customer_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Customer).where(Customer.id == customer_id), current)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    c.name = f"Cliente Anonimizado #{c.id[:8]}"
    c.document = None
    c.email = None
    c.phone = None
    c.address = None
    c.zip_code = None
    c.anonymized = True
    await db.commit()
    await db.refresh(c)
    return CustomerOut.model_validate(c)


@router.post("/from_lead/{lead_id}", response_model=CustomerOut)
async def create_from_lead(lead_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lead = (await db.execute(select(Lead).where(Lead.id == lead_id))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    if not is_admin(current) and lead.owner_id != current.id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    if lead.customer_id:
        existing = (await db.execute(select(Customer).where(Customer.id == lead.customer_id))).scalar_one_or_none()
        if existing:
            return CustomerOut.model_validate(existing)
    c = Customer(
        name=lead.company or lead.name,
        email=lead.email,
        phone=lead.phone,
        person_type="PJ" if lead.company else "PF",
        owner_id=current.id,
        lgpd_consent=True,
        lgpd_consent_at=datetime.now(timezone.utc),
    )
    db.add(c)
    await db.flush()
    lead.customer_id = c.id
    lead.status = "ganho"
    await db.commit()
    await db.refresh(c)
    return CustomerOut.model_validate(c)
