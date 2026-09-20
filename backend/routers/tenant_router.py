"""Tenant (multi-empresa) endpoints.

The current admin (conta mestre) manages their tenant: view details, rename,
invite new members with role-based access and list members. Data isolation
today is transitive through User.tenant_id — each user's leads/customers/orders
are already scoped to their user_id, and users are scoped to a tenant, so
per-tenant ownership is guaranteed.
"""
import secrets
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, Tenant
from auth import get_current_user, require_admin, hash_password
from schemas import TenantOut, TenantUpdate, UserOut, InviteIn, InviteOut
from email_service import send_email, render_invite_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tenant", tags=["tenant"])


async def _get_current_tenant(user: User, db: AsyncSession) -> Tenant:
    if not user.tenant_id:
        raise HTTPException(status_code=404, detail="Usuário sem tenant vinculado")
    t = (await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    return t


@router.get("/me", response_model=TenantOut)
async def my_tenant(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return TenantOut.model_validate(await _get_current_tenant(current, db))


@router.patch("/me", response_model=TenantOut)
async def update_tenant(
    payload: TenantUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    t = await _get_current_tenant(admin, db)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(t, k, v)
    await db.commit()
    await db.refresh(t)
    return TenantOut.model_validate(t)


@router.get("/members", response_model=list[UserOut])
async def list_members(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current.tenant_id:
        return []
    result = await db.execute(
        select(User).where(User.tenant_id == current.tenant_id).order_by(User.created_at.desc())
    )
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.post("/invite", response_model=InviteOut)
async def invite_member(
    payload: InviteIn,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin sem tenant vinculado")
    email = payload.email.lower()
    exists = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    role = payload.role if payload.role in ("admin", "vendedor", "contador") else "vendedor"
    used_generated = not payload.password
    generated_pw = payload.password or secrets.token_urlsafe(9)
    user = User(
        email=email,
        password_hash=hash_password(generated_pw),
        name=payload.name,
        role=role,
        tenant_id=admin.tenant_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Fire-and-forget transactional invite email (fails soft).
    tenant = (await db.execute(select(Tenant).where(Tenant.id == admin.tenant_id))).scalar_one_or_none()
    email_id = None
    try:
        email_id = await send_email(
            to=email,
            subject=f"Você foi convidado(a) para {tenant.name if tenant else 'PDEX'}",
            html=render_invite_email(
                invitee_name=payload.name,
                invitee_email=email,
                tenant_name=tenant.name if tenant else "PDEX",
                role=role,
                temp_password=generated_pw,
            ),
        )
    except Exception as e:  # noqa: BLE001 — never block invite creation
        logger.warning("Invite email send failed for %s: %s", email, e)
    return InviteOut(
        user=UserOut.model_validate(user),
        generated_password=generated_pw if used_generated else None,
    )


@router.post("/complete-onboarding", response_model=TenantOut)
async def complete_onboarding(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Mark the current tenant as onboarded (dismisses the wizard)."""
    if not admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin sem tenant")
    t = (await db.execute(select(Tenant).where(Tenant.id == admin.tenant_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    t.onboarding_completed = True
    await db.commit()
    await db.refresh(t)
    return TenantOut.model_validate(t)
