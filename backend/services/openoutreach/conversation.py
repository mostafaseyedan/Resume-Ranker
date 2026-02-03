# Conversation scraping and reply helpers for LinkedIn.
from __future__ import annotations

import hashlib
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from .utils import goto_page

if TYPE_CHECKING:
    from .session import LinkedInSession

logger = logging.getLogger(__name__)


def _log(logs: List[str], message: str) -> None:
    logs.append(message)
    logger.info(message)


def hash_url(url: str) -> str:
    """Create stable hash from profile URL for Firestore doc ID."""
    normalized = url.rstrip('/').lower()
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


# Fallback selectors - LinkedIn A/B tests these frequently
MESSAGE_BUTTON_SELECTORS = [
    'button[aria-label*="Message"]:visible',
    'button[id$="profile-overflow-action"]:visible',
]

MESSAGE_INPUT_SELECTORS = [
    'div[class*="msg-form__contenteditable"]:visible',
    'div[role="textbox"][contenteditable="true"]:visible',
]

THREAD_CONTAINER_SELECTORS = [
    'ul.msg-s-message-list-content',
    'div.msg-s-message-list',
    'div[class*="msg-thread"]',
]

MESSAGE_ITEM_SELECTORS = [
    'li.msg-s-message-list__event',
    'div[class*="msg-s-event-listitem"]',
]

MESSAGE_CONTENT_SELECTORS = [
    'p.msg-s-event-listitem__body',
    'div.msg-s-event-listitem__body',
    'p[class*="msg-s-event-listitem__message-body"]',
]

SENDER_SELECTORS = [
    'span.msg-s-message-group__name',
    'span[class*="msg-s-message-group__profile-link"]',
    'a[class*="msg-s-message-group__name"]',
]

TIMESTAMP_SELECTORS = [
    'time.msg-s-message-list__time-heading',
    'time[class*="msg-s-message-group__timestamp"]',
    'span[class*="msg-s-message-list__time"]',
]

UPSELL_MODAL_SELECTORS = [
    'div[data-test-modal][role="dialog"].modal-upsell',
    'h2#modal-upsell-header:visible',
]

# Top card selectors for connection status (from OpenOutreach pattern)
TOP_CARD_SELECTORS = [
    'section:has(div.top-card-background-hero-image)',
    'section[data-member-id]',
    'section.artdeco-card:has(> div.pv-top-card)',
    'section:has(> div[class*="pv-top-card"])',
    'section[componentkey*="com.linkedin.sdui.profile.card"]',
]


def _try_selectors(page, selectors: List[str], logs: List[str], description: str = "element"):
    """Try multiple selectors, return first match, log which worked."""
    for selector in selectors:
        try:
            loc = page.locator(selector)
            if loc.count() > 0:
                _log(logs, f"Selector matched for {description}: {selector}")
                return loc.first
        except Exception:
            continue
    _log(logs, f"No selector matched for {description}")
    return None


def _is_upsell_modal(page) -> bool:
    """Detect Premium upsell modal."""
    for selector in UPSELL_MODAL_SELECTORS:
        loc = page.locator(selector)
        if loc.count() > 0:
            try:
                if loc.first.is_visible():
                    return True
            except Exception:
                pass
    return False


def _dismiss_upsell_modal(page) -> None:
    """Dismiss Premium upsell modal."""
    close_selectors = [
        'button[data-test-modal-close-btn]',
        'button[aria-label="Dismiss"]',
        'button[aria-label="Close"]',
    ]
    for selector in close_selectors:
        loc = page.locator(selector)
        if loc.count() > 0:
            try:
                loc.first.click(force=True)
                page.wait_for_timeout(500)
                return
            except Exception:
                continue
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)


def _get_top_card(page, logs: List[str]):
    """Get profile top card using fallback selectors."""
    return _try_selectors(page, TOP_CARD_SELECTORS, logs, "top card")


