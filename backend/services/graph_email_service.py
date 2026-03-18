"""
Microsoft Graph Email Service

Sends outreach emails and fetches reply threads from the recruiting@cendien.com
shared mailbox using the Microsoft Graph API with client-credentials (app-only) auth.
"""

import logging
import os
from typing import Optional
import msal
import requests

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
RECRUITING_MAILBOX = "recruiting@cendien.com"
SCOPES = ["https://graph.microsoft.com/.default"]


class GraphEmailService:
    def __init__(self):
        self.client_id = os.getenv("AZURE_CLIENT_ID")
        self.client_secret = os.getenv("AZURE_CLIENT_SECRET")
        self.tenant_id = os.getenv("AZURE_TENANT_ID")
        if not all([self.client_id, self.client_secret, self.tenant_id]):
            raise ValueError("AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and AZURE_TENANT_ID are required")

        self._msal_app = msal.ConfidentialClientApplication(
            client_id=self.client_id,
            client_credential=self.client_secret,
            authority=f"https://login.microsoftonline.com/{self.tenant_id}",
        )

    def _get_token(self) -> str:
        result = self._msal_app.acquire_token_for_client(scopes=SCOPES)
        if "access_token" not in result:
            error = result.get("error_description") or result.get("error") or "Unknown auth error"
            raise RuntimeError(f"Failed to acquire Graph token: {error}")
        return result["access_token"]

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json",
        }

    def send_email(self, to_email: str, subject: str, body: str, candidate_linkedin_id: str) -> dict:
        """
        Send an outreach email from recruiting@cendien.com.

        We store the linkedinId in a custom internet header (X-Candidate-Id) so we
        can match replies back to the candidate later.

        Returns:
            {"success": bool, "message_id": str | None, "error": str | None}
        """
        payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "Text",
                    "content": body,
                },
                "toRecipients": [
                    {"emailAddress": {"address": to_email}}
                ],
                "internetMessageHeaders": [
                    {"name": "X-Candidate-Id", "value": candidate_linkedin_id}
                ],
            },
            "saveToSentItems": True,
        }

        try:
            response = requests.post(
                f"{GRAPH_BASE}/users/{RECRUITING_MAILBOX}/sendMail",
                headers=self._headers(),
                json=payload,
                timeout=20,
            )

            if response.status_code == 202:
                logger.info("Email sent to %s for candidate %s", to_email, candidate_linkedin_id)
                return {"success": True, "message_id": None, "error": None}

            logger.error("Graph sendMail failed %s: %s", response.status_code, response.text[:300])
            return {
                "success": False,
                "message_id": None,
                "error": f"Graph API error {response.status_code}: {response.text[:200]}",
            }

        except Exception as e:
            logger.error("Graph sendMail exception: %s", e)
            return {"success": False, "message_id": None, "error": str(e)}

    def get_thread(self, to_email: str) -> dict:
        """
        Fetch the email thread with a candidate (sent + received) from the recruiting mailbox.

        Searches the Sent Items for emails to the candidate and the Inbox for replies.

        Returns:
            {
                "success": bool,
                "messages": [{"direction": "sent"|"received", "subject": str, "body": str, "received_at": str}],
                "error": str | None
            }
        """
        try:
            # toRecipients lambda filters are not supported by Exchange via Graph —
            # fetch recent sent items unfiltered and match recipients in Python.
            all_sent = self._fetch_messages(folder="SentItems", filter_expr=None)
            to_email_lower = to_email.lower()
            logger.info("Thread lookup for %s — found %d sent items total", to_email, len(all_sent))
            for m in all_sent[:5]:
                recipients = [r.get("emailAddress", {}).get("address", "") for r in m.get("toRecipients", [])]
                logger.info("  sent item: subject=%r recipients=%s", m.get("subject", "")[:40], recipients)
            sent = [
                m for m in all_sent
                if any(
                    r.get("emailAddress", {}).get("address", "").lower() == to_email_lower
                    for r in m.get("toRecipients", [])
                )
            ]
            logger.info("Matched %d sent messages to %s", len(sent), to_email)

            received = self._fetch_messages(
                folder="Inbox",
                filter_expr=f"from/emailAddress/address eq '{to_email}'",
            )

            messages = []
            for msg in sent:
                messages.append({
                    "direction": "sent",
                    "subject": msg.get("subject", ""),
                    "body": msg.get("body", {}).get("content", ""),
                    "received_at": msg.get("sentDateTime", ""),
                })
            for msg in received:
                messages.append({
                    "direction": "received",
                    "subject": msg.get("subject", ""),
                    "body": msg.get("body", {}).get("content", ""),
                    "received_at": msg.get("receivedDateTime", ""),
                })

            # Sort chronologically
            messages.sort(key=lambda m: m["received_at"])

            return {"success": True, "messages": messages, "error": None}

        except Exception as e:
            logger.error("Graph get_thread exception for %s: %s", to_email, e)
            return {"success": False, "messages": [], "error": str(e)}

    def send_reply(self, to_email: str, subject: str, body: str) -> dict:
        """
        Send a follow-up/reply email to a candidate from the recruiting mailbox.
        """
        payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "Text",
                    "content": body,
                },
                "toRecipients": [
                    {"emailAddress": {"address": to_email}}
                ],
            },
            "saveToSentItems": True,
        }

        try:
            response = requests.post(
                f"{GRAPH_BASE}/users/{RECRUITING_MAILBOX}/sendMail",
                headers=self._headers(),
                json=payload,
                timeout=20,
            )

            if response.status_code == 202:
                return {"success": True, "error": None}

            logger.error("Graph send_reply failed %s: %s", response.status_code, response.text[:300])
            return {
                "success": False,
                "error": f"Graph API error {response.status_code}: {response.text[:200]}",
            }

        except Exception as e:
            logger.error("Graph send_reply exception: %s", e)
            return {"success": False, "error": str(e)}

    def _fetch_messages(self, folder: str, filter_expr: Optional[str]) -> list:
        """Fetch messages from a mailbox folder, optionally with an OData filter."""
        base = (
            f"{GRAPH_BASE}/users/{RECRUITING_MAILBOX}/mailFolders/{folder}/messages"
            f"?$select=subject,body,sentDateTime,receivedDateTime,toRecipients,from"
            f"&$top=50"
        )
        if filter_expr:
            base += f"&$filter={requests.utils.quote(filter_expr)}"
        response = requests.get(base, headers=self._headers(), timeout=20)
        if response.status_code != 200:
            logger.warning("Graph fetch_messages %s/%s returned %s: %s", folder, (filter_expr or "no-filter")[:40], response.status_code, response.text[:200])
            return []
        return response.json().get("value", [])
