"""Super-admin CRUD for tenants (create/list) + tenant switch.

- POST /api/tenants — create a new tenant + its first admin user (super-admin only)
- GET  /api/tenants — list all tenants (super-admin only)
- POST /api/tenant/switch/{tenant_id} — issue a new JWT scoped to another tenant
  without re-login (super-admin only). The switched-into tenant is still owned
  by the super-admin (they impersonate an admin role there).
"""
import re
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, Tenant
from auth import (
    get_current_user, require_super_admin, hash_password, create_access_token,
)
from schemas import TenantOut, TenantCreate, TokenOut, UserOut, InviteOut

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "tenant"


@router.get("", response_model=list[TenantOut])
async def list_tenants(_: User = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant).order_by(Tenant.created_at))
    return [TenantOut.model_validate(t) for t in result.scalars().all()]


@router.post("", response_model=InviteOut)
async def create_tenant(
    payload: TenantCreate,
    _: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    slug = (payload.slug or _slugify(payload.name)).lower()
    exists = (await db.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail=f"Slug '{slug}' já existe")
    admin_email = payload.admin_email.lower()
    user_exists = (await db.execute(select(User).where(User.email == admin_email))).scalar_one_or_none()
    if user_exists:
        raise HTTPException(status_code=400, detail="Email do admin já cadastrado")

    tenant = Tenant(name=payload.name, slug=slug, plan=payload.plan, onboarding_completed=False)
    db.add(tenant)
    await db.flush()

    used_generated = not payload.admin_password
    temp_pw = payload.admin_password or secrets.token_urlsafe(9)
    user = User(
        email=admin_email,
        password_hash=hash_password(temp_pw),
        name=payload.admin_name,
        role="admin",
        is_active=True,
        tenant_id=tenant.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return InviteOut(
        user=UserOut.model_validate(user),
        generated_password=temp_pw if used_generated else None,
    )


# --- Switch endpoint mounted under /api/tenant (singular) namespace, but
# defined here so it lives alongside the CRUD. Registered separately in server.py.
switch_router = APIRouter(prefix="/api/tenant", tags=["tenant"])


@switch_router.post("/switch/{tenant_id}", response_model=TokenOut)
async def switch_tenant(
    tenant_id: str,
    current: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return a fresh JWT with `tenant_id` set to the target tenant. The user row
    itself is NOT mutated — only the token in the caller's session is refreshed.
    """
    t = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    # Update the physical row so subsequent /auth/me and DB scoping match.
    current.tenant_id = t.id
    await db.commit()
    await db.refresh(current)
    token = create_access_token(current.id, current.email, current.role, current.tenant_id)
    return TokenOut(access_token=token, user=UserOut.model_validate(current))
