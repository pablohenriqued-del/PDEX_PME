"""Mock fiscal engine. Calculates tributos from configurable rates in .env.

In production, replace calls to `calculate_taxes` and `issue_invoice` with real
REST calls to a fiscal provider (Focus NFe, devnota, Nfe.io, etc).
"""
import os
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from typing import Literal


def _rate(name: str, default: str) -> Decimal:
    return Decimal(os.environ.get(name, default))


def _q(v: Decimal) -> Decimal:
    return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_taxes(gross: Decimal, invoice_type: Literal["NFE", "NFSE"]) -> dict:
    """Return dict with total_taxes, total_net and taxes list [{tax_type, rate, base, amount}]."""
    taxes = []
    if invoice_type == "NFE":  # Produtos: ICMS + PIS + COFINS + IPI
        for tax_type, env_name, default in [
            ("ICMS", "FISCAL_ICMS_RATE", "0.18"),
            ("PIS", "FISCAL_PIS_RATE", "0.0165"),
            ("COFINS", "FISCAL_COFINS_RATE", "0.076"),
            ("IPI", "FISCAL_IPI_RATE", "0.05"),
        ]:
            rate = _rate(env_name, default)
            amount = _q(gross * rate)
            taxes.append({"tax_type": tax_type, "rate": rate, "base": _q(gross), "amount": amount})
    else:  # NFS-e (serviços): ISS + PIS + COFINS
        for tax_type, env_name, default in [
            ("ISS", "FISCAL_ISS_RATE", "0.05"),
            ("PIS", "FISCAL_PIS_RATE", "0.0165"),
            ("COFINS", "FISCAL_COFINS_RATE", "0.076"),
        ]:
            rate = _rate(env_name, default)
            amount = _q(gross * rate)
            taxes.append({"tax_type": tax_type, "rate": rate, "base": _q(gross), "amount": amount})

    total_taxes = _q(sum((t["amount"] for t in taxes), Decimal("0")))
    total_net = _q(gross - total_taxes)
    return {"total_taxes": total_taxes, "total_net": total_net, "taxes": taxes}


def issue_invoice(order_payload: dict, invoice_type: Literal["NFE", "NFSE"]) -> dict:
    """Simulate calling a fiscal provider and receiving invoice metadata."""
    provider = os.environ.get("FISCAL_PROVIDER", "mock")
    number = str(int(datetime.now(timezone.utc).timestamp()) % 1_000_000)
    access_key = uuid.uuid4().hex.upper()
    return {
        "provider": provider,
        "number": number,
        "series": "1",
        "access_key": access_key,
        "status": "issued",
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "xml_url": f"https://mock-fiscal.example.com/nfe/{access_key}.xml",
        "pdf_url": f"https://mock-fiscal.example.com/nfe/{access_key}.pdf",
        "provider_payload": {"echo": order_payload, "invoice_type": invoice_type},
    }
