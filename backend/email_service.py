"""Emergent-managed transactional email (Resend under the hood).

- All sends flow through the platform proxy — no Resend key handling.
- HTML bodies come from server-side templates (never caller input) — G4 safe.
- Every send is gated by `_assert_safe_email` (G2/G3 structural checks).
"""
import os
import re
import ipaddress
import logging
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException


logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"  # constant — survives deploy
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "PDEX")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password", "cvv",
    "send us your password", "enter your password below", "confirm your card number",
    "your full card number", "seed phrase", "recovery phrase", "verify your card",
    "social security number", "confirm your bank details",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None) -> str | None:
    """Send a transactional email via the Emergent proxy. Returns provider msg id.

    Fails soft: on network/proxy errors we log and return None so business flows
    (invite creation) keep working; the caller decides how to surface the failure.
    """
    _assert_safe_email(subject, html)
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY not configured — email send skipped (%s)", to)
        return None
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
    except Exception as e:
        logger.error(f"Email send error: {e}")
    return None


# ---- Server-side templates (G4 — callers pass IDs / strings, never HTML) ----
def render_invite_email(*, invitee_name: str, invitee_email: str, tenant_name: str,
                        role: str, temp_password: str, login_url: str = "https://pdex.com.br/login") -> str:
    role_labels = {"admin": "Admin", "vendedor": "Vendedor", "contador": "Contador (leitura)"}
    role_label = role_labels.get(role, role.title())
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#0A1029;font-family:Arial,sans-serif;color:#E2E8F0">'
        '<tr><td align="center" style="padding:32px 16px">'
        '<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        'style="max-width:560px;background:#0F172A;border:1px solid rgba(255,255,255,.08);border-radius:16px">'
        '<tr><td style="padding:32px 32px 8px">'
        f'<div style="font-size:12px;letter-spacing:3px;color:#94A3B8">{escape(EMAIL_FROM_NAME).upper()} · CONVITE</div>'
        f'<h1 style="margin:12px 0 0;font-size:26px;color:#fff">Olá, {escape(invitee_name)}!</h1>'
        f'<p style="margin:16px 0 0;line-height:1.6;color:#CBDSE1">'
        f'Você foi convidado(a) para acessar a empresa <strong>{escape(tenant_name)}</strong> '
        f'no <strong>{escape(EMAIL_FROM_NAME)}</strong> como <strong>{escape(role_label)}</strong>.'
        '</p>'
        '</td></tr>'
        '<tr><td style="padding:16px 32px">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#050916;border:1px solid rgba(59,130,246,.35);border-radius:12px">'
        '<tr><td style="padding:20px">'
        '<div style="font-size:11px;letter-spacing:2px;color:#94A3B8">SUAS CREDENCIAIS DE ACESSO</div>'
        f'<div style="margin-top:10px;font-size:13px;color:#94A3B8">Email</div>'
        f'<div style="font-family:monospace;font-size:15px;color:#fff">{escape(invitee_email)}</div>'
        f'<div style="margin-top:12px;font-size:13px;color:#94A3B8">Senha temporária</div>'
        f'<div style="font-family:monospace;font-size:16px;color:#22D3EE;font-weight:700">{escape(temp_password)}</div>'
        '</td></tr></table>'
        '</td></tr>'
        '<tr><td align="center" style="padding:8px 32px 24px">'
        f'<a href="{escape(login_url)}" '
        'style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#22D3EE,#3B82F6,#8B5CF6);'
        'color:#fff;text-decoration:none;font-weight:700;border-radius:10px">'
        'Acessar a plataforma'
        '</a>'
        '</td></tr>'
        '<tr><td style="padding:0 32px 28px">'
        '<p style="font-size:12px;color:#64748B;line-height:1.6;margin:0">'
        f'Recomendamos que troque a senha no primeiro acesso. O {escape(EMAIL_FROM_NAME)} nunca pede sua senha por email.'
        '</p>'
        '</td></tr>'
        '<tr><td style="padding:16px 32px 24px;border-top:1px solid rgba(255,255,255,.05)">'
        f'<div style="font-size:11px;color:#64748B;letter-spacing:2px">'
        f'{escape(EMAIL_FROM_NAME).upper()} · PME · ERP · SEM LIMITES</div>'
        '</td></tr>'
        '</table></td></tr></table>'
    )
