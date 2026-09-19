"""App-wide settings persisted in DB. Cached in memory for zero-race reads.

Usage:
  await load_settings_cache()          # on startup
  get('fiscal_mode', 'classic')        # sync read
  await set_setting(db, 'fiscal_mode', 'reforma')  # write-through
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Setting

_CACHE: dict[str, str] = {}


def get(key: str, default: str | None = None) -> str | None:
    return _CACHE.get(key, default)


async def load_settings_cache():
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(Setting))).scalars().all()
        _CACHE.clear()
        for r in rows:
            _CACHE[r.key] = r.value


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    row = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
    if row is None:
        row = Setting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    await db.commit()
    _CACHE[key] = value
