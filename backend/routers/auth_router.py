from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin,
)
from schemas import LoginIn, RegisterIn, TokenOut, UserOut, ProfileUpdate, ChangePasswordIn
from audit_service import log_event

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, request: Request, db: AsyncSession = Depends(get_db)):
    email = payload.email.lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    token = create_access_token(user.id, user.email, user.role, user.tenant_id)
    await log_event(
        db, actor=user, action="login", resource_type="session",
        resource_id=user.id, summary=f"Login OK — {user.email}",
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=UserOut)
async def register(payload: RegisterIn, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    email = payload.email.lower()
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    role = payload.role if payload.role in ("admin", "vendedor", "contador") else "vendedor"
    user = User(
        email=email, password_hash=hash_password(payload.password), name=payload.name,
        role=role, tenant_id=admin.tenant_id,
    )
    db.add(user)
    await db.flush()
    await log_event(
        db, actor=admin, action="create", resource_type="user",
        resource_id=user.id, summary=f"Criou usuário {user.email} ({role})",
    )
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/me", response_model=UserOut)
async def me(current: User = Depends(get_current_user)):
    return UserOut.model_validate(current)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: ProfileUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the caller's own profile. Cannot change email / role / tenant here."""
    data = payload.model_dump(exclude_unset=True)
    # Guard avatar size — data URLs can bloat rows
    if "avatar_url" in data and data["avatar_url"] and len(data["avatar_url"]) > 500_000:
        raise HTTPException(status_code=413, detail="Avatar muito grande (max 500KB base64)")
    for k, v in data.items():
        setattr(current, k, v)
    await log_event(
        db, actor=current, action="update", resource_type="user",
        resource_id=current.id, summary="Atualizou próprio perfil",
        meta={"fields": list(data.keys())},
    )
    await db.commit()
    await db.refresh(current)
    return UserOut.model_validate(current)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordIn,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current.password_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    current.password_hash = hash_password(payload.new_password)
    await log_event(
        db, actor=current, action="change_password", resource_type="user",
        resource_id=current.id, summary="Troca de senha via /me",
    )
    await db.commit()
    return {"ok": True}


@router.get("/users", response_model=list[UserOut])
async def list_users(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    q = select(User).order_by(User.created_at.desc())
    if not admin.is_super_admin:
        q = q.where(User.tenant_id == admin.tenant_id)
    result = await db.execute(q)
    return [UserOut.model_validate(u) for u in result.scalars().all()]
