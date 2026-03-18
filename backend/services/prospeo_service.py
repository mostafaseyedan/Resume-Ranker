"""
Prospeo Email Finder Service

Given a LinkedIn profile URL, looks up the candidate's verified email address
using the Prospeo LinkedIn Email Finder API.
"""

import logging
import os
import requests
from typing import Optional

logger = logging.getLogger(__name__)

PROSPEO_API_URL = "https://api.prospeo.io/enrich-person"


class ProspeoService:
    def __init__(self):
        self.api_key = os.getenv("PROSPEO_API_KEY")
        if not self.api_key:
            raise ValueError("PROSPEO_API_KEY environment variable is required")

    def find_email(self, linkedin_url: str) -> dict:
        """
        Find a verified email for a LinkedIn profile URL.

        Returns:
            {
                "success": bool,
                "email": str | None,
                "confidence_score": int | None,   # 0-100
                "error": str | None
            }
        """
        if not linkedin_url or not linkedin_url.strip():
            return {"success": False, "email": None, "confidence_score": None, "error": "No LinkedIn URL provided"}

        try:
            response = requests.post(
                PROSPEO_API_URL,
                json={
                    "only_verified_email": True,
                    "enrich_mobile": False,
                    "data": {"linkedin_url": linkedin_url.strip()},
                },
                headers={
                    "X-KEY": self.api_key,
                    "Content-Type": "application/json",
                },
                timeout=15,
            )

            data = None
            try:
                data = response.json()
            except Exception:
                pass

            if response.status_code not in (200, 400) or data is None:
                logger.warning("Prospeo API error %s for %s: %s", response.status_code, linkedin_url, response.text[:200])
                return {
                    "success": False,
                    "email": None,
                    "confidence_score": None,
                    "error": f"Prospeo API returned {response.status_code}",
                }

            if data.get("error"):
                error_code = data.get("error_code") or "UNKNOWN"
                logger.info("Prospeo no match for %s: %s", linkedin_url, error_code)
                return {"success": False, "email": None, "confidence_score": None, "error": error_code}

            email_obj = (data.get("person") or {}).get("email") or {}
            email_value = email_obj.get("email") or None
            confidence = email_obj.get("status") or None  # e.g. "VERIFIED"

            if not email_value:
                logger.info("No email found by Prospeo for %s", linkedin_url)
                return {"success": False, "email": None, "confidence_score": None, "error": "Email not found"}

            logger.info("Prospeo found email for %s (status=%s)", linkedin_url, confidence)
            return {
                "success": True,
                "email": email_value,
                "confidence_score": confidence,
                "error": None,
            }

        except requests.RequestException as e:
            logger.error("Prospeo request failed for %s: %s", linkedin_url, e)
            return {"success": False, "email": None, "confidence_score": None, "error": str(e)}
        except Exception as e:
            logger.error("Prospeo unexpected error for %s: %s", linkedin_url, e)
            return {"success": False, "email": None, "confidence_score": None, "error": str(e)}
