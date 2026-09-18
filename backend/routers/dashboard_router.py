from decimal import Decimal
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Order, Invoice, InvoiceTax, Payment, Customer, User, Lead
from auth import get_current_user, is_admin
from schemas import DashboardOut, KPIOut, MonthlyPoint, TaxBreakdownPoint, ReceivableOut

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
async def dashboard(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    orders_q = select(Order).options(selectinload(Order.invoices).selectinload(Invoice.taxes))
    if not is_admin(current):
        orders_q = orders_q.where(Order.seller_id == current.id)
    orders = (await db.execute(orders_q)).scalars().all()

    revenue_gross = Decimal("0")
    revenue_net = Decimal("0")
    total_taxes = Decimal("0")
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

    # Ensure last 6 months keys exist
    now = datetime.now(timezone.utc)
    for i in range(5, -1, -1):
        m = (now.replace(day=1) - timedelta(days=30 * i)).strftime("%Y-%m")
        _ = monthly[m]
    monthly_sorted = sorted(monthly.items())[-6:]

    # Receivables
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
        monthly=[MonthlyPoint(month=m, gross=v["gross"], net=v["net"], taxes=v["taxes"]) for m, v in monthly_sorted],
        tax_breakdown=[TaxBreakdownPoint(tax_type=k, amount=v) for k, v in tax_breakdown.items()],
        receivables=receivables,
    )
