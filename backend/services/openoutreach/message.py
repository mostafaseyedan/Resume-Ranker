# Adapted from OpenOutreach (messaging helpers).
from __future__ import annotations

import json
import logging
import time
from typing import List, Optional

from .utils import goto_page
from .connect import attempt_connect

logger = logging.getLogger(__name__)

LINKEDIN_MESSAGING_URL = "https://www.linkedin.com/messaging/thread/new/"


def _log(logs: List[str], message: str) -> None:
    logs.append(message)
    logger.info(message)


def send_message_to_profile(
    session: "LinkedInSession",
    profile_url: str,
    full_name: str,
    message: str,
    logs: List[str],
) -> str:
    session.ensure_browser()

    _log(logs, f"Opening profile: {profile_url}")
    goto_page(
        session,
        action=lambda: session.page.goto(profile_url),
        expected_url_pattern="/in/",
        timeout=30_000,
        error_message="Failed to navigate to profile",
    )

    if _send_msg_pop_up(session, message, logs):
        return "message"

    _log(logs, "Popup message failed, attempting Connect fallback")
    try:
        goto_page(
            session,
            action=lambda: session.page.goto(profile_url),
            expected_url_pattern="/in/",
            timeout=30_000,
            error_message="Failed to return to profile for Connect",
        )
    except Exception as exc:
        _log(logs, f"Failed to reopen profile before Connect: {exc}")

    if attempt_connect(session, logs):
        return "connect"

    _log(logs, "Connect fallback failed")
    return "failed"


def _send_msg_pop_up(session: "LinkedInSession", message: str, logs: List[str]) -> bool:
    page = session.page
    try:
        direct = page.locator('button[aria-label*="Message"]:visible').first
        # Wait up to 5s for the Message button to appear and become enabled.
        for _ in range(20):
            if direct.count() > 0:
                disabled_attr = direct.get_attribute("disabled")
                aria_disabled = direct.get_attribute("aria-disabled")
                is_disabled = direct.is_disabled()
                if not is_disabled and disabled_attr is None and aria_disabled != "true":
                    break
            page.wait_for_timeout(250)

        if direct.count() > 0 and not direct.is_disabled():
            direct.click()
            _log(logs, "Opened message popup (direct button)")
        else:
            more = page.locator(
                'button[id$="profile-overflow-action"]:visible, '
                'button[aria-label*="More actions"]:visible'
            ).first
            if more.count() == 0:
                _log(logs, "Message button not available (no overflow menu)")
                return False
            more.click()
            msg_option = page.locator('div[aria-label$="to message"]:visible').first
            if msg_option.count() == 0:
                _log(logs, "Message option not available in overflow menu")
                return False
            msg_option.click()
            _log(logs, "Opened message popup (More -> Message)")

        wait_result = _wait_for_message_or_upsell(page, logs)
        if wait_result != "message":
            return False

        input_area = page.locator('div[class*="msg-form__contenteditable"]:visible').first
        input_area.scroll_into_view_if_needed()
        try:
            input_area.fill(message, timeout=10_000)
            _log(logs, "Message typed")
        except Exception:
            _log(logs, "fill() failed; using clipboard paste")
            input_area.click(force=True)
            page.evaluate(f"() => navigator.clipboard.writeText({json.dumps(message)})")
            input_area.press("ControlOrMeta+V")

        send_btn = page.locator('button[type="submit"][class*="msg-form"]:visible').first
        page.wait_for_timeout(5000)
        send_btn.click(force=True)
        _log(logs, "Message sent via popup")
        return True
    except Exception as exc:
        _log(logs, f"Popup send failed: {exc}")
        return False


def _wait_for_message_or_upsell(page, logs: List[str], timeout_ms: int = 5000) -> Optional[str]:
    deadline = time.time() + (timeout_ms / 1000)
    while time.time() < deadline:
        if _is_upsell_modal(page):
            _log(logs, "Premium upsell detected; dismissing")
            _dismiss_upsell_modal(page)
            return "upsell"

        input_area = page.locator('div[class*="msg-form__contenteditable"]:visible')
        if input_area.count() > 0:
            return "message"

        page.wait_for_timeout(250)

    _log(logs, "Message composer not found after clicking Message")
    return None


def _is_upsell_modal(page) -> bool:
    modal = page.locator('div[data-test-modal][role="dialog"].modal-upsell')
    if modal.count() > 0 and modal.first.is_visible():
        return True
    header = page.locator('h2#modal-upsell-header:visible')
    return header.count() > 0


def _dismiss_upsell_modal(page) -> None:
    close_btn = page.locator('button[data-test-modal-close-btn], button[aria-label="Dismiss"]')
    if close_btn.count() > 0:
        close_btn.first.click(force=True)
        page.wait_for_timeout(500)
        return
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)


def _send_message(session: "LinkedInSession", full_name: str, message: str, logs: List[str]) -> bool:
    goto_page(
        session,
        action=lambda: session.page.goto(LINKEDIN_MESSAGING_URL),
        expected_url_pattern="/messaging",
        timeout=30_000,
        error_message="Error opening messaging",
    )

    try:
        session.page.locator('input[class^="msg-connections"]').type(full_name, delay=50)
        item = session.page.locator('div[class*="msg-connections-typeahead__search-result-row"]').first
        item.scroll_into_view_if_needed()
        item.click(delay=200)

        session.page.locator('div[class^="msg-form__contenteditable"]').type(message, delay=10)
        session.page.wait_for_timeout(5000)
        session.page.locator('button[class^="msg-form__send-button"]').click(delay=200)
        _log(logs, "Message sent via composer")
        return True
    except Exception as exc:
        _log(logs, f"Composer send failed: {exc}")
        return False
