from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)


def _agent_url() -> Optional[str]:
    return os.getenv("LINKEDIN_AGENT_URL")


def _agent_token() -> Optional[str]:
    return os.getenv("LINKEDIN_AGENT_TOKEN") or os.getenv("AGENT_AUTH_TOKEN")


def is_enabled() -> bool:
    return bool(_agent_url())


def _headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    token = _agent_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _post(path: str, payload: Dict[str, Any], timeout: int = 180) -> Dict[str, Any]:
    base = _agent_url()
    if not base:
        raise RuntimeError("LINKEDIN_AGENT_URL is not configured")
    url = base.rstrip("/") + path
    resp = requests.post(url, json=payload, headers=_headers(), timeout=timeout)
    try:
        data = resp.json()
    except Exception:
        data = {"success": False, "error": f"Invalid agent response ({resp.status_code})"}
    if resp.status_code >= 400:
        error = data.get("error") or f"Agent request failed ({resp.status_code})"
        logger.error("Agent error %s: %s", resp.status_code, error)
        return {**data, "success": False, "error": error}
    return data


def reach_out(
    *,
    profile_url: str,
    message: str,
    full_name: str,
    username: str,
    password: str,
    session_key: str,
    headless: Optional[bool] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "profileUrl": profile_url,
        "message": message,
        "fullName": full_name,
        "username": username,
        "password": password,
        "sessionKey": session_key,
    }
    if headless is not None:
        payload["headless"] = headless
    return _post("/reach-out", payload)


def fetch_conversation(
    *,
    profile_url: str,
    username: str,
    password: str,
    session_key: str,
    skip_connection_check: bool = False,
    headless: Optional[bool] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "profileUrl": profile_url,
        "username": username,
        "password": password,
        "sessionKey": session_key,
        "skipConnectionCheck": skip_connection_check,
    }
    if headless is not None:
        payload["headless"] = headless
    return _post("/conversation", payload)


def send_reply(
    *,
    profile_url: str,
    message: str,
    username: str,
    password: str,
    session_key: str,
    headless: Optional[bool] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "profileUrl": profile_url,
        "message": message,
        "username": username,
        "password": password,
        "sessionKey": session_key,
    }
    if headless is not None:
        payload["headless"] = headless
    return _post("/reply", payload)


def check_connection(
    *,
    profile_url: str,
    username: str,
    password: str,
    session_key: str,
    headless: Optional[bool] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "profileUrl": profile_url,
        "username": username,
        "password": password,
        "sessionKey": session_key,
    }
    if headless is not None:
        payload["headless"] = headless
    return _post("/check-connection", payload)
