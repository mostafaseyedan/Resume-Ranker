# Adapted from OpenOutreach (Playwright login/session bootstrap).
from __future__ import annotations

import logging
from pathlib import Path

from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

from .utils import goto_page

logger = logging.getLogger(__name__)

LINKEDIN_LOGIN_URL = "https://www.linkedin.com/login"
LINKEDIN_FEED_URL = "https://www.linkedin.com/feed/"

SELECTORS = {
    "email": 'input#username',
    "password": 'input#password',
    "submit": 'button[type="submit"]',
}


def build_playwright(headless: bool = False, slow_mo: int = 200, storage_state: str | None = None):
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(headless=headless, slow_mo=slow_mo)
    context = browser.new_context(storage_state=storage_state)
    Stealth().apply_stealth_sync(context)
    page = context.new_page()
    return page, context, browser, playwright


def playwright_login(session: "LinkedInSession") -> None:
    page = session.page
    logger.info("LinkedIn login sequence starting")

    goto_page(
        session,
        action=lambda: page.goto(LINKEDIN_LOGIN_URL),
        expected_url_pattern="/login",
        error_message="Failed to load login page",
    )

    page.locator(SELECTORS["email"]).type(session.credentials.username, delay=80)
    page.locator(SELECTORS["password"]).type(session.credentials.password, delay=80)

    goto_page(
        session,
        action=lambda: page.locator(SELECTORS["submit"]).click(),
        expected_url_pattern="/feed",
        timeout=40_000,
        error_message="Login failed - no redirect to feed",
    )


def init_playwright_session(session: "LinkedInSession") -> None:
    logger.info("Configuring Playwright browser")
    state_path = session.storage_state_path
    storage_state = None
    if state_path and state_path.exists():
        storage_state = str(state_path)
        logger.info("Using saved LinkedIn session state: %s", storage_state)

    session.page, session.context, session.browser, session.playwright = build_playwright(
        headless=session.headless,
        slow_mo=session.slow_mo,
        storage_state=storage_state,
    )

    if storage_state:
        try:
            goto_page(
                session,
                action=lambda: session.page.goto(LINKEDIN_FEED_URL),
                expected_url_pattern="/feed",
                timeout=30_000,
                error_message="Saved session invalid",
            )
        except Exception:
            logger.info("Saved session invalid, performing fresh login")
            playwright_login(session)
            if state_path:
                state_path.parent.mkdir(parents=True, exist_ok=True)
                session.context.storage_state(path=str(state_path))
    else:
        playwright_login(session)
        if state_path:
            state_path.parent.mkdir(parents=True, exist_ok=True)
            session.context.storage_state(path=str(state_path))
