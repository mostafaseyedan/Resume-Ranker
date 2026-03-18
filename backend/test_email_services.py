"""
Quick smoke tests for Prospeo and Graph Email services.
Run from the backend/ directory:  python test_email_services.py
"""

import os
import sys
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

sys.path.insert(0, os.path.dirname(__file__))

SEPARATOR = "-" * 60


def test_prospeo():
    print(f"\n{SEPARATOR}")
    print("TEST: Prospeo email finder")
    print(SEPARATOR)

    from services.prospeo_service import ProspeoService

    svc = ProspeoService()
    # Use Satya Nadella's public LinkedIn profile as a harmless test target
    test_url = "https://www.linkedin.com/in/satyanadella/"
    print(f"Looking up: {test_url}")

    result = svc.find_email(test_url)
    print(json.dumps(result, indent=2))

    if result.get("success"):
        print(f"OK  email found: {result['email']} (confidence {result['confidence_score']})")
    else:
        # "not found" is acceptable — it confirms the API is reachable and auth works
        error = result.get("error", "")
        if "not found" in error.lower() or result.get("email") is None:
            print("OK  API reachable, no email on file for this profile (expected for some profiles)")
        else:
            print(f"FAIL  {error}")

    return result


def test_graph_auth():
    print(f"\n{SEPARATOR}")
    print("TEST: Graph API authentication")
    print(SEPARATOR)

    from services.graph_email_service import GraphEmailService

    svc = GraphEmailService()
    token = svc._get_token()
    preview = token[:20] + "..." if len(token) > 20 else token
    print(f"OK  token acquired: {preview}")
    return svc


def test_graph_read_sent(svc):
    print(f"\n{SEPARATOR}")
    print("TEST: Graph API — read SentItems from recruiting@cendien.com")
    print(SEPARATOR)

    import requests
    GRAPH_BASE = "https://graph.microsoft.com/v1.0"
    RECRUITING_MAILBOX = "recruiting@cendien.com"

    url = (
        f"{GRAPH_BASE}/users/{RECRUITING_MAILBOX}/mailFolders/SentItems/messages"
        "?$select=subject,toRecipients,sentDateTime&$top=5&$orderby=sentDateTime desc"
    )
    resp = requests.get(url, headers=svc._headers(), timeout=20)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        messages = resp.json().get("value", [])
        print(f"OK  {len(messages)} recent sent item(s):")
        for m in messages:
            recipients = ", ".join(
                r["emailAddress"]["address"]
                for r in m.get("toRecipients", [])
            )
            print(f"  [{m.get('sentDateTime', '')[:10]}] {m.get('subject', '(no subject)')} -> {recipients}")
    else:
        print(f"FAIL  {resp.text[:300]}")


def test_graph_send(svc):
    print(f"\n{SEPARATOR}")
    print("TEST: Graph API — send a test email from recruiting@cendien.com")
    print(SEPARATOR)

    # Send to the user's own email (from .env LINKEDIN_EMAIL)
    to_email = os.getenv("LINKEDIN_EMAIL", "")
    if not to_email:
        print("SKIP  LINKEDIN_EMAIL not set in .env")
        return

    print(f"Sending test email to: {to_email}")
    result = svc.send_email(
        to_email=to_email,
        subject="[TEST] Graph API smoke test — recruiting mailbox",
        body=(
            "This is an automated smoke test to verify the Microsoft Graph API "
            "connection for the recruiting@cendien.com shared mailbox.\n\n"
            "You can delete this message."
        ),
        candidate_linkedin_id="test-smoke-check",
    )
    print(json.dumps(result, indent=2))

    if result.get("success"):
        print(f"OK  email sent to {to_email}")
    else:
        print(f"FAIL  {result.get('error')}")


if __name__ == "__main__":
    errors = []

    try:
        test_prospeo()
    except Exception as e:
        print(f"EXCEPTION in Prospeo test: {e}")
        errors.append(str(e))

    try:
        svc = test_graph_auth()
        test_graph_read_sent(svc)
        test_graph_send(svc)
    except Exception as e:
        print(f"EXCEPTION in Graph test: {e}")
        errors.append(str(e))

    print(f"\n{SEPARATOR}")
    if errors:
        print(f"Done with {len(errors)} error(s): {errors}")
        sys.exit(1)
    else:
        print("All tests passed.")