def check_connection_status(
    session: "LinkedInSession",
    profile_url: str,
    logs: List[str],
) -> str:
    """
    Navigate to profile, detect connection state using UI inspection.

    Returns: 'connected' | 'pending' | 'not_connected'
    """
    session.ensure_browser()
    page = session.page

    _log(logs, f"Checking connection status: {profile_url}")

    try:
        goto_page(
            session,
            action=lambda: page.goto(profile_url),
            expected_url_pattern="/in/",
            timeout=30_000,
            error_message="Failed to navigate to profile",
        )
    except Exception as exc:
        _log(logs, f"Navigation failed: {exc}")
        return "not_connected"

    page.wait_for_timeout(1000)

    top_card = _get_top_card(page, logs)
    if not top_card:
        _log(logs, "Could not find profile top card")
        return "not_connected"

    try:
        main_text = top_card.inner_text()
    except Exception:
        main_text = ""

    # Check for pending invitation
    pending_btn = top_card.locator('button[aria-label*="Pending"]:visible')
    if pending_btn.count() > 0:
        _log(logs, "Detected 'Pending' button - connection pending")
        return "pending"

    if "Pending" in main_text:
        _log(logs, "Detected 'Pending' text - connection pending")
        return "pending"

    # Check for connected (1st degree)
    if any(indicator in main_text for indicator in ["1st", "1st degree", "1º", "1er"]):
        _log(logs, "Detected 1st degree connection - connected")
        return "connected"

    # Check for Connect button (not connected)
    connect_btn = top_card.locator('button[aria-label*="Invite"][aria-label*="to connect"]:visible')
    if connect_btn.count() > 0:
        _log(logs, "Detected 'Connect' button - not connected")
        return "not_connected"

    if "Connect" in main_text:
        _log(logs, "Detected 'Connect' text - not connected")
        return "not_connected"

    _log(logs, "No clear connection indicators - defaulting to not_connected")
    return "not_connected"


def fetch_conversation(
    session: "LinkedInSession",
    profile_url: str,
    logs: List[str],
    skip_connection_check: bool = False,
) -> Dict[str, Any]:
    """
    Fetch conversation history from LinkedIn.

    1. Navigate to profile
    2. Click Message button (same popup flow we use)
    3. If Premium upsell appears, return status='upsell_blocked'
    4. If no thread exists, return status='no_history'
    5. Scrape messages from DOM
    6. Return structured conversation

    Returns:
        {
            'status': 'success' | 'upsell_blocked' | 'no_history' | 'not_connected' | 'error',
            'messages': [...],
            'connection_status': 'connected' | 'pending' | 'not_connected',
            'error': str | None
        }
    """
    session.ensure_browser()
    page = session.page

    result = {
        'status': 'error',
        'messages': [],
        'connection_status': 'not_connected',
        'error': None,
    }

    # First check connection status (optional)
    if skip_connection_check:
        connection_status = 'connected'
        result['connection_status'] = connection_status
        _log(logs, "Skipping connection status check (message_sent status)")
    else:
        connection_status = check_connection_status(session, profile_url, logs)
        result['connection_status'] = connection_status

        if connection_status != 'connected':
            _log(logs, f"Not connected ({connection_status}) - no conversation history available")
            result['status'] = 'no_history'
            return result

    # Navigate to profile and open message popup
    _log(logs, f"Fetching conversation: {profile_url}")

    try:
        goto_page(
            session,
            action=lambda: page.goto(profile_url),
            expected_url_pattern="/in/",
            timeout=30_000,
            error_message="Failed to navigate to profile",
        )
    except Exception as exc:
        _log(logs, f"Navigation failed: {exc}")
        result['error'] = str(exc)
        return result

    # Click Message button
    page.wait_for_timeout(1000)

    message_btn = _try_selectors(page, MESSAGE_BUTTON_SELECTORS, logs, "message button")
    if not message_btn:
        _log(logs, "Message button not found")
        result['status'] = 'no_history'
        return result

    # Wait for button to be enabled
    for _ in range(20):
        try:
            if not message_btn.is_disabled():
                break
        except Exception:
            pass
        page.wait_for_timeout(250)

    try:
        message_btn.click()
        _log(logs, "Clicked message button")
    except Exception as exc:
        _log(logs, f"Failed to click message button: {exc}")
        result['error'] = str(exc)
        return result

    # Wait for message popup or upsell
    page.wait_for_timeout(2000)

    if _is_upsell_modal(page):
        _log(logs, "Premium upsell detected")
        _dismiss_upsell_modal(page)
        result['status'] = 'upsell_blocked'
        result['error'] = 'LinkedIn Premium required to message this user'
        return result

    # Look for message thread
    thread_container = _try_selectors(page, THREAD_CONTAINER_SELECTORS, logs, "thread container")
    if not thread_container:
        _log(logs, "No message thread found - may be new conversation")
        result['status'] = 'no_history'
        return result

    # Scrape messages
    messages = _scrape_messages(page, logs)
    result['messages'] = messages
    result['status'] = 'success'

    _log(logs, f"Scraped {len(messages)} messages")

    # Close the popup
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)

    return result


