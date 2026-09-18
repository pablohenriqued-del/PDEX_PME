from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import SalesGoal, Commission, User, Order, Payment
from auth import get_current_user, require_admin, is_admin
from schemas import SalesGoalIn, SalesGoalUpdate, SalesGoalOut, GoalProgressOut, CommissionOut

router = APIRouter(prefix="/api/goals", tags=["goals"])


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


@router.get("", response_model=list[SalesGoalOut])
async def list_goals(month: str | None = Query(None), current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(SalesGoal)
    if month:
        q = q.where(SalesGoal.month == month)
    if not is_admin(current):
        q = q.where(SalesGoal.user_id == current.id)
    q = q.order_by(SalesGoal.month.desc())
    return [SalesGoalOut.model_validate(g) for g in (await db.execute(q)).scalars().all()]


@router.post("", response_model=SalesGoalOut)
async def create_goal(payload: SalesGoalIn, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(SalesGoal).where(SalesGoal.user_id == payload.user_id, SalesGoal.month == payload.month)
    )).scalar_one_or_none()
    if existing:
        existing.target_amount = payload.target_amount
        existing.commission_rate = payload.commission_rate
        await db.commit()
        await db.refresh(existing)
        return SalesGoalOut.model_validate(existing)
    g = SalesGoal(**payload.model_dump())
    db.add(g)
    await db.commit()
    await db.refresh(g)
    return SalesGoalOut.model_validate(g)


@router.patch("/{goal_id}", response_model=SalesGoalOut)
async def update_goal(goal_id: str, payload: SalesGoalUpdate, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    g = (await db.execute(select(SalesGoal).where(SalesGoal.id == goal_id))).scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(g, k, v)
    await db.commit()
    await db.refresh(g)
    return SalesGoalOut.model_validate(g)


@router.delete("/{goal_id}")
async def delete_goal(goal_id: str, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    g = (await db.execute(select(SalesGoal).where(SalesGoal.id == goal_id))).scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    await db.delete(g)
    await db.commit()
    return {"ok": True}


@router.get("/progress", response_model=list[GoalProgressOut])
async def goal_progress(month: str = Query(default_factory=_current_month),
                        current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    users_q = select(User).where(User.role == "vendedor")
    if not is_admin(current):
        users_q = users_q.where(User.id == current.id)
    users = (await db.execute(users_q)).scalars().all()

    out = []
    for u in users:
        goal = (await db.execute(
            select(SalesGoal).where(SalesGoal.user_id == u.id, SalesGoal.month == month)
        )).scalar_one_or_none()
        target = Decimal(goal.target_amount) if goal else Decimal("0")
        rate = Decimal(goal.commission_rate) if goal else Decimal("0.05")

        # Achieved = sum of PAID payments in the month for orders owned by this seller
        month_start = datetime.strptime(month + "-01", "%Y-%m-%d").replace(tzinfo=timezone.utc)
        # last day of month: add 32 days then reset to day 1 then back 1 microsecond
        next_month_year, next_month_month = month_start.year, month_start.month + 1
        if next_month_month > 12:
            next_month_month = 1; next_month_year += 1
        month_end = datetime(next_month_year, next_month_month, 1, tzinfo=timezone.utc)

        achieved_q = (
            select(func.coalesce(func.sum(Payment.amount), 0))
            .join(Order, Order.id == Payment.order_id)
            .where(Order.seller_id == u.id, Payment.status == "paid",
                   Payment.paid_at >= month_start, Payment.paid_at < month_end)
        )
        achieved = Decimal((await db.execute(achieved_q)).scalar() or 0)

        # Commission accrued this month
        comm_q = (
            select(func.coalesce(func.sum(Commission.amount), 0))
            .where(Commission.user_id == u.id, Commission.month == month)
        )
        commission = Decimal((await db.execute(comm_q)).scalar() or 0)

        progress = (achieved / target * 100).quantize(Decimal("0.01")) if target > 0 else Decimal("0")
        out.append(GoalProgressOut(
            user_id=u.id, user_name=u.name, month=month,
            target_amount=target, achieved_amount=achieved.quantize(Decimal("0.01")),
            progress_pct=progress, commission_accrued=commission.quantize(Decimal("0.01")),
            commission_rate=rate,
        ))
    return out


@router.get("/commissions", response_model=list[CommissionOut])
async def list_commissions(month: str | None = Query(None), current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Commission).order_by(Commission.created_at.desc())
    if month:
        q = q.where(Commission.month == month)
    if not is_admin(current):
        q = q.where(Commission.user_id == current.id)
    return [CommissionOut.model_validate(c) for c in (await db.execute(q)).scalars().all()]


@router.post("/commissions/{commission_id}/mark_paid", response_model=CommissionOut)
async def mark_commission_paid(commission_id: str, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Commission).where(Commission.id == commission_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Comissão não encontrada")
    c.status = "paid"
    await db.commit()
    await db.refresh(c)
    return CommissionOut.model_validate(c)
