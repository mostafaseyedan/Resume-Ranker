"""
Email Generator Service

Uses Gemini to generate a tailored outreach email for an external candidate
based on their LinkedIn profile and the job description.
"""

import logging
import os
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


class OutreachEmail(BaseModel):
    subject: str = Field(description="Email subject line, concise and relevant to the role")
    body: str = Field(description="Full email body text, professional and personalized, plain text only")


class EmailGeneratorService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        self.model = os.getenv("GEMINI_MODEL")
        if not self.model:
            raise ValueError("GEMINI_MODEL environment variable is required")
        self.client = genai.Client(api_key=api_key)

    def generate_outreach_email(
        self,
        candidate_name: str,
        candidate_headline: str,
        candidate_location: str,
        candidate_snippet: str,
        job_title: str,
        job_description: str,
        sender_company: str = "Cendien",
    ) -> OutreachEmail:
        """
        Generate a tailored outreach email for a candidate.

        Returns an OutreachEmail with subject and body.
        Raises on failure.
        """
        first_name = (candidate_name or "there").split()[0]

        prompt = f"""You are a professional recruiter writing a cold outreach email to a potential candidate for an open role.

Candidate information:
- Name: {candidate_name or "Unknown"}
- Headline: {candidate_headline or "N/A"}
- Location: {candidate_location or "N/A"}
- LinkedIn summary: {candidate_snippet or "N/A"}

Job information:
- Title: {job_title}
- Company: {sender_company}
- Description (excerpt): {job_description[:800] if job_description else "N/A"}

Write a short, personalized outreach email. Requirements:
- Address the candidate by first name: {first_name}
- Keep the body under 150 words
- Reference 1-2 specific things from their headline/background that make them relevant
- Mention the role and company
- End with a soft call to action (asking if they'd be open to a quick chat)
- Plain text only, no markdown, no bullet points
- Use proper paragraph breaks: separate greeting, body, call to action, and sign-off with a blank line (\\n\\n) between each
- Professional but warm tone
- Sign off as "Recruiting Team, {sender_company}" """

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=OutreachEmail,
            ),
        )

        return OutreachEmail.model_validate_json(response.text)

    def generate_followup_email(
        self,
        candidate_name: str,
        job_title: str,
        previous_email_body: str,
        sender_company: str = "Cendien",
    ) -> OutreachEmail:
        """
        Generate a follow-up email when the candidate hasn't replied.
        """
        first_name = (candidate_name or "there").split()[0]

        prompt = f"""You are a professional recruiter writing a brief follow-up email to a candidate who has not replied to an initial outreach.

Candidate first name: {first_name}
Role: {job_title}
Company: {sender_company}
Original message sent:
---
{previous_email_body[:500]}
---

Write a short follow-up email (under 80 words). Be polite, not pushy. Acknowledge they may be busy.
Plain text only, no markdown.
Sign off as "Recruiting Team, {sender_company}" """

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=OutreachEmail,
            ),
        )

        return OutreachEmail.model_validate_json(response.text)
