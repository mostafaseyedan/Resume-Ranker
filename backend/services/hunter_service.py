"""
Hunter.io Email Finder & Verifier Service

Finds a candidate's work email using the Hunter.io Email Finder API,
then verifies deliverability via the Email Verifier API.
Used as a fallback when Prospeo returns no match.

Company must be supplied by the caller (sourced from Tavily profile enrichment).
"""

import logging
import os
import re
import time
import requests
from typing import Optional

logger = logging.getLogger(__name__)

HUNTER_EMAIL_FINDER_URL = "https://api.hunter.io/v2/email-finder"
HUNTER_EMAIL_VERIFIER_URL = "https://api.hunter.io/v2/email-verifier"

_SENDABLE_STATUSES = {"valid", "accept_all", "webmail"}

# Values that appear in LinkedIn profile headers but are not company names
_INVALID_COMPANY_VALUES = re.compile(
    r"\b(confidential|n/a|independent|consulting|freelance|self.employed|"
    r"open to work|looking for|available|retired|volunteer)\b",
    re.IGNORECASE,
)


def extract_company_from_profile(profile_text: str) -> Optional[str]:
    """
    Extract the current employer from a Tavily-enriched LinkedIn profile summary.

    Tavily returns profiles in markdown with the employer on the second line:
        # Candidate Name
        **Employer Name**
        Location

    Falls back to scanning for "at <Company>" patterns in the body text.
    """
    if not profile_text:
        return None

    # Primary: markdown profile header "**Company**" on the line after the name
    match = re.search(r"^#.+\n\*\*([^\*\n]+)\*\*", profile_text, re.MULTILINE)
    if match:
        candidate = match.group(1).strip()
        if (
            candidate
            and len(candidate) <= 60                                    # real company names are short
            and "|" not in candidate                                    # skills lists use pipes
            and not _INVALID_COMPANY_VALUES.search(candidate)          # not a freelance/N/A phrase
            and not re.search(r"\b(india|usa|uk|united states|canada|australia|remote)\b", candidate, re.IGNORECASE)
        ):
            return candidate

    # Fallback: "at <Company>" pattern in profile body
    stop = r"(?=\s+(?:working|as\b|since|from|–|—|\(|\band\b)|[,·|\n]|$)"
    match = re.search(r"\bat\s+([A-Z][A-Za-z0-9 &.,']{1,40}?)" + stop, profile_text)
    if match:
        return match.group(1).strip()

    return None


def parse_name(full_name: str) -> tuple[Optional[str], Optional[str]]:
    """Split a full name into (first_name, last_name). Returns (None, None) if unparseable."""
    if not full_name:
        return None, None
    parts = full_name.strip().split()
    if len(parts) < 2:
        return None, None
    return parts[0], parts[-1]


class HunterService:
    def __init__(self):
        self.api_key = os.getenv("HUNTER_API_KEY")
        if not self.api_key:
            raise ValueError("HUNTER_API_KEY environment variable is required")

    def find_email(self, name: str, company: str) -> dict:
        """
        Find and verify a work email for a candidate.

        Args:
            name:    Full name (e.g. "Ravali Gangineni")
            company: Current employer (e.g. "T. Rowe Price") — sourced from Tavily

        Returns:
            {
                "success": bool,
                "email": str | None,
                "confidence_score": int | None,
                "error": str | None
            }
        """
        first_name, last_name = parse_name(name)
        if not first_name or not last_name:
            return {"success": False, "email": None, "confidence_score": None, "error": "Could not parse candidate name"}

        if not company or not company.strip():
            return {"success": False, "email": None, "confidence_score": None, "error": "No company provided"}

        try:
            response = requests.get(
                HUNTER_EMAIL_FINDER_URL,
                params={
                    "first_name": first_name,
                    "last_name": last_name,
                    "company": company.strip(),
                    "api_key": self.api_key,
                },
                timeout=15,
            )

            data = None
            try:
                data = response.json()
            except Exception:
                pass

            if data is None:
                return {"success": False, "email": None, "confidence_score": None, "error": f"Hunter API returned {response.status_code}"}

            if response.status_code not in (200, 404):
                errors = data.get("errors") or []
                detail = errors[0].get("details") if errors else f"HTTP {response.status_code}"
                logger.warning("Hunter API error for %s @ %s: %s", name, company, detail)
                return {"success": False, "email": None, "confidence_score": None, "error": detail}

            email_value = (data.get("data") or {}).get("email") or None
            score = (data.get("data") or {}).get("score") or None

            if not email_value:
                logger.info("Hunter no match for %s @ %s", name, company)
                return {"success": False, "email": None, "confidence_score": None, "error": "Email not found"}

            logger.info("Hunter found email for %s @ %s (score=%s) — verifying", name, company, score)
            verification = self.verify_email(email_value)
            if not verification.get("sendable"):
                logger.info("Hunter email %s rejected by verifier (status=%s)", email_value, verification.get("status"))
                return {"success": False, "email": None, "confidence_score": None, "error": f"Email failed verification: {verification.get('status')}"}

            return {
                "success": True,
                "email": email_value,
                "confidence_score": verification.get("score") or score,
                "error": None,
            }

        except requests.RequestException as e:
            logger.error("Hunter request failed for %s: %s", name, e)
            return {"success": False, "email": None, "confidence_score": None, "error": str(e)}
        except Exception as e:
            logger.error("Hunter unexpected error for %s: %s", name, e)
            return {"success": False, "email": None, "confidence_score": None, "error": str(e)}

    def verify_email(self, email: str) -> dict:
        """
        Verify the deliverability of an email address.
        Polls up to 3 times to handle the 202 async case.

        Returns:
            {
                "sendable": bool,
                "status": str | None,
                "score": int | None,
            }
        """
        for attempt in range(3):
            try:
                response = requests.get(
                    HUNTER_EMAIL_VERIFIER_URL,
                    params={"email": email, "api_key": self.api_key},
                    timeout=25,
                )

                if response.status_code == 202:
                    logger.info("Hunter verifier still processing %s (attempt %d) — retrying", email, attempt + 1)
                    time.sleep(3)
                    continue

                data = None
                try:
                    data = response.json()
                except Exception:
                    pass

                if response.status_code != 200 or data is None:
                    logger.warning("Hunter verifier error %s for %s", response.status_code, email)
                    return {"sendable": True, "status": "unknown", "score": None}

                d = data.get("data") or {}
                status = d.get("status") or "unknown"
                score = d.get("score")
                logger.info("Hunter verified %s: status=%s score=%s", email, status, score)
                return {"sendable": status in _SENDABLE_STATUSES, "status": status, "score": score}

            except Exception as e:
                logger.warning("Hunter verifier exception for %s: %s", email, e)
                return {"sendable": True, "status": "unknown", "score": None}

        logger.warning("Hunter verifier timed out for %s — allowing through", email)
        return {"sendable": True, "status": "unknown", "score": None}
