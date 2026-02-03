# Adapted from OpenOutreach (session wrapper).
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
import re

from google.cloud import storage

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
        state_dir = os.getenv("LINKEDIN_STATE_DIR")
        if not state_dir:
            if os.getenv("LINKEDIN_STATE_BUCKET"):
                state_dir = "/tmp/openoutreach/state"
            else:
                state_dir = str(Path(__file__).resolve().parent / "state")
        base = Path(state_dir)
        base.mkdir(parents=True, exist_ok=True)
        return base / f"{safe}.json"


def _get_state_bucket():
    bucket_name = os.getenv("LINKEDIN_STATE_BUCKET")
    if not bucket_name:
        return None
    client = storage.Client()
    return client.bucket(bucket_name)


def _state_blob_name(state_path: Path) -> str:
    prefix = os.getenv("LINKEDIN_STATE_PREFIX", "linkedin_state")
    return f"{prefix}/{state_path.name}"


def download_storage_state(state_path: Path) -> bool:
    """Download storage state JSON from GCS if configured."""
    bucket = _get_state_bucket()
    if not bucket:
        return state_path.exists()
    if state_path.exists():
        return True
    blob = bucket.blob(_state_blob_name(state_path))
    if not blob.exists():
        return False
    state_path.parent.mkdir(parents=True, exist_ok=True)
    blob.download_to_filename(str(state_path))
    return True


def upload_storage_state(state_path: Path) -> None:
    """Upload storage state JSON to GCS if configured."""
    bucket = _get_state_bucket()
    if not bucket:
        return
    if not state_path.exists():
        return
    blob = bucket.blob(_state_blob_name(state_path))
    blob.upload_from_filename(str(state_path), content_type="application/json")
