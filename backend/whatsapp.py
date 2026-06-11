"""Fonnte WhatsApp API integration helper."""
import os
import logging
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger(__name__)

FONNTE_SEND_URL = "https://api.fonnte.com/send"

# Settings cached in-memory; loaded from DB on app startup and refreshed when updated.
_settings_cache: Dict[str, str] = {}


def set_settings(token: Optional[str] = None, shop_name: Optional[str] = None):
    if token is not None:
        _settings_cache["FONNTE_TOKEN"] = token
    if shop_name is not None:
        _settings_cache["SHOP_NAME"] = shop_name


def get_token() -> str:
    return _settings_cache.get("FONNTE_TOKEN") or os.environ.get("FONNTE_TOKEN", "").strip()


def get_shop_name() -> str:
    return _settings_cache.get("SHOP_NAME") or os.environ.get("SHOP_NAME", "Warung Kopi")


def normalize_phone(phone: str) -> str:
    """Convert Indonesian phone like 0812... -> 62812..."""
    if not phone:
        return ""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits:
        return ""
    if digits.startswith("0"):
        return "62" + digits[1:]
    if digits.startswith("62"):
        return digits
    if digits.startswith("8"):
        return "62" + digits
    return digits


async def send_whatsapp(phone: str, message: str) -> Dict[str, Any]:
    """Send WhatsApp via Fonnte. Never raises; returns dict with status."""
    token = get_token()
    if not token:
        logger.warning("FONNTE_TOKEN not configured; skip WhatsApp send")
        return {"status": False, "reason": "missing_token"}

    target = normalize_phone(phone)
    if not target:
        logger.warning("Invalid phone: %r", phone)
        return {"status": False, "reason": "invalid_phone"}

    payload = {"target": target, "message": message, "countryCode": "0"}
    headers = {"Authorization": token}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(FONNTE_SEND_URL, data=payload, headers=headers)
        try:
            data = r.json()
        except ValueError:
            logger.error("Fonnte non-JSON response: %s", r.text)
            return {"status": False, "reason": "invalid_response", "body": r.text[:300]}
        if not data.get("status"):
            logger.error("Fonnte error: %s", data)
        else:
            logger.info("Fonnte sent: %s", data.get("detail"))
        return data
    except httpx.RequestError as e:
        logger.error("Fonnte request error: %s", e)
        return {"status": False, "reason": "network_error", "detail": str(e)}


def format_rp(amount: float) -> str:
    return f"Rp {int(amount):,}".replace(",", ".")


def msg_debt_created(customer_name: str, order_number: str, amount: float, total_debt: float, shop_name: str) -> str:
    return (
        f"Halo {customer_name}, 👋\n\n"
        f"Transaksi hutang Anda telah dicatat di *{shop_name}*:\n"
        f"📋 No. Pesanan: {order_number}\n"
        f"💰 Jumlah: {format_rp(amount)}\n"
        f"📊 Total hutang Anda saat ini: *{format_rp(total_debt)}*\n\n"
        f"Mohon lakukan pelunasan secepatnya ya. Terima kasih! 🙏"
    )


def msg_debt_paid(customer_name: str, paid: float, remaining: float, shop_name: str) -> str:
    if remaining <= 0:
        return (
            f"Halo {customer_name}, ✅\n\n"
            f"Terima kasih! Pembayaran hutang sebesar *{format_rp(paid)}* telah kami terima.\n"
            f"🎉 *Hutang Anda LUNAS!*\n\n"
            f"Sampai jumpa kembali di *{shop_name}* 🙏"
        )
    return (
        f"Halo {customer_name}, ✅\n\n"
        f"Terima kasih! Pembayaran sebesar *{format_rp(paid)}* sudah kami terima.\n"
        f"📊 Sisa hutang Anda: *{format_rp(remaining)}*\n\n"
        f"Terima kasih atas pembayarannya! 🙏\n"
        f"— *{shop_name}*"
    )


def msg_reminder(customer_name: str, debt: float, shop_name: str) -> str:
    return (
        f"Halo {customer_name}, 👋\n\n"
        f"Ini pengingat dari *{shop_name}*.\n"
        f"📊 Hutang Anda saat ini: *{format_rp(debt)}*\n\n"
        f"Mohon segera melakukan pelunasan ya. Jika sudah dibayar, mohon abaikan pesan ini.\n\n"
        f"Terima kasih atas kerjasamanya 🙏"
    )
