# Adapted from OpenOutreach (Playwright login/session bootstrap).
from __future__ import annotations

import logging
from pathlib import Path

from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

from .utils import goto_page
from .state_store import download_storage_state, upload_storage_state

logger = logging.getLogger(__name__)

LINKEDIN_LOGIN_URL = "https://www.linkedin.com/login"
LINKEDIN_FEED_URL = "https://www.linkedin.com/feed/"

SELECTORS = {
    "email": 'input#username',
    "password": 'input#password',
    "submit": 'button[type="submit"]',
}

AUTHWALL_SELECTORS = {
    "join_form": "form.join-form",
    "sign_in_toggle": "button.authwall-join-form__form-toggle--bottom, button.form-toggle",
    "signin_form": "form[data-id='sign-in-form'], form.authwall-sign-in-form__body",
    "signin_email": "input#session_key",
    "signin_password": "input#session_password",
    "signin_submit": "button[data-id='sign-in-form__submit-btn'], button.sign-in-form__submit-btn",
}


def build_playwright(headless: bool = False, slow_mo: int = 200, storage_state: str | None = None):
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(headless=headless, slow_mo=slow_mo)
    context = browser.new_context(storage_state=storage_state)
    Stealth().apply_stealth_sync(context)
    page = context.new_page()
    return page, context, browser, playwright


def _is_authwall(page) -> bool:
    return (
        page.locator(AUTHWALL_SELECTORS["join_form"]).count() > 0
        or page.locator(AUTHWALL_SELECTORS["signin_form"]).count() > 0
    )


def _wait_for_post_login(page, timeout: int = 40_000) -> None:
    page.wait_for_url(
        lambda url: "/feed" in url or "/in/" in url or "/checkpoint" in url,
        timeout=timeout,
    )
    current = page.url
    if "/checkpoint" in current:
        raise RuntimeError(
            "Login failed - LinkedIn checkpoint challenge detected"
        )
    if "/feed" not in current and "/in/" not in current:
        raise RuntimeError(
            f"Login failed - no redirect to feed/profile (got '{current}')"
        )


def playwright_login(session: "LinkedInSession") -> None:
    page = session.page
    logger.info("LinkedIn login sequence starting")

    page.goto(LINKEDIN_LOGIN_URL)
    page.wait_for_load_state("load")

    if _is_authwall(page):
        toggle = page.locator(AUTHWALL_SELECTORS["sign_in_toggle"])
        if toggle.count() > 0:
            toggle.first.click()
            page.wait_for_timeout(500)

        if page.locator(AUTHWALL_SELECTORS["signin_form"]).count() > 0:
            page.locator(AUTHWALL_SELECTORS["signin_email"]).fill(session.credentials.username)
            page.locator(AUTHWALL_SELECTORS["signin_password"]).fill(session.credentials.password)
            page.locator(AUTHWALL_SELECTORS["signin_submit"]).click()
            _wait_for_post_login(page)
            return

    if page.locator(SELECTORS["email"]).count() == 0:
        raise RuntimeError("Login failed - username input not found")

    page.locator(SELECTORS["email"]).type(session.credentials.username, delay=80)
    page.locator(SELECTORS["password"]).type(session.credentials.password, delay=80)
    page.locator(SELECTORS["submit"]).click()
    _wait_for_post_login(page)


def ensure_logged_in(session: "LinkedInSession") -> bool:
    page = session.page
    if not page:
        return False
    if _is_authwall(page):
        logger.info("Authwall detected, attempting login")
        playwright_login(session)
        return True
    return False


def init_playwright_session(session: "LinkedInSession") -> None:
    logger.info("Configuring Playwright browser")
    state_path = session.storage_state_path
    storage_state = None
    if state_path:
        download_storage_state(state_path)
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
                upload_storage_state(state_path)
    else:
        playwright_login(session)
        if state_path:
            state_path.parent.mkdir(parents=True, exist_ok=True)
            session.context.storage_state(path=str(state_path))
            upload_storage_state(state_path)
