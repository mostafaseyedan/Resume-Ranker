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
    subject: str = Field(description=(
        "Email subject line. Must be short (under 8 words), personal, and curiosity-driven. "
        "Good examples: 'Quick question, Justin', 'Security opportunity — worth a look?', "
        "'Your background caught our eye', '{FirstName} x Cendien'. "
        "Bad examples: 'Job Opportunity at Cendien', 'We are hiring', 'Application for Security Analyst'."
    ))
    body: str = Field(description=(
        "Full email body, plain text only. "
        "Structure: greeting paragraph, personalized hook paragraph, role/company paragraph, "
        "soft CTA paragraph, sign-off. "
        "Separate each paragraph with a blank line (\\n\\n). No markdown, no bullet points."
    ))


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
        profile_summary: str = "",
        company_signals: str = "",
    ) -> OutreachEmail:
        """
        Generate a tailored outreach email for a candidate.
        Returns an OutreachEmail with subject and body (plain text).
        """
        first_name = (candidate_name or "there").split()[0]

        enrichment_section = ""
        if profile_summary:
            enrichment_section += f"\nDetailed profile (from LinkedIn):\n{profile_summary[:800]}\n"
        if company_signals:
            enrichment_section += f"\nCompany context:\n{company_signals[:400]}\n"

        prompt = f"""You are a senior technical recruiter writing a cold outreach email to a passive candidate.

Candidate information:
- Name: {candidate_name or "Unknown"}
- Headline: {candidate_headline or "N/A"}
- Location: {candidate_location or "N/A"}
- LinkedIn summary: {candidate_snippet or "N/A"}{enrichment_section}
Job information:
- Title: {job_title}
- Company: {sender_company}
- Description (excerpt): {job_description[:800] if job_description else "N/A"}

Write a short, high-quality cold outreach email. Rules:

SUBJECT LINE:
- Under 8 words, conversational, creates curiosity
- Personalize using first name or their company
- Examples: "Quick question, {first_name}" / "Your background caught our eye" / "{first_name} x {sender_company}"
- Never: "Job Opportunity", "We are hiring", "Application for..."

BODY:
- Open with "{first_name}," on its own line
- First paragraph: a specific personalized hook — reference something real from their background, current role, or company context (e.g. a recent company move, their specialization, years of experience)
- Second paragraph: briefly introduce the {job_title} role at {sender_company} and why their background is a strong fit
- Third paragraph: one soft CTA — "Would you be open to a quick 15-minute chat?" or "Worth a quick conversation?"
- Sign off: "Best,\\n\\nRecruiting Team, {sender_company}"
- Under 150 words total
- Plain text only, no markdown, no bullet points
- Separate each paragraph with a blank line (\\n\\n)"""

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

Write a short follow-up (under 80 words). Rules:
- Subject: short and direct, e.g. "Following up, {first_name}" or "Still worth a chat?"
- Open with "{first_name},"
- Acknowledge they may be busy — one sentence
- Reiterate the opportunity briefly
- Soft CTA: "Happy to keep it to 15 minutes" or similar
- Sign off: "Best,\\n\\nRecruiting Team, {sender_company}"
- Plain text only, no markdown
- Separate paragraphs with blank lines (\\n\\n)"""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=OutreachEmail,
            ),
        )

        return OutreachEmail.model_validate_json(response.text)
