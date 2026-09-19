"""Mock fiscal engine with per-state ICMS/ISS rates + Reforma Tributária 2027 (IBS+CBS) mode.

Modes (env FISCAL_MODE):
- classic (default): ICMS + PIS + COFINS + IPI (produtos) OR ISS + PIS + COFINS (serviços)
- reforma: CBS (federal) + IBS (estado/municipal) — substitui todos acima
- hybrid: fase de transição (2027-2032) — aplica classic com percentual reduzido + reforma com percentual crescente

Rates 2027 (mock, ajustar conforme LC 214/2025):
- CBS ~8.8%
- IBS ~17.7% (média nacional) — variação por destino via UF_IBS
"""
import os
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from typing import Literal, Optional


UF_ICMS: dict[str, Decimal] = {
    "SP": Decimal("0.18"), "RJ": Decimal("0.22"), "MG": Decimal("0.18"), "DF": Decimal("0.18"),
    "PR": Decimal("0.195"), "MA": Decimal("0.22"), "RS": Decimal("0.17"), "SC": Decimal("0.17"),
    "BA": Decimal("0.205"), "PE": Decimal("0.205"), "GO": Decimal("0.19"), "ES": Decimal("0.17"),
    "CE": Decimal("0.20"), "AM": Decimal("0.20"), "PA": Decimal("0.19"),
}

UF_ISS: dict[str, Decimal] = {uf: Decimal("0.05") for uf in UF_ICMS.keys()}

# IBS por UF (mock reforma). Média nacional 17.7%; destinos "premium" ligeiramente acima
UF_IBS: dict[str, Decimal] = {
    "SP": Decimal("0.177"), "RJ": Decimal("0.185"), "MG": Decimal("0.177"), "DF": Decimal("0.177"),
    "PR": Decimal("0.178"), "MA": Decimal("0.185"), "RS": Decimal("0.175"), "SC": Decimal("0.175"),
    "BA": Decimal("0.182"), "PE": Decimal("0.182"), "GO": Decimal("0.178"), "ES": Decimal("0.175"),
    "CE": Decimal("0.180"), "AM": Decimal("0.180"), "PA": Decimal("0.178"),
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


def ibs_rate_for(uf: Optional[str]) -> Decimal:
    if uf:
        r = UF_IBS.get(uf.upper())
        if r is not None:
            return r
    return _rate("FISCAL_IBS_RATE", "0.177")


def cbs_rate() -> Decimal:
    return _rate("FISCAL_CBS_RATE", "0.088")


def current_mode() -> str:
    try:
        from settings_store import get as _get
        val = _get("fiscal_mode")
        if val:
            return val.lower()
    except Exception:
        pass
    return os.environ.get("FISCAL_MODE", "classic").lower()


def calculate_taxes(gross: Decimal, invoice_type: Literal["NFE", "NFSE"], uf: Optional[str] = None,
                     mode: Optional[str] = None) -> dict:
    """Return dict with total_taxes, total_net, taxes[] and regime label.

    `mode` — force a specific tax regime. If None, uses FISCAL_MODE env.
    """
    mode = (mode or current_mode()).lower()
    taxes = []
    pis = _rate("FISCAL_PIS_RATE", "0.0165")
    cofins = _rate("FISCAL_COFINS_RATE", "0.076")
    ipi = _rate("FISCAL_IPI_RATE", "0.05")

    def add(tax_type: str, rate: Decimal):
        amount = _q(gross * rate)
        taxes.append({"tax_type": tax_type, "rate": rate, "base": _q(gross), "amount": amount})

    if mode == "reforma":
        # CBS (federal) + IBS (estado/municipal) substituem tudo
        add("CBS", cbs_rate())
        add("IBS", ibs_rate_for(uf))
    elif mode == "hybrid":
        # 2027-2032: transição — 50% classic + 50% reforma
        half = Decimal("0.5")
        if invoice_type == "NFE":
            add("ICMS", icms_rate_for(uf) * half)
            add("PIS", pis * half)
            add("COFINS", cofins * half)
            add("IPI", ipi * half)
        else:
            add("ISS", iss_rate_for(uf) * half)
            add("PIS", pis * half)
            add("COFINS", cofins * half)
        add("CBS", cbs_rate() * half)
        add("IBS", ibs_rate_for(uf) * half)
    else:
        # classic (pré-reforma)
        if invoice_type == "NFE":
            add("ICMS", icms_rate_for(uf))
            add("PIS", pis)
            add("COFINS", cofins)
            add("IPI", ipi)
        else:
            add("ISS", iss_rate_for(uf))
            add("PIS", pis)
            add("COFINS", cofins)

    total_taxes = _q(sum((t["amount"] for t in taxes), Decimal("0")))
    total_net = _q(gross - total_taxes)
    return {"total_taxes": total_taxes, "total_net": total_net, "taxes": taxes, "regime": mode}


def issue_invoice(order_payload: dict, invoice_type: Literal["NFE", "NFSE"]) -> dict:
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
