"""Seed rich demo data with CONSISTENT math: order subtotals = qty*price,
gross = sum(subtotals), invoice taxes = gross*rate (per UF), commissions = payment*rate.
Every derived number is computed, nothing hardcoded to fake values.
"""
import os
import random
import hashlib
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models import (
    User, Tenant, Product, Lead, LeadMessage, Channel, SalesGoal, Customer,
    Order, OrderItem, Payment, Invoice, InvoiceTax, Commission, Inventory,
)
from auth import hash_password, verify_password
from fiscal import calculate_taxes


DEFAULT_TENANT_SLUG = "pdex-master"
DEFAULT_TENANT_NAME = "PDEX Master"


async def seed_default_tenant(db: AsyncSession) -> Tenant:
    """Create the default tenant, backfill users, then propagate tenant_id
    across leads/customers/orders/products so multi-tenant isolation kicks in
    without losing legacy data.
    """
    from sqlalchemy import text as _text
    t = (await db.execute(select(Tenant).where(Tenant.slug == DEFAULT_TENANT_SLUG))).scalar_one_or_none()
    if not t:
        t = Tenant(name=DEFAULT_TENANT_NAME, slug=DEFAULT_TENANT_SLUG, plan="business", onboarding_completed=True)
        db.add(t)
        await db.flush()
    else:
        # Existing PDEX Master is considered onboarded (seeded fully).
        t.onboarding_completed = True
    # Users: any without tenant → default
    unassigned = (await db.execute(select(User).where(User.tenant_id.is_(None)))).scalars().all()
    for u in unassigned:
        u.tenant_id = t.id
    await db.commit()

    # Propagate tenant_id from ownership joins (leads/customers via owner_id, orders via seller_id).
    await db.execute(_text(
        "UPDATE leads SET tenant_id = u.tenant_id FROM users u "
        "WHERE leads.owner_id = u.id AND leads.tenant_id IS NULL"
    ))
    await db.execute(_text(
        "UPDATE customers SET tenant_id = u.tenant_id FROM users u "
        "WHERE customers.owner_id = u.id AND customers.tenant_id IS NULL"
    ))
    await db.execute(_text(
        "UPDATE orders SET tenant_id = u.tenant_id FROM users u "
        "WHERE orders.seller_id = u.id AND orders.tenant_id IS NULL"
    ))
    # Orphans (no owner) + all products → default tenant.
    for tbl in ("leads", "customers", "orders", "products"):
        await db.execute(_text(
            f"UPDATE {tbl} SET tenant_id = :tid WHERE tenant_id IS NULL"
        ), {"tid": t.id})
    await db.commit()
    return t


VENDORS_DEMO = [
    ("ana@pdex.com.br", "Ana Ribeiro", "Ana@PDEX2026"),
    ("bruno@pdex.com.br", "Bruno Costa", "Bruno@PDEX2026"),
    ("carla@pdex.com.br", "Carla Menezes", "Carla@PDEX2026"),
]

# Migration map: rename any leftover @nexuserp.com accounts to @pdex.com.br
# and reset their password to the new PDEX scheme. Idempotent — no-op after
# the first successful boot.
LEGACY_EMAIL_MIGRATION = [
    # (legacy_email, new_email, new_password)
    ("vendedor@nexuserp.com", "vendedor@pdex.com.br", "Vendedor@PDEX2026"),
    ("contador@nexuserp.com", "contador@pdex.com.br", "Contador@PDEX2026"),
    ("ana@nexuserp.com", "ana@pdex.com.br", "Ana@PDEX2026"),
    ("bruno@nexuserp.com", "bruno@pdex.com.br", "Bruno@PDEX2026"),
    ("carla@nexuserp.com", "carla@pdex.com.br", "Carla@PDEX2026"),
]


async def migrate_legacy_pdex_emails(db: AsyncSession):
    """Rename @nexuserp.com legacy accounts to @pdex.com.br and re-hash to new passwords.
    Preserves ownership (leads/orders/goals) since we mutate the same row.
    """
    for legacy, new, pw in LEGACY_EMAIL_MIGRATION:
        legacy_user = (await db.execute(select(User).where(User.email == legacy))).scalar_one_or_none()
        new_user = (await db.execute(select(User).where(User.email == new))).scalar_one_or_none()
        if legacy_user and not new_user:
            legacy_user.email = new
            legacy_user.password_hash = hash_password(pw)
        elif legacy_user and new_user:
            # Both exist: keep the migrated one, drop the legacy row.
            await db.delete(legacy_user)
    await db.commit()


