# Adapted from OpenOutreach (connection request flow).
from __future__ import annotations

import logging
from typing import List

logger = logging.getLogger(__name__)


def _log(logs: List[str], message: str) -> None:
    logs.append(message)
    logger.info(message)


def _get_top_card(page):
    selectors = [
        'section:has(div.top-card-background-hero-image)',
        'section[data-member-id]',
        'section.artdeco-card:has(> div.pv-top-card)',
        'section[data-member-id] >> div.pv-top-card',
        'section:has(> div[class*="pv-top-card"])',
        'section[componentkey*="com.linkedin.sdui.profile.card"]',
    ]
    for selector in selectors:
        loc = page.locator(selector)
        if loc.count() > 0:
            return loc.first
    return page


def attempt_connect(session: "LinkedInSession", logs: List[str]) -> bool:
    page = session.page
    try:
        top_card = _get_top_card(page)
        page.wait_for_timeout(500)

        direct = top_card.locator('button[aria-label*="Invite"][aria-label*="to connect"]:visible')
        if direct.count() > 0:
            direct.first.click()
            _log(logs, "Clicked direct Connect button")
        else:
            more = top_card.locator(
                'button[id*="overflow"]:visible, '
                'button[aria-label*="More actions"]:visible'
            )
            if more.count() == 0:
                _log(logs, "Connect button not found (no overflow menu)")
                return False
            more.first.click()
            page.wait_for_timeout(500)

            dropdown = page.locator('div.artdeco-dropdown__content--is-open:visible')
            connect_option = dropdown.locator(
                'div[role="button"][aria-label^="Invite"][aria-label*=" to connect"]'
            )
            if connect_option.count() == 0:
                connect_option = page.locator(
                    'div.artdeco-dropdown__content--is-open '
                    'div[role="button"][aria-label^="Invite"][aria-label*=" to connect"]'
                )
            if connect_option.count() == 0:
                _log(logs, "Connect option not found in overflow menu")
                return False
            connect_option.first.scroll_into_view_if_needed()
            connect_option.first.click(force=True)
            _log(logs, "Opened Connect via More menu")

        page.wait_for_timeout(500)
        send_btn = page.locator(
            'button:has-text("Send now"), '
            'button[aria-label*="Send without"], '
            'button[aria-label*="Send invitation"]:not([aria-label*="note"])'
        )
        if send_btn.count() == 0:
            _log(logs, "Send invitation button not found")
            return False

        send_btn.first.click(force=True)
        _log(logs, "Connection request sent")
        return True
    except Exception as exc:
        _log(logs, f"Connect attempt failed: {exc}")
        return False
