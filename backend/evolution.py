"""Evolution API (WhatsApp) client. Mockado quando URL/KEY vazios.

Docs: https://doc.evolution-api.com/
Configurar variáveis EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE no .env
(ou via Coolify em produção).
"""
import os
import re
import logging
import httpx

logger = logging.getLogger("evolution")


def _cfg():
    return {
        "url": os.environ.get("EVOLUTION_API_URL", "").rstrip("/"),
        "key": os.environ.get("EVOLUTION_API_KEY", ""),
        "instance": os.environ.get("EVOLUTION_INSTANCE", ""),
    }


def is_configured() -> bool:
    c = _cfg()
    return bool(c["url"] and c["key"] and c["instance"])


def normalize_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D+", "", raw)
    return digits or None


async def send_message(phone: str, body: str) -> dict:
    """Send WhatsApp text message via Evolution API."""
    c = _cfg()
    number = normalize_phone(phone)
    if not is_configured():
        logger.info(f"[EVOLUTION MOCK] to={number} body={body!r}")
        return {"status": "mocked", "phone": number, "body": body}

    url = f"{c['url']}/message/sendText/{c['instance']}"
    payload = {"number": number, "text": body}
    headers = {"apikey": c["key"], "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json=payload, headers=headers)
        r.raise_for_status()
        return r.json()


def parse_incoming_webhook(payload: dict) -> dict | None:
    """Extract phone/name/body from a typical Evolution webhook payload.

    Returns None if the payload isn't an incoming user message.
    """
    data = payload.get("data") or payload
    key = data.get("key") or {}
    if key.get("fromMe"):
        return None
    remote_jid = key.get("remoteJid") or data.get("remoteJid") or ""
    phone = normalize_phone(remote_jid.split("@")[0]) if remote_jid else None
    msg = data.get("message") or {}
    body = (
        msg.get("conversation")
        or (msg.get("extendedTextMessage") or {}).get("text")
        or data.get("text")
        or ""
    )
    name = data.get("pushName") or payload.get("pushName")
    external_id = key.get("id") or data.get("id")
    if not phone or not body:
        return None
    return {"phone": phone, "name": name, "body": body, "external_id": external_id}
