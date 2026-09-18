import os
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Lead, LeadMessage
from auth import get_current_user
from evolution import parse_incoming_webhook, is_configured, normalize_phone

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


@router.get("/status")
async def status():
    return {
        "configured": is_configured(),
        "url_set": bool(os.environ.get("EVOLUTION_API_URL")),
        "instance": os.environ.get("EVOLUTION_INSTANCE", ""),
    }


@router.post("/webhook")
async def webhook(request: Request, token: str = Query(...), db: AsyncSession = Depends(get_db)):
    expected = os.environ.get("EVOLUTION_WEBHOOK_TOKEN", "")
    if not expected or token != expected:
        raise HTTPException(status_code=403, detail="Invalid webhook token")

    payload = await request.json()
    parsed = parse_incoming_webhook(payload)
    if not parsed:
        return {"ignored": True}

    phone = parsed["phone"]
    result = await db.execute(select(Lead).where(Lead.phone == phone))
    lead = result.scalar_one_or_none()
    if lead is None:
        lead = Lead(
            name=parsed.get("name") or f"WhatsApp {phone}",
            phone=phone,
            source="WhatsApp",
            status="novo",
        )
        db.add(lead)
        await db.flush()

    msg = LeadMessage(
        lead_id=lead.id,
        direction="in",
        channel="WhatsApp",
        body=parsed["body"],
        author=parsed.get("name"),
        external_id=parsed.get("external_id"),
    )
    db.add(msg)
    await db.commit()
    return {"lead_id": lead.id, "message_id": msg.id}


@router.post("/simulate")
async def simulate_incoming(phone: str, body: str, name: str | None = None,
                            current=Depends(get_current_user),
                            db: AsyncSession = Depends(get_db)):
    """Dev helper: simulate an incoming WhatsApp message. Requires auth."""
    phone = normalize_phone(phone) or phone
    result = await db.execute(select(Lead).where(Lead.phone == phone))
    lead = result.scalar_one_or_none()
    if lead is None:
        lead = Lead(name=name or f"WhatsApp {phone}", phone=phone, source="WhatsApp", status="novo")
        db.add(lead)
        await db.flush()
    msg = LeadMessage(lead_id=lead.id, direction="in", channel="WhatsApp", body=body, author=name)
    db.add(msg)
    await db.commit()
    return {"lead_id": lead.id, "message_id": msg.id}
