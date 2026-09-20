"""Audit log helper — call from mutating endpoints for LGPD/SOC-2 tracking."""
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from models import AuditEvent, User

logger = logging.getLogger(__name__)


async def log_event(
    db: AsyncSession,
    *,
    actor: User | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    summary: str | None = None,
    meta: dict | None = None,
    ip_address: str | None = None,
    tenant_id: str | None = None,
) -> AuditEvent:
    """Never raises — logging failures must not break business flow."""
    try:
        event = AuditEvent(
            tenant_id=tenant_id or (actor.tenant_id if actor else None),
            actor_id=actor.id if actor else None,
            actor_email=actor.email if actor else None,
            actor_role=actor.role if actor else None,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            summary=summary,
            meta=meta,
            ip_address=ip_address,
        )
        db.add(event)
        await db.flush()
        return event
    except Exception as e:  # noqa: BLE001
        logger.warning("audit log_event failed: %s", e)
        return None  # type: ignore
