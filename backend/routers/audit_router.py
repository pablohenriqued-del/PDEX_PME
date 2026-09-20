"""Audit event viewer — admin sees own tenant, super-admin sees all."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AuditEvent, User
from auth import require_admin
from schemas import AuditEventOut

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=list[AuditEventOut])
async def list_events(
    resource_type: str | None = Query(None),
    action: str | None = Query(None),
    limit: int = Query(200, le=500),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)
    # Super-admin sees everything; admin sees their tenant only.
    if not admin.is_super_admin:
        q = q.where(AuditEvent.tenant_id == admin.tenant_id)
    if resource_type:
        q = q.where(AuditEvent.resource_type == resource_type)
    if action:
        q = q.where(AuditEvent.action == action)
    rows = (await db.execute(q)).scalars().all()
    return [AuditEventOut.model_validate(r) for r in rows]
