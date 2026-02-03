# Adapted from OpenOutreach (Playwright navigation helpers).
from __future__ import annotations

from urllib.parse import unquote

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError


def goto_page(
    session: "LinkedInSession",
    action,
    expected_url_pattern: str,
    timeout: int = 10_000,
    error_message: str = "",
) -> None:
    page = session.page
    action()
    if not page:
        return

    try:
        page.wait_for_url(lambda url: expected_url_pattern in unquote(url), timeout=timeout)
    except PlaywrightTimeoutError:
        pass

    page.wait_for_load_state("load")
    current = unquote(page.url)
    if expected_url_pattern not in current:
        raise RuntimeError(f"{error_message} -> expected '{expected_url_pattern}' | got '{current}'")
