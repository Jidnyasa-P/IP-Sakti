"""SMTP email delivery and one-time-password helpers for IP-SAKTI Sahayak."""
import hashlib
import secrets
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.core.config import get_settings

OTP_COLLECTION = "email_otps"
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_SECONDS = 60
OTP_MAX_PER_HOUR = 5

OUTBOX: list[dict] = []

def clear_outbox() -> None:
    OUTBOX.clear()


def _otp_hash(email: str, purpose: str, otp: str) -> str:
    settings = get_settings()
    raw = f"{settings.otp_pepper}:{email.strip().lower()}:{purpose}:{otp}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _send_message(to_email: str, subject: str, body: str, reply_to: str | None = None, template: str = "generic") -> None:
    settings = get_settings()
    if settings.email_backend == "memory" or (settings.email_backend == "auto" and not settings.smtp_configured):
        OUTBOX.append({"to": to_email, "subject": subject, "text": body, "template": template})
        return
    if not settings.smtp_configured:
        raise RuntimeError("SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD.")

    msg = EmailMessage()
    msg["From"] = settings.email_from_address or settings.smtp_username
    msg["To"] = to_email
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as server:
        if settings.smtp_use_starttls:
            server.starttls()
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(msg)


def send_email(to_email: str, subject: str, body: str, template: str = "generic") -> bool:
    try:
        _send_message(to_email, subject, body, template=template)
        return True
    except Exception:
        from app.core.logging import logger
        logger.exception("SMTP email delivery failed for %s", to_email)
        return False


def send_otp(db, email: str, purpose: str) -> dict:
    email = email.strip().lower()
    settings = get_settings()
    now = datetime.now(timezone.utc)
    existing = db[OTP_COLLECTION].find_one({"email": email, "purpose": purpose})
    if existing:
        last_sent = existing.get("created_at")
        if last_sent and (now - last_sent).total_seconds() < settings.otp_resend_cooldown_seconds:
            raise HTTPException(status_code=429, detail="Please wait before requesting another OTP.")

    hour_ago = now - timedelta(hours=1)
    recent_count = db[OTP_COLLECTION].count_documents({"email": email, "created_at": {"$gte": hour_ago}})
    if recent_count >= settings.otp_max_sends_per_hour:
        raise HTTPException(status_code=429, detail="Too many OTP requests. Please try again later.")

    otp = generate_otp()
    record = {
        "_id": f"otp-{secrets.token_hex(12)}",
        "email": email,
        "purpose": purpose,
        "otp_hash": _otp_hash(email, purpose, otp),
        "created_at": now,
        "expires_at": now + timedelta(minutes=settings.otp_ttl_minutes),
        "attempts": 0,
    }
    db[OTP_COLLECTION].delete_many({"email": email, "purpose": purpose})
    db[OTP_COLLECTION].insert_one(record)

    sent = send_email(
        email,
        "Your IP-SAKTI Sahayak verification code",
        f"Your IP-SAKTI Sahayak verification code is {otp}.\n\nThis code expires in {settings.otp_ttl_minutes} minutes. Do not share it with anyone.\n\nIf you did not request this code, you can ignore this email.",
        template="otp_verification",
    )
    if not sent:
        db[OTP_COLLECTION].delete_one({"_id": record["_id"]})
        raise HTTPException(status_code=503, detail="Email delivery is currently unavailable. Please try again later.")
    return {"expires_in_seconds": OTP_EXPIRY_MINUTES * 60}


def verify_otp(db, email: str, purpose: str, otp: str) -> bool:
    email = email.strip().lower()
    settings = get_settings()
    record = db[OTP_COLLECTION].find_one({"email": email, "purpose": purpose})
    if not record:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new OTP.")
    if record.get("expires_at") and record["expires_at"] < datetime.now(timezone.utc):
        db[OTP_COLLECTION].delete_one({"_id": record["_id"]})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    if record.get("attempts", 0) >= settings.otp_max_attempts:
        db[OTP_COLLECTION].delete_one({"_id": record["_id"]})
        raise HTTPException(status_code=400, detail="Too many incorrect OTP attempts. Please request a new one.")

    if not secrets.compare_digest(record["otp_hash"], _otp_hash(email, purpose, otp.strip())):
        db[OTP_COLLECTION].update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Incorrect OTP.")

    db[OTP_COLLECTION].delete_one({"_id": record["_id"]})
    return True


def send_welcome_email(email: str, name: str) -> None:
    send_email(email, "Welcome to IP-SAKTI Sahayak", f"Hello {name},\n\nYour IP-SAKTI Sahayak account has been verified successfully.\n\nYou can now sign in and use the platform.\n\nRegards,\nIP-SAKTI Sahayak", template="registration")


def send_login_email(email: str, name: str) -> None:
    send_email(email, "New sign-in to your IP-SAKTI Sahayak account", f"Hello {name},\n\nYour IP-SAKTI Sahayak account was just used to sign in.\n\nIf this was not you, change your password immediately.\n\nRegards,\nIP-SAKTI Sahayak", template="login")


def send_query_email(email: str, name: str, query: str) -> None:
    send_email(email, "Your IP-SAKTI Sahayak query was received", f"Hello {name},\n\nWe received your query:\n\n{query[:1000]}\n\nYou can review the response in your IP-SAKTI Sahayak workspace.\n\nRegards,\nIP-SAKTI Sahayak")


def send_contact_confirmation(email: str, name: str, subject: str) -> None:
    send_email(email, "We received your IP-SAKTI Sahayak message", f"Hello {name},\n\nThank you for contacting IP-SAKTI Sahayak. We received your message with the subject “{subject}”.\n\nOur team will review it and respond through the appropriate channel.\n\nRegards,\nIP-SAKTI Sahayak")


def send_contact_admin(name: str, email: str, subject: str, message: str) -> None:
    settings = get_settings()
    if settings.contact_recipient:
        _send_message(settings.contact_recipient, f"IP-SAKTI Contact: {subject}", f"Name: {name}\nEmail: {email}\nSubject: {subject}\n\n{message}", reply_to=email)


def send_expert_request_email(email: str, name: str, expert_type: str, query: str, recipient_is_expert: bool = False) -> None:
    label = {"ayurveda": "Ayurveda Expert", "legal": "Legal / IP Expert", "regulatory": "Regulatory Affairs Expert"}.get(expert_type, expert_type)
    if recipient_is_expert:
        subject = f"New {label} consultation request"
        body = f"Hello {name},\n\nA user has requested consultation from a {label}.\n\nQuery:\n{query[:1200]}\n\nPlease review the request in your expert workspace.\n\nRegards,\nIP-SAKTI Sahayak"
    else:
        subject = "Expert consultation request confirmed"
        body = f"Hello {name},\n\nYour request for a {label} has been recorded. A matching verified expert has been notified.\n\nQuery:\n{query[:1200]}\n\nRegards,\nIP-SAKTI Sahayak"
    send_email(email, subject, body)


def send_security_email(email: str, name: str, subject: str, action: str) -> None:
    send_email(email, subject, f"Hello {name},\n\n{action}\n\nIf you did not initiate this action, please secure your account immediately.\n\nRegards,\nIP-SAKTI Sahayak")
