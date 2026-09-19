"""Public (unauthenticated) endpoints — landing form, health, etc."""
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, Lead
from schemas import DemoRequestIn, LeadOut
from evolution import normalize_phone

router = APIRouter(prefix="/api/public", tags=["public"])


@router.post("/demo-request", response_model=LeadOut)
async def demo_request(payload: DemoRequestIn, db: AsyncSession = Depends(get_db)):
    """PUBLIC — creates a new Lead from the landing page 'Solicitar demo' form.

    Ownership is assigned to the first active admin (tenant master) so it shows
    up on their CRM Kanban board in the 'Novo' column with source 'Site'.
    """
    admin = (
        await db.execute(
            select(User).where(User.role == "admin", User.is_active.is_(True)).order_by(User.created_at)
        )
    ).scalars().first()
    notes_parts = []
    if payload.message:
        notes_parts.append(payload.message.strip())
    notes_parts.append("[origem: landing pdex.com.br · /solicitar-demo]")
    lead = Lead(
        name=payload.name.strip(),
        email=payload.email.lower(),
        phone=normalize_phone(payload.phone) if payload.phone else None,
        company=payload.company.strip() if payload.company else None,
        source="Site",
        status="novo",
        value=Decimal("0"),
        notes="\n".join(notes_parts),
        owner_id=admin.id if admin else None,
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return LeadOut.model_validate(lead)
