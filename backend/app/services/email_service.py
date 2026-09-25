"""Email delivery for IP-SAKTI Sahayak.

Supports Resend HTTPS API for production/Render deployments, while retaining
SMTP, console, and in-memory backends for local development and testing.
No additional third-party dependency is required for Resend.
"""
from __future__ import annotations

import html
import json
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.logging import logger

OUTBOX: list[dict] = []

RESEND_API_URL = "https://api.resend.com/emails"


def clear_outbox() -> None:
    OUTBOX.clear()


def _backend() -> str:
    settings = get_settings()

    configured_smtp = bool(
        settings.smtp_host
        and settings.smtp_username
        and settings.smtp_password
    )

    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()

    if settings.email_backend == "auto":
        if resend_api_key:
            return "resend"
        if configured_smtp:
            return "smtp"
        return "memory" if settings.app_env == "test" else "console"

    return settings.email_backend


def _record(to: str, subject: str, text: str, template: str) -> None:
    OUTBOX.append({
        "to": to,
        "subject": subject,
        "text": text,
        "template": template,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


def _send_resend(
    to: str,
    subject: str,
    text: str,
    html_body: str | None,
    template: str,
) -> bool:
    settings = get_settings()
    api_key = os.getenv("RESEND_API_KEY", "").strip()

    if not api_key:
        logger.error(
            f"[email:{template}] RESEND_API_KEY is not configured."
        )
        return False

    from_address = settings.email_from_address
    from_name = settings.email_from_name

    if from_name:
        from_value = f"{from_name} <{from_address}>"
    else:
        from_value = from_address

    payload = {
        "from": from_value,
        "to": [to],
        "subject": subject,
        "text": text,
        "html": html_body or _html(subject, text),
    }

    request = urllib.request.Request(
        RESEND_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        timeout = getattr(settings, "smtp_timeout_seconds", 10)

        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_body = response.read().decode("utf-8", errors="replace")

        _record(to, subject, text, template)

        logger.info(
            f"[email:{template}] sent to={to} via Resend"
        )

        return True

    except urllib.error.HTTPError as exc:
        try:
            error_body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            error_body = str(exc)

        logger.error(
            f"[email:{template}] Resend failed for {to}: "
            f"HTTP {exc.code} - {error_body}"
        )
        return False

    except urllib.error.URLError as exc:
        logger.error(
            f"[email:{template}] Resend connection failed for {to}: {exc}"
        )
        return False

    except Exception as exc:
        logger.error(
            f"[email:{template}] Resend failed for {to}: {exc}"
        )
        return False


def send_email(
    to: str,
    subject: str,
    text: str,
    *,
    template: str,
    html_body: str | None = None,
) -> bool:
    settings = get_settings()
    backend = _backend()

    if not to:
        return False

    if backend in {"memory", "console"}:
        _record(to, subject, text, template)

        if backend == "console" and settings.email_console_show_body:
            logger.info(
                f"[email:{template}] to={to} subject={subject}\n{text}"
            )
        else:
            logger.info(
                f"[email:{template}] would send to={to} subject={subject}"
            )

        return True

    if backend == "resend":
        return _send_resend(
            to,
            subject,
            text,
            html_body,
            template,
        )

    if backend != "smtp":
        logger.warning(
            f"Unknown EMAIL_BACKEND={backend}; email not sent."
        )
        return False

    message = EmailMessage()
    message["From"] = (
        f"{settings.email_from_name} "
        f"<{settings.email_from_address}>"
    )
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)

    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(
                settings.smtp_host,
                settings.smtp_port,
                timeout=settings.smtp_timeout_seconds,
                context=ssl.create_default_context(),
            ) as smtp:
                smtp.login(
                    settings.smtp_username,
                    settings.smtp_password,
                )
                smtp.send_message(message)
        else:
            with smtplib.SMTP(
                settings.smtp_host,
                settings.smtp_port,
                timeout=settings.smtp_timeout_seconds,
            ) as smtp:
                smtp.ehlo()

                if settings.smtp_use_starttls:
                    smtp.starttls(
                        context=ssl.create_default_context()
                    )
                    smtp.ehlo()

                smtp.login(
                    settings.smtp_username,
                    settings.smtp_password,
                )
                smtp.send_message(message)

        _record(to, subject, text, template)

        logger.info(
            f"[email:{template}] sent to={to}"
        )

        return True

    except Exception as exc:
        logger.error(
            f"[email:{template}] failed for {to}: {exc}"
        )
        return False


def _html(title: str, body: str) -> str:
    return (
        "<div style='font-family:Arial,sans-serif;"
        "max-width:640px;margin:auto'>"
        f"<h2>{html.escape(title)}</h2>"
        f"<p>{html.escape(body).replace(chr(10), '<br>')}</p>"
        "<p style='color:#64748b;font-size:12px'>"
        "IP-SAKTI Sahayak"
        "</p>"
        "</div>"
    )


def send_registration_otp(email: str, name: str, otp: str) -> bool:
    return send_email(
        email,
        "Verify your IP-SAKTI Sahayak account",
        f"Hello {name},\n\n"
        f"Your IP-SAKTI Sahayak verification code is: {otp}\n\n"
        "This code expires soon. If you did not create this account, "
        "you can ignore this email.",
        template="otp_verification",
        html_body=_html(
            "Verify your email",
            f"Hello {name},\n\nYour verification code is: {otp}",
        ),
    )


def send_welcome(email: str, name: str) -> bool:
    return send_email(
        email,
        "Welcome to IP-SAKTI Sahayak",
        f"Hello {name},\n\n"
        "Your IP-SAKTI Sahayak account has been created. "
        "Please verify your email before signing in.",
        template="registration",
    )


def send_email_verified(email: str, name: str) -> bool:
    return send_email(
        email,
        "Email verified successfully",
        f"Hello {name},\n\n"
        "Your IP-SAKTI Sahayak email has been verified successfully. "
        "You can now sign in.",
        template="email_verified",
    )


def send_login_alert(email: str, name: str) -> bool:
    return send_email(
        email,
        "New IP-SAKTI Sahayak sign-in",
        f"Hello {name},\n\n"
        "A sign-in to your IP-SAKTI Sahayak account was completed. "
        "If this was not you, change your password immediately.",
        template="login",
    )


def send_query_confirmation(
    email: str,
    name: str,
    query: str,
    confidence: str | None = None,
) -> bool:
    extra = f"\nConfidence: {confidence}" if confidence else ""

    return send_email(
        email,
        "Your IP-SAKTI Sahayak query was received",
        f"Hello {name},\n\n"
        "Your query was processed by IP-SAKTI Sahayak.\n\n"
        f"Query:\n{query[:1500]}{extra}\n\n"
        "Please review the source citations in the application "
        "before acting on the result.",
        template="query",
    )


def send_contact_confirmation(
    email: str,
    name: str,
    subject: str,
) -> bool:
    return send_email(
        email,
        "We received your IP-SAKTI Sahayak message",
        f"Hello {name},\n\n"
        f"We received your contact message with subject: {subject}\n\n"
        "Thank you for contacting IP-SAKTI Sahayak.",
        template="contact_confirmation",
    )


def send_contact_admin(
    recipient: str,
    name: str,
    sender_email: str,
    subject: str,
    message: str,
) -> bool:
    return send_email(
        recipient,
        f"IP-SAKTI Contact: {subject}",
        f"New contact form submission\n\n"
        f"Name: {name}\n"
        f"Email: {sender_email}\n"
        f"Subject: {subject}\n\n"
        f"Message:\n{message}",
        template="contact_admin",
    )


def send_expert_request_to_user(
    email: str,
    name: str,
    expert_type: str,
) -> bool:
    return send_email(
        email,
        "Expert consultation request submitted",
        f"Hello {name},\n\n"
        f"Your request for a {expert_type} expert has been submitted. "
        "A matching expert will be notified if available.",
        template="expert_request_user",
    )


def send_expert_request_to_expert(
    email: str,
    expert_name: str,
    asker_name: str,
    expert_type: str,
    query: str,
) -> bool:
    return send_email(
        email,
        "New matching expert consultation request",
        f"Hello {expert_name},\n\n"
        f"A user has requested a {expert_type} expert consultation.\n\n"
        f"User: {asker_name}\n"
        f"Query:\n{query[:1500]}\n\n"
        "Please open your IP-SAKTI expert console to review the request.",
        template="expert_request_expert",
    )


def send_escalation_update(
    email: str,
    name: str,
    status: str,
) -> bool:
    return send_email(
        email,
        "Expert consultation status updated",
        f"Hello {name},\n\n"
        f"Your expert consultation request is now marked as: {status}.",
        template="notification",
    )


def send_grievance_confirmation(
    email: str,
    name: str,
    subject: str,
) -> bool:
    return send_email(
        email,
        "Your IP-SAKTI grievance was received",
        f"Hello {name},\n\n"
        f"Your grievance '{subject}' has been recorded successfully.",
        template="grievance",
    )


def send_otp_for_security(
    email: str,
    name: str,
    otp: str,
    purpose: str,
) -> bool:
    labels = {
        "forgot_password": "reset your password",
        "change_password": "change your password",
        "delete_account": "delete your account",
    }

    action = labels.get(
        purpose,
        "complete this security action",
    )

    return send_email(
        email,
        "IP-SAKTI security verification code",
        f"Hello {name},\n\n"
        f"Your verification code to {action} is: {otp}\n\n"
        "If you did not request this, do not share the code.",
        template=f"otp_{purpose}",
    )


def send_password_changed(email: str, name: str) -> bool:
    return send_email(
        email,
        "Your IP-SAKTI password was changed",
        f"Hello {name},\n\n"
        "Your password was changed successfully. "
        "If you did not make this change, contact the system "
        "administrator immediately.",
        template="password_changed",
    )


def send_account_deleted(email: str, name: str) -> bool:
    return send_email(
        email,
        "Your IP-SAKTI account was deleted",
        f"Hello {name},\n\n"
        "Your IP-SAKTI Sahayak account has been permanently deleted.",
        template="account_deleted",
    )