async def seed_users(db: AsyncSession):
    # First, migrate any stale @nexuserp.com identities from previous versions
    await migrate_legacy_pdex_emails(db)

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    admin_name = os.environ.get("ADMIN_NAME", "Admin")
    admin = (await db.execute(select(User).where(User.email == admin_email))).scalar_one_or_none()
    if admin is None:
        admin = User(email=admin_email, password_hash=hash_password(admin_password), name=admin_name, role="admin", is_super_admin=True)
        db.add(admin)
    else:
        if not verify_password(admin_password, admin.password_hash):
            admin.password_hash = hash_password(admin_password)
        admin.role = "admin"; admin.is_active = True; admin.is_super_admin = True

    seller_email = os.environ.get("SELLER_EMAIL", "vendedor@pdex.com.br").lower()
    seller_password = os.environ.get("SELLER_PASSWORD", "Vendedor@PDEX2026")
    seller = (await db.execute(select(User).where(User.email == seller_email))).scalar_one_or_none()
    if seller is None:
        seller = User(email=seller_email, password_hash=hash_password(seller_password), name="Vendedor Demo", role="vendedor")
        db.add(seller)
    else:
        if not verify_password(seller_password, seller.password_hash):
            seller.password_hash = hash_password(seller_password)

    # Contador (accountant, read-only fiscal)
    contador_email = "contador@pdex.com.br"
    contador_password = "Contador@PDEX2026"
    contador = (await db.execute(select(User).where(User.email == contador_email))).scalar_one_or_none()
    if contador is None:
        contador = User(email=contador_email, password_hash=hash_password(contador_password),
                        name="Contador Externo", role="contador")
        db.add(contador)
    else:
        if not verify_password(contador_password, contador.password_hash):
            contador.password_hash = hash_password(contador_password)
        contador.role = "contador"; contador.is_active = True

    extra_sellers = []
    for email, name, pw in VENDORS_DEMO:
        u = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if u is None:
            u = User(email=email, password_hash=hash_password(pw), name=name, role="vendedor")
            db.add(u)
        else:
            # Always re-hash to match spec (defensive against DB state drift / manual tampering)
            if not verify_password(pw, u.password_hash):
                u.password_hash = hash_password(pw)
            u.role = "vendedor"; u.is_active = True
        extra_sellers.append(u)

    await db.commit()
    return admin, seller, extra_sellers


async def seed_products(db: AsyncSession):
    if (await db.execute(select(Product))).first():
        return
    demos = [
        Product(sku="PRD-001", name="Notebook Pro 14", type="product", unit="UN",
                price=Decimal("6499.00"), cost=Decimal("4200.00"), stock=15, min_stock=5, ncm="84713012"),
        Product(sku="PRD-002", name="Monitor UltraWide 34\"", type="product", unit="UN",
                price=Decimal("2899.00"), cost=Decimal("1900.00"), stock=8, min_stock=4, ncm="85285210"),
        Product(sku="PRD-003", name="Cadeira Ergonômica Premium", type="product", unit="UN",
                price=Decimal("1499.00"), cost=Decimal("890.00"), stock=22, min_stock=8, ncm="94013000"),
        Product(sku="PRD-004", name="Teclado Mecânico RGB", type="product", unit="UN",
                price=Decimal("799.00"), cost=Decimal("380.00"), stock=40, min_stock=10, ncm="84716052"),
        Product(sku="PRD-005", name="Headset Bluetooth Pro", type="product", unit="UN",
                price=Decimal("549.00"), cost=Decimal("240.00"), stock=55, min_stock=15, ncm="85183000"),
        Product(sku="PRD-006", name="Impressora Multifuncional", type="product", unit="UN",
                price=Decimal("1899.00"), cost=Decimal("1200.00"), stock=6, min_stock=3, ncm="84433221"),
        Product(sku="SVC-001", name="Consultoria de Implantação ERP (hora)", type="service", unit="H",
                price=Decimal("350.00"), cost=Decimal("120.00"), stock=999),
        Product(sku="SVC-002", name="Treinamento de Equipe (turma)", type="service", unit="UN",
                price=Decimal("2500.00"), cost=Decimal("800.00"), stock=999),
        Product(sku="SVC-003", name="Suporte Técnico Mensal", type="service", unit="MES",
                price=Decimal("890.00"), cost=Decimal("300.00"), stock=999),
    ]
    for p in demos:
        db.add(p)
    await db.commit()


