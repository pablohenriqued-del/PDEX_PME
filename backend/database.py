"""Async SQLAlchemy engine + session helpers for Postgres."""
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=10, max_overflow=20)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Create all tables. Import models to register them."""
    import models  # noqa: F401
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Ensure orders.number has a proper Postgres sequence attached (fixes autoincrement no-op)
        await conn.execute(text("CREATE SEQUENCE IF NOT EXISTS orders_number_seq START 1"))
        await conn.execute(text("ALTER TABLE orders ALTER COLUMN number SET DEFAULT nextval('orders_number_seq')"))
        await conn.execute(text(
            "SELECT setval('orders_number_seq', COALESCE((SELECT MAX(number) FROM orders), 0) + 1, false)"
        ))
