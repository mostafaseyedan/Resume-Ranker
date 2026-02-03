# Storage helpers for LinkedIn session state (local or GCS).
from __future__ import annotations

import os
from pathlib import Path

from google.cloud import storage


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
