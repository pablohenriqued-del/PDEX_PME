"""Seed initial data: admin, seller, sample products, sample lead."""
import os
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models import User, Product, Lead
from auth import hash_password, verify_password


async def seed_users(db: AsyncSession):
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    admin_name = os.environ.get("ADMIN_NAME", "Admin")

    result = await db.execute(select(User).where(User.email == admin_email))
    admin = result.scalar_one_or_none()
    if admin is None:
        admin = User(email=admin_email, password_hash=hash_password(admin_password),
                     name=admin_name, role="admin")
        db.add(admin)
    else:
        if not verify_password(admin_password, admin.password_hash):
            admin.password_hash = hash_password(admin_password)
        admin.role = "admin"
        admin.is_active = True

    seller_email = os.environ.get("SELLER_EMAIL", "vendedor@nexuserp.com").lower()
    seller_password = os.environ.get("SELLER_PASSWORD", "Vendedor@2026")
    result = await db.execute(select(User).where(User.email == seller_email))
    seller = result.scalar_one_or_none()
    if seller is None:
        seller = User(email=seller_email, password_hash=hash_password(seller_password),
                      name="Vendedor Demo", role="vendedor")
        db.add(seller)
    else:
        if not verify_password(seller_password, seller.password_hash):
            seller.password_hash = hash_password(seller_password)

    await db.commit()
    return admin, seller


async def seed_products(db: AsyncSession):
    result = await db.execute(select(Product))
    if result.first():
        return
    demos = [
        Product(sku="PRD-001", name="Notebook Pro 14", type="product", unit="UN",
                price=Decimal("6499.00"), cost=Decimal("4200.00"), stock=15, ncm="84713012"),
        Product(sku="PRD-002", name="Monitor UltraWide 34\"", type="product", unit="UN",
                price=Decimal("2899.00"), cost=Decimal("1900.00"), stock=8, ncm="85285210"),
        Product(sku="PRD-003", name="Cadeira Ergonômica Premium", type="product", unit="UN",
                price=Decimal("1499.00"), cost=Decimal("890.00"), stock=22, ncm="94013000"),
        Product(sku="SVC-001", name="Consultoria de Implantação ERP (hora)", type="service", unit="H",
                price=Decimal("350.00"), cost=Decimal("120.00"), stock=999),
        Product(sku="SVC-002", name="Treinamento de Equipe (turma)", type="service", unit="UN",
                price=Decimal("2500.00"), cost=Decimal("800.00"), stock=999),
    ]
    for p in demos:
        db.add(p)
    await db.commit()


async def seed_sample_lead(db: AsyncSession, seller_id: str):
    result = await db.execute(select(Lead))
    if result.first():
        return
    lead = Lead(
        name="João Silva - Mercearia Bom Preço",
        phone="5511999887766",
        email="joao@bompreco.com.br",
        company="Mercearia Bom Preço",
        source="WhatsApp",
        status="novo",
        value=Decimal("15000.00"),
        notes="Interessado em automatizar controle de estoque e emissão de NFe.",
        owner_id=seller_id,
    )
    db.add(lead)
    await db.commit()


async def run_seed():
    async with AsyncSessionLocal() as db:
        _, seller = await seed_users(db)
        await seed_products(db)
        if seller:
            await seed_sample_lead(db, seller.id)
