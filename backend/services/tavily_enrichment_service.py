"""
Tavily Enrichment Service

Fetches candidate profile signals and company context using the Tavily
extract and search APIs to enrich outreach email personalization.
"""

import logging
import os
import re
import requests
from typing import Optional

logger = logging.getLogger(__name__)

TAVILY_EXTRACT_URL = "https://api.tavily.com/extract"
TAVILY_SEARCH_URL = "https://api.tavily.com/search"


class TavilyEnrichmentService:
    def __init__(self):
        self.api_key = os.getenv("TAVILY_API_KEY")
        if not self.api_key:
            raise ValueError("TAVILY_API_KEY environment variable is required")

    def enrich_candidate(
        self,
        linkedin_url: str,
        candidate_name: str,
        headline: Optional[str] = None,
        company_name: Optional[str] = None,
    ) -> dict:
        """
        Fetch profile and company signals for a candidate.

        Returns:
            {
                "profile_summary": str | None,   # key sentences from LinkedIn profile
                "company_signals": str | None,   # recent company news/context
            }
        """
        profile_summary = self._extract_linkedin_profile(linkedin_url, candidate_name)
        company_signals = self._search_company(company_name, candidate_name, headline) if company_name else None

        logger.info(
            "Tavily enrichment for %s — profile=%s chars, company=%s chars",
            candidate_name,
            len(profile_summary) if profile_summary else 0,
            len(company_signals) if company_signals else 0,
        )

        return {
            "profile_summary": profile_summary,
            "company_signals": company_signals,
        }

    def _extract_linkedin_profile(self, linkedin_url: str, candidate_name: str) -> Optional[str]:
        """
        Extract readable text from a LinkedIn profile page via Tavily extract,
        falling back to a web search for the person if extraction returns nothing useful.
        """
        try:
            response = requests.post(
                TAVILY_EXTRACT_URL,
                json={"urls": [linkedin_url], "api_key": self.api_key},
                timeout=15,
            )
            if response.status_code == 200:
                data = response.json()
                results = data.get("results") or []
                if results:
                    raw = results[0].get("raw_content") or ""
                    cleaned = self._clean_linkedin_text(raw)
                    if cleaned and len(cleaned) > 100:
                        return cleaned[:1200]

        except Exception as e:
            logger.warning("Tavily extract failed for %s: %s", linkedin_url, e)

        # Fallback: web search for the person
        return self._search_person(candidate_name, linkedin_url)

    def _search_person(self, candidate_name: str, linkedin_url: str) -> Optional[str]:
        """Search the web for a candidate to get profile signals."""
        try:
            linkedin_id = linkedin_url.rstrip("/").split("/")[-1]
            query = f"{candidate_name} {linkedin_id} professional background experience"
            response = requests.post(
                TAVILY_SEARCH_URL,
                json={
                    "api_key": self.api_key,
                    "query": query,
                    "max_results": 3,
                    "include_answer": True,
                },
                timeout=15,
            )
            if response.status_code == 200:
                data = response.json()
                answer = data.get("answer") or ""
                snippets = " ".join(
                    r.get("content", "")
                    for r in (data.get("results") or [])[:2]
                )
                combined = (answer + " " + snippets).strip()
                return combined[:800] if combined else None
        except Exception as e:
            logger.warning("Tavily person search failed for %s: %s", candidate_name, e)
        return None

    def _search_company(self, company_name: str, candidate_name: str, headline: Optional[str]) -> Optional[str]:
        """Search for recent company news and context."""
        try:
            query = f"{company_name} company recent news 2025 2026"
            response = requests.post(
                TAVILY_SEARCH_URL,
                json={
                    "api_key": self.api_key,
                    "query": query,
                    "max_results": 3,
                    "include_answer": True,
                },
                timeout=15,
            )
            if response.status_code == 200:
                data = response.json()
                answer = data.get("answer") or ""
                snippets = " ".join(
                    r.get("content", "")
                    for r in (data.get("results") or [])[:2]
                )
                combined = (answer + " " + snippets).strip()
                return combined[:600] if combined else None
        except Exception as e:
            logger.warning("Tavily company search failed for %s: %s", company_name, e)
        return None

    def _clean_linkedin_text(self, raw: str) -> str:
        """Strip boilerplate LinkedIn UI text, keeping profile content."""
        if not raw:
            return ""
        # Remove common LinkedIn UI strings
        noise_patterns = [
            r"Sign in.*?$",
            r"Join now.*?$",
            r"LinkedIn.*?$",
            r"\d+ connections",
            r"Follow\s*$",
            r"Message\s*$",
            r"Connect\s*$",
            r"See all \d+",
            r"Show more\s*$",
            r"\bCookies?\b.*?$",
            r"Privacy Policy.*?$",
        ]
        text = raw
        for pattern in noise_patterns:
            text = re.sub(pattern, "", text, flags=re.MULTILINE | re.IGNORECASE)

        # Collapse whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]+", " ", text)
        return text.strip()
