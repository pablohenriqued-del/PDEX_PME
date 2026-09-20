"""Notifications: in-app alerts (stock low, marketplace sync, commissions, whatsapp)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Notification, User
from auth import get_current_user, is_admin
from schemas import NotificationOut, NotificationCreate

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("", response_model=list[NotificationOut])
async def list_notifications(unread: bool = Query(False),
                             current: User = Depends(get_current_user),
                             db: AsyncSession = Depends(get_db)):
    # Users see: (a) their own targeted notifications; (b) broadcast (user_id NULL) if admin
    q = select(Notification).order_by(Notification.created_at.desc()).limit(100)
    if is_admin(current):
        q = q.where(or_(Notification.user_id == current.id, Notification.user_id.is_(None)))
    else:
        q = q.where(Notification.user_id == current.id)
    if unread:
        q = q.where(Notification.read == False)  # noqa
    return [NotificationOut.model_validate(n) for n in (await db.execute(q)).scalars().all()]


@router.get("/unread_count")
async def unread_count(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Notification).where(Notification.read == False)  # noqa
    if is_admin(current):
        q = q.where(or_(Notification.user_id == current.id, Notification.user_id.is_(None)))
    else:
        q = q.where(Notification.user_id == current.id)
    rows = (await db.execute(q)).scalars().all()
    return {"count": len(rows)}


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(notification_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    n = (await db.execute(select(Notification).where(Notification.id == notification_id))).scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    if n.user_id and n.user_id != current.id and not is_admin(current):
        raise HTTPException(status_code=403, detail="Sem permissão")
    n.read = True
    await db.commit()
    await db.refresh(n)
    return NotificationOut.model_validate(n)


@router.post("/mark_all_read")
async def mark_all_read(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Notification).where(Notification.read == False)  # noqa
    if is_admin(current):
        q = q.where(or_(Notification.user_id == current.id, Notification.user_id.is_(None)))
    else:
        q = q.where(Notification.user_id == current.id)
    rows = (await db.execute(q)).scalars().all()
    for n in rows:
        n.read = True
    await db.commit()
    return {"marked": len(rows)}


async def create_notification(db: AsyncSession, *, title: str, body: str | None = None,
                              type: str = "info", user_id: str | None = None,
                              link: str | None = None, meta: dict | None = None) -> Notification:
    n = Notification(title=title, body=body, type=type, user_id=user_id, link=link, meta=meta)
    db.add(n)
    await db.flush()
    return n


async def notify_tenant_admins(db: AsyncSession, tenant_id: str | None, *, title: str,
                               body: str | None = None, type: str = "info", link: str | None = None,
                               meta: dict | None = None):
    """Create one Notification row per admin/contador in a tenant."""
    if not tenant_id:
        return
    q = select(User).where(
        User.tenant_id == tenant_id,
        User.role.in_(("admin", "contador")),
        User.is_active.is_(True),
        User.notif_inapp.is_(True),
    )
    admins = (await db.execute(q)).scalars().all()
    for a in admins:
        await create_notification(db, title=title, body=body, type=type, user_id=a.id,
                                  link=link, meta=meta)


async def notify_super_admins(db: AsyncSession, *, title: str, body: str | None = None,
                              type: str = "info", link: str | None = None, meta: dict | None = None):
    q = select(User).where(User.is_super_admin.is_(True), User.is_active.is_(True))
    supers = (await db.execute(q)).scalars().all()
    for s in supers:
        await create_notification(db, title=title, body=body, type=type, user_id=s.id,
                                  link=link, meta=meta)
