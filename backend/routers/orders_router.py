from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Order, OrderItem, Product, Customer, User, Payment, Invoice, InvoiceTax
from auth import get_current_user, is_admin
from schemas import OrderIn, OrderOut, OrderItemIn, PaymentIn, PaymentOut, InvoiceOut
from fiscal import calculate_taxes, issue_invoice

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _scope(query, current: User):
    if current.tenant_id:
        query = query.where(Order.tenant_id == current.tenant_id)
    if not is_admin(current):
        query = query.where(Order.seller_id == current.id)
    return query


async def _recalc(order: Order, db: AsyncSession):
    total = Decimal("0")
    for it in order.items:
        it.subtotal = (it.quantity * it.unit_price).quantize(Decimal("0.01"))
        total += it.subtotal
    order.total_gross = total.quantize(Decimal("0.01"))
    order.total_net = order.total_gross - order.total_taxes


@router.get("", response_model=list[OrderOut])
async def list_orders(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc()), current)
    return [OrderOut.model_validate(o) for o in (await db.execute(q)).scalars().all()]


@router.post("", response_model=OrderOut)
async def create_order(payload: OrderIn, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    customer = (await db.execute(select(Customer).where(Customer.id == payload.customer_id))).scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=400, detail="Cliente inválido")
    if current.tenant_id and customer.tenant_id and customer.tenant_id != current.tenant_id:
        raise HTTPException(status_code=403, detail="Cliente pertence a outro tenant")
    seller_id = payload.seller_id if (payload.seller_id and is_admin(current)) else current.id
    order = Order(
        customer_id=payload.customer_id,
        seller_id=seller_id,
        lead_id=payload.lead_id,
        notes=payload.notes,
        tenant_id=current.tenant_id,
    )
    db.add(order)
    await db.flush()

    for i in payload.items:
        prod = (await db.execute(select(Product).where(Product.id == i.product_id))).scalar_one_or_none()
        if not prod:
            raise HTTPException(status_code=400, detail=f"Produto {i.product_id} inválido")
        unit = i.unit_price if i.unit_price is not None else prod.price
        item = OrderItem(
            order_id=order.id, product_id=prod.id, description=i.description or prod.name,
            quantity=i.quantity, unit_price=unit, subtotal=(i.quantity * unit).quantize(Decimal("0.01")),
            type=prod.type,
        )
        db.add(item)
    await db.flush()
    await db.refresh(order, ["items"])
    await _recalc(order, db)
    await db.commit()
    q = select(Order).options(selectinload(Order.items)).where(Order.id == order.id)
    o = (await db.execute(q)).scalar_one()
    return OrderOut.model_validate(o)


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Order).options(selectinload(Order.items)).where(Order.id == order_id), current)
    o = (await db.execute(q)).scalar_one_or_none()
    if not o:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return OrderOut.model_validate(o)


@router.post("/{order_id}/items", response_model=OrderOut)
async def add_item(order_id: str, item: OrderItemIn, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Order).options(selectinload(Order.items)).where(Order.id == order_id), current)
    order = (await db.execute(q)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if order.status == "invoiced":
        raise HTTPException(status_code=400, detail="Pedido já faturado — cancele a nota para editar itens")
    prod = (await db.execute(select(Product).where(Product.id == item.product_id))).scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=400, detail="Produto inválido")
    unit = item.unit_price if item.unit_price is not None else prod.price
    oi = OrderItem(order_id=order.id, product_id=prod.id, description=item.description or prod.name,
                   quantity=item.quantity, unit_price=unit,
                   subtotal=(item.quantity * unit).quantize(Decimal("0.01")), type=prod.type)
    db.add(oi)
    await db.flush()
    await db.refresh(order, ["items"])
    await _recalc(order, db)
    await db.commit()
    o = (await db.execute(q)).scalar_one()
    return OrderOut.model_validate(o)


@router.delete("/{order_id}/items/{item_id}", response_model=OrderOut)
async def remove_item(order_id: str, item_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Order).options(selectinload(Order.items)).where(Order.id == order_id), current)
    order = (await db.execute(q)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if order.status == "invoiced":
        raise HTTPException(status_code=400, detail="Pedido já faturado — cancele a nota para editar itens")
    it = (await db.execute(select(OrderItem).where(OrderItem.id == item_id, OrderItem.order_id == order_id))).scalar_one_or_none()
    if not it:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    await db.delete(it)
    await db.flush()
    await db.refresh(order, ["items"])
    await _recalc(order, db)
    await db.commit()
    o = (await db.execute(q)).scalar_one()
    return OrderOut.model_validate(o)


# --- Payments ---
@router.get("/{order_id}/payments", response_model=list[PaymentOut])
async def list_payments(order_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Order).where(Order.id == order_id), current)
    if not (await db.execute(q)).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    ps = (await db.execute(select(Payment).where(Payment.order_id == order_id).order_by(Payment.created_at))).scalars().all()
    return [PaymentOut.model_validate(p) for p in ps]


