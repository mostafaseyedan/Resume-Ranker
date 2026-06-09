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


def _plain_to_html(plain_body: str) -> str:
    """
    Convert a plain-text email body to a clean, professional HTML email.
    Paragraphs are separated by blank lines (\n\n).
    """
    import html as html_lib

    paragraphs = [p.strip() for p in plain_body.strip().split("\n\n") if p.strip()]
    html_paras = "".join(
        f'<p style="margin:0 0 16px 0;line-height:1.6;">{html_lib.escape(p).replace(chr(10), "<br>")}</p>'
        for p in paragraphs
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header bar -->
        <tr>
          <td style="background:#111827;padding:16px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:0.5px;">Cendien</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px 32px;color:#1f2937;font-size:15px;">
            {html_paras}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
              You are receiving this email because your profile matched an open role at Cendien.<br>
              Cendien &nbsp;|&nbsp; <a href="https://cendien.com" style="color:#0073ea;text-decoration:none;">cendien.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


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

    @staticmethod
    def _mailbox_path(mailbox: str) -> str:
        return requests.utils.quote(mailbox, safe="")

    def send_email(self, to_email: str, subject: str, body: str, candidate_linkedin_id: str, sender_email: str = RECRUITING_MAILBOX) -> dict:
        """
        Send an outreach email from a Cendien mailbox.

        We store the linkedinId in a custom internet header (X-Candidate-Id) so we
        can match replies back to the candidate later.

        Returns:
            {"success": bool, "message_id": str | None, "error": str | None}
        """
        payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": _plain_to_html(body),
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
                f"{GRAPH_BASE}/users/{self._mailbox_path(sender_email)}/sendMail",
                headers=self._headers(),
                json=payload,
                timeout=20,
            )

            if response.status_code == 202:
                logger.info("Email sent from %s to %s for candidate %s", sender_email, to_email, candidate_linkedin_id)
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

    def get_thread(self, to_email: str, mailbox: str = RECRUITING_MAILBOX) -> dict:
        """
        Fetch the email thread with a candidate (sent + received) from a mailbox.

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
            all_sent = self._fetch_messages(folder="SentItems", filter_expr=None, mailbox=mailbox)
            to_email_lower = to_email.lower()
            sent = [
                m for m in all_sent
                if any(
                    r.get("emailAddress", {}).get("address", "").lower() == to_email_lower
                    for r in m.get("toRecipients", [])
                )
            ]
            logger.info("Thread lookup for %s — %d sent, checking inbox", to_email, len(sent))

            received = self._fetch_messages(
                folder="Inbox",
                filter_expr=f"from/emailAddress/address eq '{to_email}'",
                mailbox=mailbox,
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

    def send_reply(self, to_email: str, subject: str, body: str, sender_email: str = RECRUITING_MAILBOX) -> dict:
        """
        Send a follow-up/reply email to a candidate from a Cendien mailbox.
        """
        payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": _plain_to_html(body),
                },
                "toRecipients": [
                    {"emailAddress": {"address": to_email}}
                ],
            },
            "saveToSentItems": True,
        }

        try:
            response = requests.post(
                f"{GRAPH_BASE}/users/{self._mailbox_path(sender_email)}/sendMail",
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

    def _fetch_messages(self, folder: str, filter_expr: Optional[str], mailbox: str = RECRUITING_MAILBOX) -> list:
        """Fetch messages from a mailbox folder, optionally with an OData filter."""
        base = (
            f"{GRAPH_BASE}/users/{self._mailbox_path(mailbox)}/mailFolders/{folder}/messages"
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