async def seed_channels(db: AsyncSession):
    if (await db.execute(select(Channel))).first():
        return
    for c in [
        Channel(name="Mercado Livre", type="marketplace", external_url="https://mercadolivre.com.br"),
        Channel(name="Shopee", type="marketplace", external_url="https://shopee.com.br"),
        Channel(name="Amazon Brasil", type="marketplace", external_url="https://amazon.com.br"),
        Channel(name="Magalu", type="marketplace", external_url="https://magazineluiza.com.br"),
        Channel(name="Loja Matriz SP", type="physical_store", external_url=None),
        Channel(name="Loja RJ Centro", type="physical_store", external_url=None),
        Channel(name="E-commerce Próprio", type="ecommerce", external_url=None),
    ]:
        db.add(c)
    await db.commit()


LEADS_DEMO = [
    # (name, company, phone, email, source, status, value, city, state, notes)
    ("João Silva", "Mercearia Bom Preço", "5511999887766", "joao@bompreco.com.br", "WhatsApp", "novo", 15000, "São Paulo", "SP", "Automatizar estoque e NFe."),
    ("Maria Souza", "Padaria Delícia", "5521988776655", "maria@padariadelicia.com.br", "WhatsApp", "novo", 8500, "Rio de Janeiro", "RJ", "Precisa emissão NFS-e."),
    ("Pedro Almeida", "Farmácia Vida Nova", "5531977665544", "pedro@vidanova.com.br", "Site", "novo", 22000, "Belo Horizonte", "MG", "Multi-loja, 3 unidades."),
    ("Camila Lima", "Boutique Elegance", "5561966554433", "camila@elegance.com.br", "Indicação", "contato", 12000, "Brasília", "DF", "Reunião marcada quinta."),
    ("Ricardo Nunes", "Auto Peças Nunes", "5541955443322", "ricardo@nunespecas.com.br", "WhatsApp", "contato", 45000, "Curitiba", "PR", "Já usa concorrente, insatisfeito."),
    ("Sandra Rocha", "Restaurante Sabor Norte", "5598944332211", "sandra@sabornorte.com.br", "WhatsApp", "qualificado", 18000, "São Luís", "MA", "Aprovação da matriz pendente."),
    ("Fernando Barbosa", "TechFix Assistência", "5511933221100", "fernando@techfix.com.br", "Site", "qualificado", 33000, "Campinas", "SP", "Pediu proposta detalhada."),
    ("Julia Ferraz", "Papelaria Bela Arte", "5521922110099", "julia@belaarte.com.br", "Manual", "qualificado", 9500, "Rio de Janeiro", "RJ", "Interessada, avaliando orçamento."),
    ("Luiz Otávio", "Distribuidora Sertão", "5581911009988", "luiz@sertao.com.br", "WhatsApp", "proposta", 68000, "Recife", "PE", "Proposta enviada 3 dias atrás."),
    ("Beatriz Cardoso", "Studio Bea Fotografia", "5511900998877", "bea@studiobea.com.br", "Site", "proposta", 7800, "São Paulo", "SP", "Aguardando retorno."),
    ("Diego Macedo", "Barbearia King", "5531899887766", "diego@king.com.br", "WhatsApp", "proposta", 4500, "Contagem", "MG", "Consulta em andamento."),
    ("Ana Paula", "Escola Sagrado Coração", "5541888776655", "anapaula@sagrado.edu.br", "Indicação", "ganho", 55000, "Londrina", "PR", "Contrato assinado!"),
    ("Roberto Tavares", "Construtora Alicerce", "5511877665544", "roberto@alicerce.com.br", "Site", "ganho", 120000, "Guarulhos", "SP", "Cliente premium, 12 meses."),
    ("Vanessa Melo", "Clínica OdontoMais", "5521866554433", "vanessa@odontomais.com.br", "WhatsApp", "ganho", 32000, "Niterói", "RJ", "Piloto de 6 meses."),
    ("Marcos Pinheiro", "Oficina do Marcos", "5598855443322", "marcos@oficinamarcos.com.br", "WhatsApp", "perdido", 6000, "São Luís", "MA", "Optou por concorrente mais barato."),
    ("Cristina Yamashita", "Sushi House", "5511844332211", "cris@sushihouse.com.br", "Site", "perdido", 15000, "São Paulo", "SP", "Vai postergar decisão para 2027."),
    ("Rodrigo Batista", "Ateliê Batista", "5561833221100", "rodrigo@ateliebatista.com.br", "Manual", "novo", 3200, "Brasília", "DF", "Solicitou demo."),
    ("Patrícia Duarte", "Livraria Página Aberta", "5541822110099", "patricia@paginaaberta.com.br", "Site", "contato", 14500, "Curitiba", "PR", "Retornar semana que vem."),
    ("Gustavo Henrique", "Studio Fitness GH", "5511811009988", "gustavo@ghfitness.com.br", "WhatsApp", "qualificado", 21000, "Osasco", "SP", "Interesse alto."),
    ("Larissa Freitas", "Salão Beleza Pura", "5521800998877", "larissa@belezapura.com.br", "Indicação", "proposta", 11800, "Rio de Janeiro", "RJ", "Comparando com 2 concorrentes."),
]


