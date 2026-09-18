"""Pydantic schemas for API I/O."""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth ---
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "vendedor"


class UserOut(ORMBase):
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Leads ---
class LeadIn(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    source: str = "Manual"
    status: str = "novo"
    value: Decimal = Decimal("0")
    notes: Optional[str] = None
    owner_id: Optional[str] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    value: Optional[Decimal] = None
    notes: Optional[str] = None
    owner_id: Optional[str] = None


class LeadMessageOut(ORMBase):
    id: str
    lead_id: str
    direction: str
    channel: str
    body: str
    author: Optional[str] = None
    created_at: datetime


class LeadOut(ORMBase):
    id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    source: str
    status: str
    value: Decimal
    notes: Optional[str] = None
    owner_id: Optional[str] = None
    customer_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class LeadDetailOut(LeadOut):
    messages: List[LeadMessageOut] = []


class MessageIn(BaseModel):
    body: str
    channel: str = "WhatsApp"


# --- Customers ---
class CustomerIn(BaseModel):
    name: str
    document: Optional[str] = None
    person_type: str = "PF"
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    ibge_code: Optional[str] = None
    zip_code: Optional[str] = None
    lgpd_consent: bool = False


class CustomerOut(ORMBase):
    id: str
    name: str
    document: Optional[str] = None
    person_type: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    ibge_code: Optional[str] = None
    zip_code: Optional[str] = None
    lgpd_consent: bool
    lgpd_consent_at: Optional[datetime] = None
    anonymized: bool
    owner_id: Optional[str] = None
    created_at: datetime


# --- Products ---
class ProductIn(BaseModel):
    sku: Optional[str] = None
    name: str
    description: Optional[str] = None
    type: str = "product"
    unit: str = "UN"
    price: Decimal = Decimal("0")
    cost: Decimal = Decimal("0")
    stock: int = 0
    ncm: Optional[str] = None
    is_active: bool = True


class ProductOut(ORMBase):
    id: str
    sku: Optional[str] = None
    name: str
    description: Optional[str] = None
    type: str
    unit: str
    price: Decimal
    cost: Decimal
    stock: int
    ncm: Optional[str] = None
    is_active: bool
    created_at: datetime


# --- Orders ---
class OrderItemIn(BaseModel):
    product_id: str
    quantity: Decimal = Decimal("1")
    unit_price: Optional[Decimal] = None
    description: Optional[str] = None


class OrderItemOut(ORMBase):
    id: str
    product_id: str
    description: str
    quantity: Decimal
    unit_price: Decimal
    subtotal: Decimal
    type: str


class OrderIn(BaseModel):
    customer_id: str
    lead_id: Optional[str] = None
    seller_id: Optional[str] = None
    items: List[OrderItemIn] = []
    notes: Optional[str] = None


class OrderOut(ORMBase):
    id: str
    number: int
    customer_id: str
    seller_id: Optional[str] = None
    lead_id: Optional[str] = None
    status: str
    total_gross: Decimal
    total_taxes: Decimal
    total_net: Decimal
    notes: Optional[str] = None
    created_at: datetime
    items: List[OrderItemOut] = []


# --- Payments ---
class PaymentIn(BaseModel):
    method: str = "pix"
    amount: Decimal
    due_date: Optional[datetime] = None


class PaymentOut(ORMBase):
    id: str
    order_id: str
    method: str
    amount: Decimal
    status: str
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    created_at: datetime


# --- Invoices ---
class InvoiceTaxOut(ORMBase):
    id: str
    tax_type: str
    rate: Decimal
    base: Decimal
    amount: Decimal


class InvoiceOut(ORMBase):
    id: str
    order_id: str
    type: str
    number: Optional[str] = None
    series: Optional[str] = None
    access_key: Optional[str] = None
    status: str
    total_gross: Decimal
    total_taxes: Decimal
    total_net: Decimal
    xml_url: Optional[str] = None
    pdf_url: Optional[str] = None
    provider_payload: Optional[Any] = None
    issued_at: datetime
    taxes: List[InvoiceTaxOut] = []


# --- Dashboard ---
class KPIOut(BaseModel):
    revenue_gross: Decimal
    revenue_net: Decimal
    total_taxes: Decimal
    orders_count: int
    leads_open: int
    receivables: Decimal


class MonthlyPoint(BaseModel):
    month: str
    gross: Decimal
    net: Decimal
    taxes: Decimal


class TaxBreakdownPoint(BaseModel):
    tax_type: str
    amount: Decimal


class ReceivableOut(BaseModel):
    payment_id: str
    order_number: int
    customer_name: str
    method: str
    amount: Decimal
    due_date: Optional[datetime] = None


class DashboardOut(BaseModel):
    kpis: KPIOut
    monthly: List[MonthlyPoint]
    tax_breakdown: List[TaxBreakdownPoint]
    receivables: List[ReceivableOut]
