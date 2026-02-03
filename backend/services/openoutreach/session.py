# Adapted from OpenOutreach (session wrapper).
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
import re

from .login import init_playwright_session

logger = logging.getLogger(__name__)


@dataclass
class LinkedInCredentials:
    username: str
    password: str


class LinkedInSession:
    def __init__(
        self,
        credentials: LinkedInCredentials,
        headless: bool = False,
        slow_mo: int = 200,
        storage_state_path: Path | None = None,
    ):
        self.credentials = credentials
        self.headless = headless
        self.slow_mo = slow_mo
        self.storage_state_path = storage_state_path

        self.page = None
        self.context = None
        self.browser = None
        self.playwright = None

    def ensure_browser(self) -> None:
        if not self.page or self.page.is_closed():
            logger.info("Launching LinkedIn browser session")
            init_playwright_session(self)

    def close(self) -> None:
        if self.context:
            try:
                self.context.close()
            except Exception as exc:
                logger.debug("Error closing browser context: %s", exc)
        if self.browser:
            try:
                self.browser.close()
            except Exception as exc:
                logger.debug("Error closing browser: %s", exc)
        if self.playwright:
            try:
                self.playwright.stop()
            except Exception as exc:
                logger.debug("Error stopping Playwright: %s", exc)

        self.page = None
        self.context = None
        self.browser = None
        self.playwright = None

    @staticmethod
    def build_storage_state_path(identifier: str) -> Path:
        safe = re.sub(r"[^a-zA-Z0-9_.-]+", "_", identifier).strip("_")
        base = Path(__file__).resolve().parent / "state"
        base.mkdir(parents=True, exist_ok=True)
        return base / f"{safe}.json"
