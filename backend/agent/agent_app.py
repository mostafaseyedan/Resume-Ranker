from __future__ import annotations

import logging
import os
import sys
from typing import Any, Dict

from dotenv import load_dotenv
from flask import Flask, jsonify, request

# Ensure backend package imports work when running from repo root or backend dir.
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Load shared env
load_dotenv(dotenv_path=os.path.join(BASE_DIR, '..', '.env'))

LOG_PROXY_URL = os.getenv("LINKEDIN_AGENT_LOG_PROXY_URL", "").strip()
logging.basicConfig(level=logging.INFO)

from services.openoutreach.session import LinkedInCredentials, LinkedInSession
from services.openoutreach.message import send_message_to_profile
from services.openoutreach.conversation import (
    fetch_conversation,
    send_reply,
    check_connection_status,
)

logger = logging.getLogger("linkedin_agent")

if LOG_PROXY_URL:
    try:
        import requests

        class AgentLogProxyHandler(logging.Handler):
            def emit(self, record: logging.LogRecord) -> None:
                try:
                    token = os.getenv("LINKEDIN_AGENT_TOKEN") or os.getenv("AGENT_AUTH_TOKEN")
                    headers = {"Content-Type": "application/json"}
                    if token:
                        headers["Authorization"] = f"Bearer {token}"
                    payload = {
                        "level": record.levelname,
                        "message": record.getMessage(),
                        "logger": record.name,
                    }
                    requests.post(LOG_PROXY_URL, json=payload, headers=headers, timeout=2)
                except Exception:
                    pass

        proxy_handler = AgentLogProxyHandler()
        proxy_handler.setLevel(logging.INFO)
        logging.getLogger().addHandler(proxy_handler)
        logger.info("Agent log proxy enabled -> %s", LOG_PROXY_URL)
    except Exception as exc:
        logger.warning("Agent log proxy init failed: %s", exc)

app = Flask(__name__)

AGENT_TOKEN = os.getenv("AGENT_AUTH_TOKEN") or os.getenv("LINKEDIN_AGENT_TOKEN")
DEFAULT_HEADLESS = os.getenv("AGENT_HEADLESS", "false").lower() == "true"


def _authorized(req) -> bool:
    if not AGENT_TOKEN:
        return True
    auth = (req.headers.get("Authorization") or "").strip()
    if auth == f"Bearer {AGENT_TOKEN}":
        return True
    if (req.headers.get("X-Agent-Token") or "").strip() == AGENT_TOKEN:
        return True
    return False


def _require_auth():
    if not _authorized(request):
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    return None


def _build_session(payload: Dict[str, Any]) -> LinkedInSession:
    username = (payload.get("username") or "").strip()
    password = (payload.get("password") or "").strip()
    session_key = (payload.get("sessionKey") or f"local:{username}").strip()
    if not username or not password:
        raise ValueError("LinkedIn credentials required")

    storage_state_path = LinkedInSession.build_storage_state_path(session_key)
    headless = payload.get("headless")
    if isinstance(headless, bool):
        use_headless = headless
    else:
        use_headless = DEFAULT_HEADLESS

    return LinkedInSession(
        credentials=LinkedInCredentials(username=username, password=password),
        headless=use_headless,
        storage_state_path=storage_state_path,
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


@app.route("/reach-out", methods=["POST"])
def reach_out():
    auth = _require_auth()
    if auth:
        return auth

    payload = request.get_json(silent=True) or {}
    profile_url = (payload.get("profileUrl") or "").strip()
    message = (payload.get("message") or "").strip()
    full_name = (payload.get("fullName") or "").strip() or "there"

    if not profile_url:
        return jsonify({"success": False, "error": "profileUrl is required"}), 400
    if not message:
        return jsonify({"success": False, "error": "message is required"}), 400

    session = _build_session(payload)
    logs = []
    try:
        action = send_message_to_profile(
            session=session,
            profile_url=profile_url,
            full_name=full_name,
            message=message,
            logs=logs,
        )
        success = action in ("message", "connect")
        return jsonify({
            "success": success,
            "action": action,
            "logs": logs,
            "error": None if success else "Message sending failed",
        })
    except Exception as exc:
        logger.exception("Agent reach-out failed")
        return jsonify({"success": False, "logs": logs, "error": str(exc)}), 500
    finally:
        session.close()


@app.route("/conversation", methods=["POST"])
def conversation():
    auth = _require_auth()
    if auth:
        return auth

    payload = request.get_json(silent=True) or {}
    profile_url = (payload.get("profileUrl") or "").strip()
    skip_connection_check = bool(payload.get("skipConnectionCheck"))

    if not profile_url:
        return jsonify({"success": False, "error": "profileUrl is required"}), 400

    session = _build_session(payload)
    logs = []
    try:
        result = fetch_conversation(
            session=session,
            profile_url=profile_url,
            logs=logs,
            skip_connection_check=skip_connection_check,
        )
        return jsonify({
            "success": result.get("status") == "success",
            "status": result.get("status"),
            "messages": result.get("messages", []),
            "connection_status": result.get("connection_status"),
            "logs": logs,
            "error": result.get("error"),
        })
    except Exception as exc:
        logger.exception("Agent conversation failed")
        return jsonify({"success": False, "logs": logs, "error": str(exc)}), 500
    finally:
        session.close()


@app.route("/reply", methods=["POST"])
def reply():
    auth = _require_auth()
    if auth:
        return auth

    payload = request.get_json(silent=True) or {}
    profile_url = (payload.get("profileUrl") or "").strip()
    message = (payload.get("message") or "").strip()

    if not profile_url:
        return jsonify({"success": False, "error": "profileUrl is required"}), 400
    if not message:
        return jsonify({"success": False, "error": "message is required"}), 400

    session = _build_session(payload)
    logs = []
    try:
        success = send_reply(session, profile_url, message, logs)
        return jsonify({
            "success": success,
            "logs": logs,
            "error": None if success else "Failed to send reply",
        })
    except Exception as exc:
        logger.exception("Agent reply failed")
        return jsonify({"success": False, "logs": logs, "error": str(exc)}), 500
    finally:
        session.close()


@app.route("/check-connection", methods=["POST"])
def check_connection():
    auth = _require_auth()
    if auth:
        return auth

    payload = request.get_json(silent=True) or {}
    profile_url = (payload.get("profileUrl") or "").strip()

    if not profile_url:
        return jsonify({"success": False, "error": "profileUrl is required"}), 400

    session = _build_session(payload)
    logs = []
    try:
        status = check_connection_status(session, profile_url, logs)
        return jsonify({
            "success": True,
            "connection_status": status,
            "logs": logs,
        })
    except Exception as exc:
        logger.exception("Agent check-connection failed")
        return jsonify({"success": False, "logs": logs, "error": str(exc)}), 500
    finally:
        session.close()


if __name__ == "__main__":
    port = int(os.getenv("AGENT_PORT", "9777"))
    app.run(host="0.0.0.0", port=port)