def _hash_ibge(city_state: str) -> str:
    h = hashlib.md5(city_state.encode()).hexdigest()[:7]
    return str(int(h, 16) % 9000000 + 1000000)


async def seed_leads_customers_orders(db: AsyncSession, sellers: list[User], admin: User):
    """Create rich sample: leads (all columns), customers, orders (with items, invoices, payments)."""
    if (await db.execute(select(Lead).where(Lead.email == "camila@elegance.com.br"))).first():
        return  # Idempotent

    # Distribute leads across sellers
    all_sellers = sellers
    now = datetime.now(timezone.utc)

    for i, (name, company, phone, email, source, status, value, city, state, notes) in enumerate(LEADS_DEMO):
        owner = all_sellers[i % len(all_sellers)]
        lead = Lead(
            name=name, company=company, phone=phone, email=email, source=source, status=status,
            value=Decimal(str(value)), notes=notes, owner_id=owner.id,
        )
        db.add(lead)
        await db.flush()
        # Add WhatsApp conversation for WhatsApp leads
        if source == "WhatsApp":
            db.add(LeadMessage(lead_id=lead.id, direction="in", channel="WhatsApp",
                               body=f"Olá! Vi seu anúncio e tenho interesse no PDEX. Sou da {company}.",
                               author=name, created_at=now - timedelta(days=3, hours=i)))
            db.add(LeadMessage(lead_id=lead.id, direction="out", channel="WhatsApp",
                               body=f"Oi {name.split()[0]}! Obrigado pelo contato. Posso agendar uma demo esta semana?",
                               author=owner.name, created_at=now - timedelta(days=3, hours=i - 1)))
            db.add(LeadMessage(lead_id=lead.id, direction="in", channel="WhatsApp",
                               body="Claro! Que tal quinta às 14h?", author=name,
                               created_at=now - timedelta(days=2, hours=i)))

    await db.commit()

    # Customers (WON leads become customers + a few PJ standalone)
    won_leads = (await db.execute(select(Lead).where(Lead.status == "ganho"))).scalars().all()
    customers: list[Customer] = []
    for lead in won_leads:
        # Find lead index to fetch city/state
        idx = next((i for i, r in enumerate(LEADS_DEMO) if r[1] == lead.company), 0)
        _, _, _, _, _, _, _, city, state, _ = LEADS_DEMO[idx]
        c = Customer(
            name=lead.company or lead.name,
            document=f"{random.randint(10, 99)}.{random.randint(100, 999)}.{random.randint(100, 999)}/0001-{random.randint(10, 99)}",
            person_type="PJ", email=lead.email, phone=lead.phone,
            city=city, state=state, ibge_code=_hash_ibge(f"{city}{state}"),
            lgpd_consent=True, lgpd_consent_at=now, owner_id=lead.owner_id,
        )
        db.add(c)
        await db.flush()
        lead.customer_id = c.id
        customers.append(c)

    # Standalone customers for variety across UFs
    extra_customers = [
        ("Comercial ABC SP", "PJ", "SP", "São Paulo"),
        ("Distribuidora Carioca", "PJ", "RJ", "Rio de Janeiro"),
        ("Serviços MG Ltda", "PJ", "MG", "Belo Horizonte"),
        ("Nordeste Comércio MA", "PJ", "MA", "São Luís"),
        ("Sul Supply PR", "PJ", "PR", "Curitiba"),
        ("Brasília Corp DF", "PJ", "DF", "Brasília"),
    ]
    for i, (name, ptype, state, city) in enumerate(extra_customers):
        owner = all_sellers[i % len(all_sellers)]
        c = Customer(
            name=name, document=f"{random.randint(10, 99)}.{random.randint(100, 999)}.{random.randint(100, 999)}/0001-{random.randint(10, 99)}",
            person_type=ptype, email=f"contato@{name.lower().replace(' ', '')}.com.br",
            phone=f"55{random.randint(10, 99)}9{random.randint(10000000, 99999999)}",
            city=city, state=state, ibge_code=_hash_ibge(city + state),
            lgpd_consent=True, lgpd_consent_at=now, owner_id=owner.id,
        )
        db.add(c)
        await db.flush()
        customers.append(c)
    await db.commit()

    # Products cache
    products = (await db.execute(select(Product))).scalars().all()
    prod_by_type = {"product": [p for p in products if p.type == "product"],
                    "service": [p for p in products if p.type == "service"]}

    # Sequence starting value — use current MAX+1 to avoid conflict
    from sqlalchemy import text
    await db.execute(text(
        "SELECT setval('orders_number_seq', COALESCE((SELECT MAX(number) FROM orders), 0) + 1, false)"
    ))

    # Create ORDERS with real math: subtotal=qty*price, gross=sum, taxes computed with fiscal, payments derived
    # Distribute orders over last 90 days across sellers
    order_specs = []
    random.seed(42)  # reproducible
    for i in range(20):
        cust = random.choice(customers)
        seller = next((s for s in all_sellers if s.id == cust.owner_id), all_sellers[0])
        days_ago = random.randint(0, 75)
        is_service_order = random.random() < 0.25
        pool = prod_by_type["service"] if is_service_order else prod_by_type["product"]
        items_spec = []
        for _ in range(random.randint(1, 3)):
            p = random.choice(pool)
            qty = Decimal(str(random.randint(1, 5)))
            items_spec.append((p, qty, p.price))
        order_specs.append((cust, seller, items_spec, days_ago, is_service_order))

    for cust, seller, items_spec, days_ago, is_svc in order_specs:
        created = now - timedelta(days=days_ago)
        order = Order(customer_id=cust.id, seller_id=seller.id, status="draft",
                      total_gross=Decimal("0"), total_taxes=Decimal("0"), total_net=Decimal("0"),
                      created_at=created)
        db.add(order)
        await db.flush()

        gross = Decimal("0")
        for prod, qty, unit in items_spec:
            subtotal = (qty * unit).quantize(Decimal("0.01"))
            db.add(OrderItem(order_id=order.id, product_id=prod.id, description=prod.name,
                             quantity=qty, unit_price=unit, subtotal=subtotal, type=prod.type))
            gross += subtotal
        gross = gross.quantize(Decimal("0.01"))
        order.total_gross = gross

        # Emit invoice: taxes computed via fiscal.calculate_taxes using customer.state
        inv_type = "NFSE" if is_svc else "NFE"
        calc = calculate_taxes(gross, inv_type, uf=cust.state)
        inv = Invoice(order_id=order.id, type=inv_type,
                      number=str(10000 + random.randint(0, 89999)),
                      series="1", access_key=hashlib.md5(order.id.encode()).hexdigest().upper(),
                      status="issued",
                      total_gross=gross, total_taxes=calc["total_taxes"], total_net=calc["total_net"],
                      issued_at=created + timedelta(hours=2))
        db.add(inv)
        await db.flush()
        for t in calc["taxes"]:
            db.add(InvoiceTax(invoice_id=inv.id, tax_type=t["tax_type"],
                              rate=t["rate"], base=t["base"], amount=t["amount"]))

        order.total_taxes = calc["total_taxes"]
        order.total_net = calc["total_net"]
        order.status = "invoiced"

        # Payments: 60% chance paid (in installment or single), rest pending (accounts receivable)
        methods = ["pix", "cartao", "boleto"]
        n_installments = random.choice([1, 1, 2, 3])  # weighted
        installment_amount = (gross / n_installments).quantize(Decimal("0.01"))
        for k in range(n_installments):
            due = created + timedelta(days=15 + 30 * k)
            method = random.choice(methods)
            pay_paid = random.random() < 0.65
            p = Payment(order_id=order.id, method=method,
                        amount=installment_amount,
                        status="paid" if pay_paid else "pending",
                        due_date=due,
                        paid_at=(due - timedelta(days=random.randint(0, 5))) if pay_paid else None,
                        created_at=created)
            db.add(p)
            await db.flush()
            if pay_paid:
                # Commission auto-created (would normally be via mark_paid); use goal.commission_rate if exists
                # We'll compute after goals are seeded — collect refs
                pass

    await db.commit()


