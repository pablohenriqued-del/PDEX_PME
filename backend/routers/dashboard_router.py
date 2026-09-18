from decimal import Decimal
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Order, Invoice, InvoiceTax, Payment, Customer, User, Lead, SalesGoal, Commission
from auth import get_current_user, is_admin
from fastapi import HTTPException
from schemas import (
    DashboardOut, KPIOut, MonthlyPoint, TaxBreakdownPoint, ReceivableOut,
    TeamRankingItem, FiscalRegimeOut,
)
from fiscal import current_mode, cbs_rate, ibs_rate_for

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _last_6_months(now: datetime) -> list[str]:
    y, m = now.year, now.month
    out = []
    for _ in range(6):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12; y -= 1
    return list(reversed(out))


@router.get("", response_model=DashboardOut)
async def dashboard(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    orders_q = select(Order).options(selectinload(Order.invoices).selectinload(Invoice.taxes))
    if not is_admin(current):
        orders_q = orders_q.where(Order.seller_id == current.id)
    orders = (await db.execute(orders_q)).scalars().all()

    revenue_gross = Decimal("0"); revenue_net = Decimal("0"); total_taxes = Decimal("0")
    monthly = defaultdict(lambda: {"gross": Decimal("0"), "net": Decimal("0"), "taxes": Decimal("0")})
    tax_breakdown = defaultdict(lambda: Decimal("0"))

    for o in orders:
        for inv in o.invoices:
            if inv.status != "issued":
                continue
            revenue_gross += inv.total_gross
            revenue_net += inv.total_net
            total_taxes += inv.total_taxes
            key = inv.issued_at.strftime("%Y-%m")
            monthly[key]["gross"] += inv.total_gross
            monthly[key]["net"] += inv.total_net
            monthly[key]["taxes"] += inv.total_taxes
            for t in inv.taxes:
                tax_breakdown[t.tax_type] += t.amount

    now = datetime.now(timezone.utc)
    six_months = _last_6_months(now)
    for m in six_months:
        _ = monthly[m]
    monthly_ordered = [(m, monthly[m]) for m in six_months]

    pay_q = select(Payment).options(selectinload(Payment.order)).where(Payment.status == "pending")
    payments = (await db.execute(pay_q)).scalars().all()
    receivables = []
    receivables_total = Decimal("0")
    for p in payments:
        if not is_admin(current) and p.order.seller_id != current.id:
            continue
        cust = (await db.execute(select(Customer).where(Customer.id == p.order.customer_id))).scalar_one_or_none()
        receivables.append(ReceivableOut(
            payment_id=p.id, order_number=p.order.number,
            customer_name=cust.name if cust else "-", method=p.method,
            amount=p.amount, due_date=p.due_date,
        ))
        receivables_total += p.amount

    leads_q = select(func.count(Lead.id)).where(Lead.status.not_in(["ganho", "perdido"]))
    if not is_admin(current):
        leads_q = leads_q.where(Lead.owner_id == current.id)
    leads_open = (await db.execute(leads_q)).scalar_one()

    kpis = KPIOut(
        revenue_gross=revenue_gross, revenue_net=revenue_net,
        total_taxes=total_taxes, orders_count=len(orders),
        leads_open=leads_open, receivables=receivables_total,
    )
    return DashboardOut(
        kpis=kpis,
        monthly=[MonthlyPoint(month=m, gross=v["gross"], net=v["net"], taxes=v["taxes"]) for m, v in monthly_ordered],
        tax_breakdown=[TaxBreakdownPoint(tax_type=k, amount=v) for k, v in tax_breakdown.items()],
        receivables=receivables,
    )


@router.get("/team_ranking", response_model=list[TeamRankingItem])
async def team_ranking(month: str | None = None, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Company-wide seller ranking by achieved amount in a given month (defaults to current)."""
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
    month_start = datetime.strptime(month + "-01", "%Y-%m-%d").replace(tzinfo=timezone.utc)
    next_y, next_m = month_start.year, month_start.month + 1
    if next_m > 12: next_m = 1; next_y += 1
    month_end = datetime(next_y, next_m, 1, tzinfo=timezone.utc)

    sellers = (await db.execute(select(User).where(User.role == "vendedor"))).scalars().all()
    items = []
    for u in sellers:
        # Achieved
        ach_q = (
            select(func.coalesce(func.sum(Payment.amount), 0), func.count(func.distinct(Payment.order_id)))
            .join(Order, Order.id == Payment.order_id)
            .where(Order.seller_id == u.id, Payment.status == "paid",
                   Payment.paid_at >= month_start, Payment.paid_at < month_end)
        )
        ach_row = (await db.execute(ach_q)).one()
        achieved = Decimal(ach_row[0] or 0).quantize(Decimal("0.01"))
        orders_count = int(ach_row[1] or 0)

        # Commissions
        com_q = select(func.coalesce(func.sum(Commission.amount), 0)).where(
            Commission.user_id == u.id, Commission.month == month
        )
        commission = Decimal((await db.execute(com_q)).scalar() or 0).quantize(Decimal("0.01"))

        items.append({"user_id": u.id, "user_name": u.name,
                      "achieved_amount": achieved, "orders_count": orders_count,
                      "commission_accrued": commission})

    items.sort(key=lambda x: x["achieved_amount"], reverse=True)
    return [TeamRankingItem(**it, rank=i + 1) for i, it in enumerate(items)]


@router.get("/company_goal")
async def company_goal(month: str | None = None, _: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
    goals = (await db.execute(select(SalesGoal).where(SalesGoal.month == month))).scalars().all()
    company_target = sum((Decimal(g.target_amount) for g in goals), Decimal("0"))

    month_start = datetime.strptime(month + "-01", "%Y-%m-%d").replace(tzinfo=timezone.utc)
    next_y, next_m = month_start.year, month_start.month + 1
    if next_m > 12: next_m = 1; next_y += 1
    month_end = datetime(next_y, next_m, 1, tzinfo=timezone.utc)

    ach_q = (
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.status == "paid", Payment.paid_at >= month_start, Payment.paid_at < month_end)
    )
    company_achieved = Decimal((await db.execute(ach_q)).scalar() or 0).quantize(Decimal("0.01"))
    pct = (company_achieved / company_target * 100).quantize(Decimal("0.01")) if company_target > 0 else Decimal("0")
    return {"month": month, "target": company_target, "achieved": company_achieved, "progress_pct": pct}


@router.post("/fiscal_regime")
async def set_fiscal_regime(mode: str, _: User = Depends(get_current_user)):
    """Runtime switch (admin) — updates env var. Persist in .env for durability."""
    if mode not in ("classic", "hybrid", "reforma"):
        raise HTTPException(status_code=400, detail="Modo inválido")
    import os
    os.environ["FISCAL_MODE"] = mode
    return {"mode": mode, "note": "Runtime mode changed. Update .env FISCAL_MODE to persist across restarts."}


@router.get("/fiscal_regime", response_model=FiscalRegimeOut)
async def fiscal_regime(_: User = Depends(get_current_user)):
    mode = current_mode()
    labels = {
        "classic": "Pré-reforma (ICMS/PIS/COFINS/ISS/IPI)",
        "hybrid": "Transição 2027-2032 (Classic 50% + Reforma 50%)",
        "reforma": "Reforma 2027+ (CBS + IBS)",
    }
    descriptions = {
        "classic": "Regime atual, mantido até o fim de 2026. Todos os cinco tributos em vigor.",
        "hybrid": "Fase de transição gradual: alíquotas antigas reduzidas + IBS/CBS crescente conforme cronograma LC 214/2025.",
        "reforma": "Novo IVA dual: CBS federal ~8,8% + IBS estadual/municipal ~17,7%. Simplificação total.",
    }
    return FiscalRegimeOut(
        mode=mode, label=labels.get(mode, mode),
        cbs_rate=cbs_rate(), ibs_rate=ibs_rate_for(None),
        description=descriptions.get(mode, ""),
    )
