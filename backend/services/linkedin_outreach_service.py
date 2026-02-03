# LinkedIn outreach service using OpenOutreach-derived helpers.
from __future__ import annotations

import logging
from typing import Dict, Any, List

from services.openoutreach.session import LinkedInCredentials, LinkedInSession
from services.openoutreach.message import send_message_to_profile

logger = logging.getLogger(__name__)


def reach_out_via_linkedin(
    profile_url: str,
    full_name: str,
    message: str,
    username: str,
    password: str,
    headless: bool = False,
    session_key: str | None = None,
) -> Dict[str, Any]:
    logs: List[str] = []
    storage_state_path = None
    if session_key:
        storage_state_path = LinkedInSession.build_storage_state_path(session_key)
    session = LinkedInSession(
        credentials=LinkedInCredentials(username=username, password=password),
        headless=headless,
        storage_state_path=storage_state_path,
    )

    try:
        action = send_message_to_profile(
            session=session,
            profile_url=profile_url,
            full_name=full_name,
            message=message,
            logs=logs,
        )
        success = action in ("message", "connect")
        return {
            "success": success,
            "action": action,
            "logs": logs,
            "error": None if success else "Message sending failed",
        }
    except Exception as exc:
        error_message = str(exc)
        logs.append(f"ERROR: {error_message}")
        logger.exception("LinkedIn outreach failed")
        return {
            "success": False,
            "logs": logs,
            "error": error_message,
        }
    finally:
        session.close()
