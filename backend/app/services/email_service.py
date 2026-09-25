"""SMTP email delivery for IP-SAKTI Sahayak.

The service uses Python's standard-library email/smtplib modules, so no new
third-party dependency is required. In tests/DEMO MODE it can capture an
in-memory outbox; in production set EMAIL_BACKEND=smtp (or auto + SMTP_HOST).
Email failures are logged and do not make the main application action fail.
"""
from __future__ import annotations

import html
import smtplib
import ssl
from email.message import EmailMessage
from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.logging import logger

OUTBOX: list[dict] = []


def clear_outbox() -> None:
    OUTBOX.clear()


def _backend() -> str:
    settings = get_settings()
    configured = bool(settings.smtp_host and settings.smtp_username and settings.smtp_password)
    if settings.email_backend == "auto":
        return "smtp" if configured else "memory" if settings.app_env == "test" else "console"
    return settings.email_backend


def _record(to: str, subject: str, text: str, template: str) -> None:
    OUTBOX.append({
        "to": to,
        "subject": subject,
        "text": text,
        "template": template,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


def send_email(to: str, subject: str, text: str, *, template: str, html_body: str | None = None) -> bool:
    settings = get_settings()
    backend = _backend()
    if not to:
        return False

    if backend in {"memory", "console"}:
        _record(to, subject, text, template)
        if backend == "console" and settings.email_console_show_body:
            logger.info(f"[email:{template}] to={to} subject={subject}\n{text}")
        else:
            logger.info(f"[email:{template}] would send to={to} subject={subject}")
        return True

    if backend != "smtp":
        logger.warning(f"Unknown EMAIL_BACKEND={backend}; email not sent.")
        return False

    message = EmailMessage()
    message["From"] = f"{settings.email_from_name} <{settings.email_from_address}>"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds, context=ssl.create_default_context()) as smtp:
                smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as smtp:
                smtp.ehlo()
                if settings.smtp_use_starttls:
                    smtp.starttls(context=ssl.create_default_context())
                    smtp.ehlo()
                smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)
        _record(to, subject, text, template)
        logger.info(f"[email:{template}] sent to={to}")
        return True
    except Exception as exc:
        logger.error(f"[email:{template}] failed for {to}: {exc}")
        return False


def _html(title: str, body: str) -> str:
    return f"<div style='font-family:Arial,sans-serif;max-width:640px;margin:auto'><h2>{html.escape(title)}</h2><p>{html.escape(body).replace(chr(10), '<br>')}</p><p style='color:#64748b;font-size:12px'>IP-SAKTI Sahayak</p></div>"


def send_registration_otp(email: str, name: str, otp: str) -> bool:
    return send_email(email, "Verify your IP-SAKTI Sahayak account", f"Hello {name},\n\nYour IP-SAKTI Sahayak verification code is: {otp}\n\nThis code expires soon. If you did not create this account, you can ignore this email.", template="otp_verification", html_body=_html("Verify your email", f"Hello {name},\n\nYour verification code is: {otp}"))


def send_welcome(email: str, name: str) -> bool:
    return send_email(email, "Welcome to IP-SAKTI Sahayak", f"Hello {name},\n\nYour IP-SAKTI Sahayak account has been created. Please verify your email before signing in.", template="registration")


def send_email_verified(email: str, name: str) -> bool:
    return send_email(email, "Email verified successfully", f"Hello {name},\n\nYour IP-SAKTI Sahayak email has been verified successfully. You can now sign in.", template="email_verified")


def send_login_alert(email: str, name: str) -> bool:
    return send_email(email, "New IP-SAKTI Sahayak sign-in", f"Hello {name},\n\nA sign-in to your IP-SAKTI Sahayak account was completed. If this was not you, change your password immediately.", template="login")


def send_query_confirmation(email: str, name: str, query: str, confidence: str | None = None) -> bool:
    extra = f"\nConfidence: {confidence}" if confidence else ""
    return send_email(email, "Your IP-SAKTI Sahayak query was received", f"Hello {name},\n\nYour query was processed by IP-SAKTI Sahayak.\n\nQuery:\n{query[:1500]}{extra}\n\nPlease review the source citations in the application before acting on the result.", template="query")


def send_contact_confirmation(email: str, name: str, subject: str) -> bool:
    return send_email(email, "We received your IP-SAKTI Sahayak message", f"Hello {name},\n\nWe received your contact message with subject: {subject}\n\nThank you for contacting IP-SAKTI Sahayak.", template="contact_confirmation")


def send_contact_admin(recipient: str, name: str, sender_email: str, subject: str, message: str) -> bool:
    return send_email(recipient, f"IP-SAKTI Contact: {subject}", f"New contact form submission\n\nName: {name}\nEmail: {sender_email}\nSubject: {subject}\n\nMessage:\n{message}", template="contact_admin")


def send_expert_request_to_user(email: str, name: str, expert_type: str) -> bool:
    return send_email(email, "Expert consultation request submitted", f"Hello {name},\n\nYour request for a {expert_type} expert has been submitted. A matching expert will be notified if available.", template="expert_request_user")


def send_expert_request_to_expert(email: str, expert_name: str, asker_name: str, expert_type: str, query: str) -> bool:
    return send_email(email, "New matching expert consultation request", f"Hello {expert_name},\n\nA user has requested a {expert_type} expert consultation.\n\nUser: {asker_name}\nQuery:\n{query[:1500]}\n\nPlease open your IP-SAKTI expert console to review the request.", template="expert_request_expert")


def send_escalation_update(email: str, name: str, status: str) -> bool:
    return send_email(email, "Expert consultation status updated", f"Hello {name},\n\nYour expert consultation request is now marked as: {status}.", template="notification")


def send_grievance_confirmation(email: str, name: str, subject: str) -> bool:
    return send_email(email, "Your IP-SAKTI grievance was received", f"Hello {name},\n\nYour grievance '{subject}' has been recorded successfully.", template="grievance")


def send_otp_for_security(email: str, name: str, otp: str, purpose: str) -> bool:
    labels = {
        "forgot_password": "reset your password",
        "change_password": "change your password",
        "delete_account": "delete your account",
    }
    action = labels.get(purpose, "complete this security action")
    return send_email(email, "IP-SAKTI security verification code", f"Hello {name},\n\nYour verification code to {action} is: {otp}\n\nIf you did not request this, do not share the code.", template=f"otp_{purpose}")


def send_password_changed(email: str, name: str) -> bool:
    return send_email(email, "Your IP-SAKTI password was changed", f"Hello {name},\n\nYour password was changed successfully. If you did not make this change, contact the system administrator immediately.", template="password_changed")


def send_account_deleted(email: str, name: str) -> bool:
    return send_email(email, "Your IP-SAKTI account was deleted", f"Hello {name},\n\nYour IP-SAKTI Sahayak account has been permanently deleted.", template="account_deleted")
