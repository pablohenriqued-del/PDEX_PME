import io
import csv
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Invoice, InvoiceTax, Order, Customer, User
from auth import get_current_user, is_admin, is_contador

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/invoices.csv")
async def export_invoices_csv(month: str | None = Query(None), current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Export all issued invoices as CSV for the accountant. Format: OFX-friendly, semicolon-separated, UTF-8 BOM."""
    q = (
        select(Invoice)
        .options(selectinload(Invoice.taxes), selectinload(Invoice.order).selectinload(Order.items))
        .where(Invoice.status == "issued")
        .order_by(Invoice.issued_at.desc())
    )
    invoices = (await db.execute(q)).scalars().all()

    # Filter by month if provided
    if month:
        invoices = [i for i in invoices if i.issued_at.strftime("%Y-%m") == month]

    # Scoping: admin AND contador see all; vendedor scoped to own
    if not is_admin(current) and not is_contador(current):
        invoices = [i for i in invoices if i.order and i.order.seller_id == current.id]

    # Gather all customers in one query
    cust_ids = {i.order.customer_id for i in invoices if i.order}
    customers = {}
    if cust_ids:
        rows = (await db.execute(select(Customer).where(Customer.id.in_(cust_ids)))).scalars().all()
        customers = {c.id: c for c in rows}

    buf = io.StringIO()
    buf.write("\ufeff")  # UTF-8 BOM (Excel PT-BR friendly)
    writer = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "Emitida em", "Pedido", "Tipo", "Numero", "Serie", "Chave de Acesso",
        "Cliente", "CPF/CNPJ", "UF", "Total Bruto", "Total Tributos", "Total Liquido",
        "ICMS", "PIS", "COFINS", "ISS", "IPI",
    ])
    for inv in invoices:
        tax_by = {t.tax_type: float(t.amount) for t in inv.taxes}
        cust = customers.get(inv.order.customer_id) if inv.order else None
        writer.writerow([
            inv.issued_at.strftime("%d/%m/%Y %H:%M"),
            inv.order.number if inv.order else "",
            inv.type,
            inv.number or "",
            inv.series or "",
            inv.access_key or "",
            cust.name if cust else "",
            cust.document if cust else "",
            (cust.state if cust else "") or "",
            f"{float(inv.total_gross):.2f}".replace(".", ","),
            f"{float(inv.total_taxes):.2f}".replace(".", ","),
            f"{float(inv.total_net):.2f}".replace(".", ","),
            f"{tax_by.get('ICMS', 0):.2f}".replace(".", ","),
            f"{tax_by.get('PIS', 0):.2f}".replace(".", ","),
            f"{tax_by.get('COFINS', 0):.2f}".replace(".", ","),
            f"{tax_by.get('ISS', 0):.2f}".replace(".", ","),
            f"{tax_by.get('IPI', 0):.2f}".replace(".", ","),
        ])
    buf.seek(0)
    filename = f"notas_fiscais_{month or datetime.now().strftime('%Y-%m')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/summary")
async def report_summary(month: str | None = Query(None), current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Monthly summary of issued invoices — used for accountant preview."""
    q = select(Invoice).options(selectinload(Invoice.taxes), selectinload(Invoice.order)).where(Invoice.status == "issued")
    invs = (await db.execute(q)).scalars().all()
    if month:
        invs = [i for i in invs if i.issued_at.strftime("%Y-%m") == month]
    if not is_admin(current) and not is_contador(current):
        invs = [i for i in invs if i.order and i.order.seller_id == current.id]

    by_type = {}
    tax_totals = {}
    total_gross = total_taxes = total_net = 0.0
    for i in invs:
        by_type[i.type] = by_type.get(i.type, 0) + 1
        total_gross += float(i.total_gross)
        total_taxes += float(i.total_taxes)
        total_net += float(i.total_net)
        for t in i.taxes:
            tax_totals[t.tax_type] = tax_totals.get(t.tax_type, 0) + float(t.amount)

    return {
        "count": len(invs),
        "by_type": by_type,
        "total_gross": round(total_gross, 2),
        "total_taxes": round(total_taxes, 2),
        "total_net": round(total_net, 2),
        "tax_totals": {k: round(v, 2) for k, v in tax_totals.items()},
    }



@router.get("/sped.txt")
async def export_sped(month: str = Query(None), block: str = Query("C", description="C=Fiscal (ICMS/IPI), M=Contribuições (PIS/COFINS)"),
                      current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """SPED simplified layout — pipe-delimited records ready for the accountant's software."""
    q = (
        select(Invoice)
        .options(selectinload(Invoice.taxes), selectinload(Invoice.order).selectinload(Order.items))
        .where(Invoice.status == "issued")
        .order_by(Invoice.issued_at)
    )
    invoices = (await db.execute(q)).scalars().all()

    if month:
        invoices = [i for i in invoices if i.issued_at.strftime("%Y-%m") == month]
    if not is_admin(current) and not is_contador(current):
        invoices = [i for i in invoices if i.order and i.order.seller_id == current.id]

    cust_ids = {i.order.customer_id for i in invoices if i.order}
    customers = {}
    if cust_ids:
        rows = (await db.execute(select(Customer).where(Customer.id.in_(cust_ids)))).scalars().all()
        customers = {c.id: c for c in rows}

    lines: list[str] = []
    period = month or (invoices[0].issued_at.strftime("%Y-%m") if invoices else datetime.now().strftime("%Y-%m"))
    period_start = period + "-01"
    lines.append(f"|0000|{period_start.replace('-','')}|{period.replace('-','')}28|00000000000000|PDEX ERP|")
    lines.append("|0001|0|")

    if block.upper() == "C":
        lines.append("|C001|0|")
        for inv in invoices:
            cust = customers.get(inv.order.customer_id) if inv.order else None
            tax_by = {t.tax_type: float(t.amount) for t in inv.taxes}
            mod = "55" if inv.type == "NFE" else "SE"
            doc = (cust.document or "").replace(".", "").replace("-", "").replace("/", "") if cust else ""
            lines.append(
                f"|C100|1|1|{doc}|{mod}|00|{inv.series or '1'}|{inv.number or ''}|{inv.access_key or ''}"
                f"|{inv.issued_at.strftime('%d%m%Y')}|{float(inv.total_gross):.2f}|{tax_by.get('ICMS', 0):.2f}|{tax_by.get('IPI', 0):.2f}|"
            )
            for idx, it in enumerate(inv.order.items if inv.order else [], start=1):
                lines.append(
                    f"|C170|{idx:03d}|{it.product_id[:10]}|{(it.description or '')[:60]}"
                    f"|{float(it.quantity):.3f}|UN|{float(it.subtotal):.2f}|"
                )
        lines.append(f"|C990|{len(invoices) + 2}|")
    else:
        lines.append("|M001|0|")
        for inv in invoices:
            tax_by = {t.tax_type: float(t.amount) for t in inv.taxes}
            rate_by = {t.tax_type: float(t.rate) for t in inv.taxes}
            if tax_by.get("PIS"):
                lines.append(f"|M100|{float(inv.total_gross):.2f}|{rate_by.get('PIS', 0) * 100:.2f}|{tax_by['PIS']:.2f}|")
            if tax_by.get("COFINS"):
                lines.append(f"|M500|{float(inv.total_gross):.2f}|{rate_by.get('COFINS', 0) * 100:.2f}|{tax_by['COFINS']:.2f}|")
        lines.append(f"|M990|{len(invoices) * 2 + 2}|")

    lines.append(f"|9999|{len(lines) + 1}|")
    content = "\n".join(lines) + "\n"
    filename = f"sped_{block.upper()}_{period}.txt"
    return PlainTextResponse(
        content, media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
