"""Mock fiscal engine with per-state ICMS/ISS rates for a realistic Brazilian PME simulation.

In production, replace `calculate_taxes` and `issue_invoice` with real REST calls
to a fiscal provider (Focus NFe, devnota, Nfe.io) — the shape of the returned dict
must stay the same so the rest of the app keeps working.
"""
import os
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from typing import Literal, Optional


# --- Per-UF ICMS rates (interno, com FECP quando aplicável). Valores realistas 2025.
UF_ICMS: dict[str, Decimal] = {
    "SP": Decimal("0.18"),
    "RJ": Decimal("0.22"),  # 20% + 2% FECP
    "MG": Decimal("0.18"),
    "DF": Decimal("0.18"),
    "PR": Decimal("0.195"),
    "MA": Decimal("0.22"),
    "RS": Decimal("0.17"),
    "SC": Decimal("0.17"),
    "BA": Decimal("0.205"),
    "PE": Decimal("0.205"),
    "GO": Decimal("0.19"),
    "ES": Decimal("0.17"),
    "CE": Decimal("0.20"),
    "AM": Decimal("0.20"),
    "PA": Decimal("0.19"),
}

# --- Per-UF ISS (municipal) — usually per município mas aproximamos por UF
UF_ISS: dict[str, Decimal] = {
    "SP": Decimal("0.05"),
    "RJ": Decimal("0.05"),
    "MG": Decimal("0.05"),
    "DF": Decimal("0.05"),
    "PR": Decimal("0.05"),
    "MA": Decimal("0.05"),
    "RS": Decimal("0.05"),
    "SC": Decimal("0.05"),
    "BA": Decimal("0.05"),
    "PE": Decimal("0.05"),
    "GO": Decimal("0.05"),
    "ES": Decimal("0.05"),
    "CE": Decimal("0.05"),
    "AM": Decimal("0.05"),
    "PA": Decimal("0.05"),
}


def _rate(name: str, default: str) -> Decimal:
    return Decimal(os.environ.get(name, default))


def _q(v: Decimal) -> Decimal:
    return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def icms_rate_for(uf: Optional[str]) -> Decimal:
    if uf:
        r = UF_ICMS.get(uf.upper())
        if r is not None:
            return r
    return _rate("FISCAL_ICMS_RATE", "0.18")


def iss_rate_for(uf: Optional[str]) -> Decimal:
    if uf:
        r = UF_ISS.get(uf.upper())
        if r is not None:
            return r
    return _rate("FISCAL_ISS_RATE", "0.05")


def calculate_taxes(gross: Decimal, invoice_type: Literal["NFE", "NFSE"], uf: Optional[str] = None) -> dict:
    """Return dict with total_taxes, total_net and taxes list [{tax_type, rate, base, amount}].

    `uf` is the customer's UF. Used to pick ICMS/ISS rates.
    """
    taxes = []
    pis = _rate("FISCAL_PIS_RATE", "0.0165")
    cofins = _rate("FISCAL_COFINS_RATE", "0.076")
    ipi = _rate("FISCAL_IPI_RATE", "0.05")

    if invoice_type == "NFE":  # Produtos: ICMS + PIS + COFINS + IPI
        rows = [
            ("ICMS", icms_rate_for(uf)),
            ("PIS", pis),
            ("COFINS", cofins),
            ("IPI", ipi),
        ]
    else:  # NFS-e (serviços): ISS + PIS + COFINS
        rows = [
            ("ISS", iss_rate_for(uf)),
            ("PIS", pis),
            ("COFINS", cofins),
        ]

    for tax_type, rate in rows:
        amount = _q(gross * rate)
        taxes.append({"tax_type": tax_type, "rate": rate, "base": _q(gross), "amount": amount})

    total_taxes = _q(sum((t["amount"] for t in taxes), Decimal("0")))
    total_net = _q(gross - total_taxes)
    return {"total_taxes": total_taxes, "total_net": total_net, "taxes": taxes}


def issue_invoice(order_payload: dict, invoice_type: Literal["NFE", "NFSE"]) -> dict:
    """Simulate calling a fiscal provider and receiving invoice metadata."""
    provider = os.environ.get("FISCAL_PROVIDER", "mock")
    number = str(int(datetime.now(timezone.utc).timestamp() * 1000) % 10_000_000)
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