async def seed_default_goals(db: AsyncSession, sellers: list[User]):
    """Seed goals for the current month for each seller."""
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    targets = [Decimal("50000"), Decimal("80000"), Decimal("60000"), Decimal("70000")]
    rates = [Decimal("0.05"), Decimal("0.06"), Decimal("0.055"), Decimal("0.05")]
    for i, s in enumerate(sellers):
        existing = (await db.execute(
            select(SalesGoal).where(SalesGoal.user_id == s.id, SalesGoal.month == month)
        )).scalar_one_or_none()
        if existing:
            continue
        g = SalesGoal(user_id=s.id, month=month,
                      target_amount=targets[i % len(targets)],
                      commission_rate=rates[i % len(rates)])
        db.add(g)
    await db.commit()


async def seed_commissions_from_paid_payments(db: AsyncSession):
    """Create commission rows for every paid payment that doesn't already have one.
    Commission = payment.amount * (seller's goal rate for that month, else 0.05).
    """
    paid_payments = (await db.execute(
        select(Payment).where(Payment.status == "paid")
    )).scalars().all()
    for p in paid_payments:
        exists = (await db.execute(
            select(Commission).where(Commission.payment_id == p.id)
        )).scalar_one_or_none()
        if exists:
            continue
        order = (await db.execute(select(Order).where(Order.id == p.order_id))).scalar_one()
        if not order.seller_id:
            continue
        month_key = (p.paid_at or p.created_at).strftime("%Y-%m")
        goal = (await db.execute(
            select(SalesGoal).where(SalesGoal.user_id == order.seller_id, SalesGoal.month == month_key)
        )).scalar_one_or_none()
        rate = goal.commission_rate if goal else Decimal("0.05")
        amount = (Decimal(p.amount) * Decimal(rate)).quantize(Decimal("0.01"))
        db.add(Commission(
            user_id=order.seller_id, order_id=order.id, payment_id=p.id,
            base_amount=p.amount, rate=rate, amount=amount, status="accrued", month=month_key,
            created_at=p.paid_at or p.created_at,
        ))
    await db.commit()


