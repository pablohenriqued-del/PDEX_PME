from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Product, User
from auth import get_current_user, require_admin
from schemas import ProductIn, ProductOut

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
async def list_products(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Product).order_by(Product.created_at.desc())
    if current.tenant_id:
        q = q.where(Product.tenant_id == current.tenant_id)
    result = await db.execute(q)
    return [ProductOut.model_validate(p) for p in result.scalars().all()]


@router.post("", response_model=ProductOut)
async def create_product(payload: ProductIn, current: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    p = Product(**payload.model_dump(), tenant_id=current.tenant_id)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return ProductOut.model_validate(p)


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(product_id: str, payload: ProductIn, current: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    q = select(Product).where(Product.id == product_id)
    if current.tenant_id:
        q = q.where(Product.tenant_id == current.tenant_id)
    p = (await db.execute(q)).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    for k, v in payload.model_dump().items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return ProductOut.model_validate(p)


@router.delete("/{product_id}")
async def delete_product(product_id: str, current: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    q = select(Product).where(Product.id == product_id)
    if current.tenant_id:
        q = q.where(Product.tenant_id == current.tenant_id)
    p = (await db.execute(q)).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    await db.delete(p)
    await db.commit()
    return {"ok": True}