def _scrape_messages(page, logs: List[str]) -> List[Dict[str, Any]]:
    """Scrape messages from the open message thread."""
    messages = []

    # Find all message items
    for selector in MESSAGE_ITEM_SELECTORS:
        items = page.locator(selector)
        if items.count() > 0:
            _log(logs, f"Found {items.count()} message items with selector: {selector}")
            break
    else:
        _log(logs, "No message items found")
        return messages

    # Get the user's own name to determine sender
    # We'll infer this from the conversation - messages from "you" vs others
    # LinkedIn typically shows sender name only for received messages

    for i in range(items.count()):
        try:
            item = items.nth(i)

            # Get message content
            content = None
            for content_selector in MESSAGE_CONTENT_SELECTORS:
                content_el = item.locator(content_selector)
                if content_el.count() > 0:
                    content = content_el.first.inner_text().strip()
                    break

            if not content:
                continue

            # Determine sender: LinkedIn marks incoming messages with --other on the inner event item
            sender = 'user'
            try:
                other_marker = item.locator('.msg-s-event-listitem--other')
                if other_marker.count() > 0:
                    sender = 'candidate'
            except Exception:
                pass

            # Fallback: only treat as "user" if heading explicitly says "you"
            if sender == 'user':
                heading = item.locator('span.msg-s-event-listitem--group-a11y-heading')
                if heading.count() > 0:
                    try:
                        heading_text = heading.first.inner_text().strip().lower()
                        if heading_text.startswith("you ") or " you sent " in heading_text or "you sent the following" in heading_text:
                            sender = 'user'
                    except Exception:
                        pass

            # Try to get timestamp
            timestamp = None
            for ts_selector in TIMESTAMP_SELECTORS:
                ts_el = item.locator(ts_selector)
                if ts_el.count() > 0:
                    timestamp = ts_el.first.get_attribute('datetime') or ts_el.first.inner_text().strip()
                    break

            messages.append({
                'sender': sender,
                'content': content,
                'timestamp': timestamp or datetime.utcnow().isoformat(),
            })

        except Exception as exc:
            _log(logs, f"Error scraping message {i}: {exc}")
            continue

    return messages


def send_reply(
    session: "LinkedInSession",
    profile_url: str,
    message: str,
    logs: List[str],
) -> bool:
    """
    Send a reply message to an existing conversation.
    Reuses the message popup flow.

    Returns: True if successful, False otherwise
    """
    session.ensure_browser()
    page = session.page

    _log(logs, f"Sending reply to: {profile_url}")

    # Navigate to profile
    try:
        goto_page(
            session,
            action=lambda: page.goto(profile_url),
            expected_url_pattern="/in/",
            timeout=30_000,
            error_message="Failed to navigate to profile",
        )
    except Exception as exc:
        _log(logs, f"Navigation failed: {exc}")
        return False

    page.wait_for_timeout(1000)

    # Click Message button
    message_btn = _try_selectors(page, MESSAGE_BUTTON_SELECTORS, logs, "message button")
    if not message_btn:
        _log(logs, "Message button not found")
        return False

    # Wait for button to be enabled
    for _ in range(20):
        try:
            if not message_btn.is_disabled():
                break
        except Exception:
            pass
        page.wait_for_timeout(250)

    try:
        message_btn.click()
        _log(logs, "Clicked message button")
    except Exception as exc:
        _log(logs, f"Failed to click message button: {exc}")
        return False

    page.wait_for_timeout(2000)

    # Check for upsell
    if _is_upsell_modal(page):
        _log(logs, "Premium upsell detected - cannot send reply")
        _dismiss_upsell_modal(page)
        return False

    # Find input area
    input_area = _try_selectors(page, MESSAGE_INPUT_SELECTORS, logs, "message input")
    if not input_area:
        _log(logs, "Message input not found")
        return False

    # Type message
    try:
        input_area.scroll_into_view_if_needed()
        input_area.fill(message, timeout=10_000)
        _log(logs, "Message typed")
    except Exception:
        _log(logs, "fill() failed; using clipboard paste")
        try:
            import json
            input_area.click(force=True)
            page.evaluate(f"() => navigator.clipboard.writeText({json.dumps(message)})")
            input_area.press("ControlOrMeta+V")
        except Exception as exc:
            _log(logs, f"Clipboard paste failed: {exc}")
            return False

    # Click send
    send_btn = page.locator('button[type="submit"][class*="msg-form"]:visible').first
    page.wait_for_timeout(1000)

    try:
        send_btn.click(force=True)
        _log(logs, "Reply sent")
    except Exception as exc:
        _log(logs, f"Failed to click send: {exc}")
        return False

    page.wait_for_timeout(2000)

    # Close popup
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)

    return True