async def seed_inventory(db: AsyncSession):
    """Populate inventory across channels with realistic quantities."""
    if (await db.execute(select(Inventory))).first():
        return
    channels = (await db.execute(select(Channel))).scalars().all()
    products = (await db.execute(select(Product).where(Product.type == "product"))).scalars().all()
    random.seed(7)
    for prod in products:
        for ch in channels:
            # Physical stores get bigger stock, marketplaces vary
            if ch.type == "physical_store":
                qty = random.randint(5, 30)
            elif ch.type == "marketplace":
                qty = random.randint(0, 20)  # some low to trigger alerts
            else:
                qty = random.randint(2, 25)
            db.add(Inventory(
                product_id=prod.id, channel_id=ch.id,
                quantity=qty, reserved=random.randint(0, min(3, qty)),
                external_sku=f"{ch.name[:3].upper()}-{prod.sku}",
                external_url=(ch.external_url + "/" + prod.sku) if ch.external_url else None,
                last_sync_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 48)),
            ))
    await db.commit()


async def run_seed():
    async with AsyncSessionLocal() as db:
        admin, seller, extras = await seed_users(db)
        # Multi-tenant: ensure default tenant exists and every user is linked to it.
        await seed_default_tenant(db)
        all_sellers = [seller] + extras if seller else extras
        await seed_products(db)
        await seed_channels(db)
        await seed_default_goals(db, all_sellers)
        if seller:
            await seed_leads_customers_orders(db, all_sellers, admin)
            await seed_commissions_from_paid_payments(db)
            await seed_inventory(db)
        # Final backfill pass — assigns tenant_id to any rows inserted by the
        # data seeders above that didn't set it explicitly. Idempotent.
        await seed_default_tenant(db)