@router.post("/{order_id}/payments", response_model=PaymentOut)
async def add_payment(order_id: str, payload: PaymentIn, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Order).where(Order.id == order_id), current)
    order = (await db.execute(q)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    p = Payment(order_id=order_id, method=payload.method, amount=payload.amount, due_date=payload.due_date)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return PaymentOut.model_validate(p)


@router.post("/{order_id}/payments/{payment_id}/mark_paid", response_model=PaymentOut)
async def mark_paid(order_id: str, payment_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Order).where(Order.id == order_id), current)
    order = (await db.execute(q)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    p = (await db.execute(select(Payment).where(Payment.id == payment_id, Payment.order_id == order_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if p.status == "paid":
        return PaymentOut.model_validate(p)
    now = datetime.now(timezone.utc)
    p.status = "paid"
    p.paid_at = now

    # Auto-create commission for the seller based on active goal for the month
    from models import SalesGoal, Commission
    if order.seller_id:
        month_key = now.strftime("%Y-%m")
        goal = (await db.execute(
            select(SalesGoal).where(SalesGoal.user_id == order.seller_id, SalesGoal.month == month_key)
        )).scalar_one_or_none()
        rate = goal.commission_rate if goal else Decimal("0.05")
        amount = (Decimal(p.amount) * Decimal(rate)).quantize(Decimal("0.01"))
        db.add(Commission(
            user_id=order.seller_id, order_id=order.id, payment_id=p.id,
            base_amount=p.amount, rate=rate, amount=amount, status="accrued", month=month_key,
        ))

    await db.commit()
    await db.refresh(p)
    return PaymentOut.model_validate(p)


# --- Invoicing ---
@router.post("/{order_id}/invoice", response_model=InvoiceOut)
async def emit_invoice(order_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Order).options(selectinload(Order.items)).where(Order.id == order_id), current)
    order = (await db.execute(q)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if not order.items:
        raise HTTPException(status_code=400, detail="Pedido sem itens")

    has_service = any(i.type == "service" for i in order.items)
    has_product = any(i.type == "product" for i in order.items)
    invoice_type = "NFSE" if has_service and not has_product else "NFE"

    customer = (await db.execute(select(Customer).where(Customer.id == order.customer_id))).scalar_one()
    calc = calculate_taxes(order.total_gross, invoice_type, uf=customer.state)
    provider = issue_invoice(
        {
            "order_id": order.id,
            "customer": {"name": customer.name, "document": customer.document, "ibge": customer.ibge_code},
            "items": [{"description": i.description, "qty": float(i.quantity), "unit_price": float(i.unit_price)} for i in order.items],
            "total_gross": float(order.total_gross),
        },
        invoice_type,
    )

    inv = Invoice(
        order_id=order.id,
        type=invoice_type,
        number=provider["number"],
        series=provider["series"],
        access_key=provider["access_key"],
        status="issued",
        total_gross=order.total_gross,
        total_taxes=calc["total_taxes"],
        total_net=calc["total_net"],
        xml_url=provider["xml_url"],
        pdf_url=provider["pdf_url"],
        provider_payload=provider["provider_payload"],
    )
    db.add(inv)
    await db.flush()
    for t in calc["taxes"]:
        db.add(InvoiceTax(invoice_id=inv.id, tax_type=t["tax_type"], rate=t["rate"], base=t["base"], amount=t["amount"]))

    order.total_taxes = calc["total_taxes"]
    order.total_net = calc["total_net"]
    order.status = "invoiced"
    await db.commit()

    q2 = select(Invoice).options(selectinload(Invoice.taxes)).where(Invoice.id == inv.id)
    inv_full = (await db.execute(q2)).scalar_one()
    return InvoiceOut.model_validate(inv_full)


@router.get("/{order_id}/invoices", response_model=list[InvoiceOut])
async def list_order_invoices(order_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = _scope(select(Order).where(Order.id == order_id), current)
    if not (await db.execute(q)).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    invs = (await db.execute(select(Invoice).options(selectinload(Invoice.taxes)).where(Invoice.order_id == order_id))).scalars().all()
    return [InvoiceOut.model_validate(i) for i in invs]
