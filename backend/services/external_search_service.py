"""
External Candidates Search Service

Searches for LinkedIn profiles matching a job description using:
1. Gemini to generate an optimized Google search query from job description
2. Serper.dev API to execute the search
3. Profile extraction similar to Peoplehub's approach
"""

import json
import logging
import os
import re
import requests
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from google import genai
from google.genai.types import GenerateContentConfig

logger = logging.getLogger(__name__)


class SerperAPIError(Exception):
    """Raised when Serper API returns an error."""
    pass


class ExternalSearchService:
    """Service for searching external candidates on LinkedIn via Google Search."""

    SERPER_API_URL = "https://google.serper.dev/search"
    DEFAULT_RESULT_COUNT = 10

    def __init__(self):
        """Initialize the external search service."""
        self.serper_api_key = os.getenv("SERPER_API_KEY")
        if not self.serper_api_key:
            raise ValueError("SERPER_API_KEY environment variable is required")

        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")

        self.gemini_model = os.getenv("GEMINI_MODEL")
        if not self.gemini_model:
            raise ValueError("GEMINI_MODEL environment variable is required")

        # Initialize Gemini client
        self.gemini_client = genai.Client(api_key=gemini_api_key)

        logger.info(f"ExternalSearchService initialized with model: {self.gemini_model}")

    def search_candidates(
        self,
        job_description: str,
        count: int = 10,
        role: Optional[str] = None,
        location: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search for external candidates matching a job description.

        Args:
            job_description: The full job description text
            count: Number of candidates to search for (default 10, max 50)
            role: User-provided role title (from HITL, skips Gemini if provided)
            location: User-provided location (from HITL)

        Returns:
            Dictionary with:
                - success: bool
                - count: int
                - results: List[ProfileSummary]
                - parsedQuery: ParsedSearchQuery
                - cached: bool
                - timestamp: int
                - error: str (if failed)
        """
        try:
            if not job_description or not job_description.strip():
                return {
                    "success": False,
                    "error": "No job description provided"
                }

            # Validate and clamp count
            count = max(1, min(50, count))

            # Step 1: Build search query
            if role:
                # User provided role (from HITL) - skip Gemini extraction
                location_part = f" {location}" if location else ""
                google_query = f'site:linkedin.com/in "{role}"{location_part}'
                parsed_query = {
                    "role": role,
                    "location": location,
                    "countryCode": None,
                    "keywords": [],
                    "googleQuery": google_query,
                    "source": "user"
                }
                logger.info(f"Using user-provided role: {role}, location: {location}")
            else:
                # No role provided - use Gemini to extract
                parsed_query = self._generate_search_query(job_description)
                if not parsed_query:
                    return {
                        "success": False,
                        "error": "Failed to generate search query from job description"
                    }
                parsed_query["source"] = "gemini"

            logger.info(f"Generated search query for role: {parsed_query.get('role', 'N/A')}")

            # Step 2: Execute search via Serper.dev
            try:
                search_results = self._execute_search(
                    query=parsed_query["googleQuery"],
                    count=count,
                    country_code=parsed_query.get("countryCode")
                )
            except SerperAPIError as e:
                return {
                    "success": False,
                    "error": f"Search API error: {str(e)}"
                }

            # Step 3: Extract profile summaries from results
            profiles = self._extract_profiles(search_results)

            logger.info(f"Found {len(profiles)} LinkedIn profiles")

            # Include the requested count in parsedQuery for reference
            parsed_query["requestedCount"] = count

            return {
                "success": True,
                "count": len(profiles),
                "results": profiles,
                "parsedQuery": parsed_query,
                "cached": False,
                "timestamp": self._get_timestamp()
            }

        except Exception as e:
            logger.error(f"Error searching external candidates: {e}")
            return {
                "success": False,
                "error": f"Search failed: {str(e)}"
            }

    def _generate_search_query(self, job_description: str) -> Optional[Dict[str, Any]]:
        """
        Use Gemini to generate an optimized Google search query from job description.

        Returns:
            ParsedSearchQuery dict with:
                - count: int (always 10)
                - role: str | None
                - location: str | None
                - countryCode: str | None (2-letter ISO)
                - keywords: List[str]
                - googleQuery: str (always includes site:linkedin.com/in)
        """
        try:
            system_instruction = """You are a LinkedIn recruiter search query generator. Your task is to create simple, effective Google search queries for finding LinkedIn profiles.

Rules:
1. Extract the main job role/title - use common, broad titles (e.g., "Software Engineer", "Data Scientist", "Product Manager")
2. Identify the location if mentioned (city, state, or country)
3. Convert location to 2-letter ISO country code (e.g., "US", "IL", "GB", "DE"). Set to null if not mentioned.
4. DO NOT add niche skills or technologies to the query - they severely limit results
5. Create a SIMPLE Google search query:
   - MUST start with "site:linkedin.com/in"
   - Put the job role in quotes
   - Add location WITHOUT quotes if available
   - DO NOT add skills/technologies - keep it broad

Output JSON format:
{
    "role": "Job Title",
    "location": "City, State or Country or null",
    "countryCode": "US or null",
    "keywords": [],
    "googleQuery": "site:linkedin.com/in \\"Job Title\\" location"
}

GOOD examples:
- site:linkedin.com/in "Software Developer" Michigan
- site:linkedin.com/in "Software Engineer" San Francisco
- site:linkedin.com/in "Data Scientist" New York
- site:linkedin.com/in "Product Manager" Texas

BAD examples (too specific - will return few results):
- site:linkedin.com/in "Software Developer" Oakland County Kofax
- site:linkedin.com/in "AI Specialist" "AWS Bedrock" "RAG"
- site:linkedin.com/in "Senior Staff Principal ML Platform Engineer"

Keep it simple: just role + location. No skills."""

            response = self.gemini_client.models.generate_content(
                model=self.gemini_model,
                contents=job_description,
                config=GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json"
                )
            )

            response_text = response.text if hasattr(response, "text") else None

            if not response_text:
                logger.error("Empty response from Gemini")
                return None

            # Parse JSON response - try to extract JSON if there's extra text
            parsed = self._parse_json_response(response_text)

            if not parsed:
                logger.error("Failed to parse Gemini response as JSON")
                return None

            # Handle case where Gemini returns a list instead of a dict
            if isinstance(parsed, list):
                if len(parsed) > 0 and isinstance(parsed[0], dict):
                    parsed = parsed[0]
                else:
                    logger.error(f"Unexpected list format from Gemini")
                    return None

            if not isinstance(parsed, dict):
                logger.error(f"Unexpected response type from Gemini: {type(parsed)}")
                return None

            # Validate and enforce site:linkedin.com/in
            google_query = parsed.get("googleQuery", "")
            if not google_query.startswith("site:linkedin.com/in"):
                # Force the prefix
                google_query = f"site:linkedin.com/in {google_query}"
                parsed["googleQuery"] = google_query

            return parsed

        except Exception as e:
            logger.error(f"Error generating search query: {e}")
            return None

    def _parse_json_response(self, response_text: str) -> Optional[Any]:
        """
        Parse JSON from response, handling cases where there's extra text.

        Args:
            response_text: Raw response text from Gemini

        Returns:
            Parsed JSON object or None if parsing fails
        """
        # First try direct parsing
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON from the response (in case there's extra text)
        # Look for JSON object
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        # Look for JSON array
        json_match = re.search(r'\[[\s\S]*\]', response_text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        return None

    def _execute_search(
        self,
        query: str,
        count: int = 10,
        country_code: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute Google search via Serper.dev API.

        Args:
            query: The Google search query
            count: Number of results to request
            country_code: Optional 2-letter country code for geo-targeting

        Returns:
            List of organic search results

        Raises:
            SerperAPIError: If the API call fails
        """
        headers = {
            "X-API-KEY": self.serper_api_key,
            "Content-Type": "application/json"
        }

        payload = {
            "q": query,
            "num": count
        }

        # Add geo-targeting if country code provided (uppercase for ISO codes)
        if country_code:
            payload["gl"] = country_code.upper()

        try:
            response = requests.post(
                self.SERPER_API_URL,
                headers=headers,
                json=payload,
                timeout=30
            )
        except requests.RequestException as e:
            raise SerperAPIError(f"Request failed: {str(e)}")

        if response.status_code != 200:
            raise SerperAPIError(f"HTTP {response.status_code}: {response.text[:200]}")

        try:
            data = response.json()
        except json.JSONDecodeError as e:
            raise SerperAPIError(f"Invalid JSON response: {str(e)}")

        # Log raw Serper results for debugging
        organic_results = data.get("organic", [])
        logger.info(f"[SERPER RAW] Query: {query}")
        logger.info(f"[SERPER RAW] Requested: {count}, Returned: {len(organic_results)}")
        for i, result in enumerate(organic_results):
            logger.info(f"[SERPER RAW] Result {i+1}: {result.get('link', 'N/A')} | {result.get('title', 'N/A')[:50]}")

        return organic_results

    def _extract_profiles(self, search_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Extract LinkedIn profile summaries from search results.

        Filters to only valid LinkedIn /in/ profile URLs and extracts:
        - linkedinUrl: normalized URL
        - linkedinId: profile ID from URL
        - title: original search result title
        - snippet: search result snippet/description
        - name: extracted from title
        - headline: extracted from title
        - location: extracted from subtitle or snippet
        """
        profiles = []

        for result in search_results:
            link = result.get("link", "")

            # Validate LinkedIn profile URL
            if not self._is_valid_linkedin_profile_url(link):
                continue

            # Normalize URL
            linkedin_url = self._normalize_linkedin_url(link)
            linkedin_id = self._extract_linkedin_id(linkedin_url)

            # Extract profile info
            title = result.get("title", "")
            subtitle = result.get("subtitle", "")  # Serper provides this with location/company
            snippet = result.get("snippet", "")

            # Parse name and headline from title
            name, headline = self._parse_title(title)

            # Extract location - prefer subtitle (Serper), then snippet
            location = self._extract_location_from_subtitle(subtitle)
            if not location:
                location = self._extract_location_from_snippet(snippet)

            profiles.append({
                "linkedinUrl": linkedin_url,
                "linkedinId": linkedin_id,
                "title": title,
                "snippet": snippet,
                "name": name,
                "headline": headline,
                "location": location
            })

        return profiles

    def _is_valid_linkedin_profile_url(self, url: str) -> bool:
        """Check if URL is a valid LinkedIn profile URL (/in/ path)."""
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname or ""
            return (
                hostname in ("linkedin.com", "www.linkedin.com") or
                hostname.endswith(".linkedin.com")
            ) and parsed.path.startswith("/in/")
        except Exception:
            return False

    def _normalize_linkedin_url(self, url: str) -> str:
        """Normalize LinkedIn URL to standard format."""
        try:
            parsed = urlparse(url)
            # Remove query params and fragments, normalize to www.linkedin.com
            return f"https://www.linkedin.com{parsed.path}"
        except Exception:
            return url

    def _extract_linkedin_id(self, url: str) -> str:
        """Extract LinkedIn profile ID from URL."""
        try:
            parsed = urlparse(url)
            segments = [s for s in parsed.path.split("/") if s]
            in_index = next((i for i, s in enumerate(segments) if s == "in"), -1)
            if in_index >= 0 and in_index + 1 < len(segments):
                candidate = segments[in_index + 1]
                # Remove any query params or trailing slashes
                return candidate.split("?")[0].split("#")[0].rstrip("/")
            return url
        except Exception:
            return url

    def _parse_title(self, title: str) -> tuple:
        """
        Parse name and headline from search result title.

        LinkedIn titles typically follow: "Name - Headline | LinkedIn"

        Returns:
            (name, headline) tuple
        """
        # Remove " | LinkedIn" suffix
        clean_title = re.sub(r"\s*\|\s*LinkedIn\s*$", "", title, flags=re.IGNORECASE)

        # Split by " - " to separate name from headline
        parts = clean_title.split(" - ", 1)

        name = parts[0].strip() if parts else None
        headline = parts[1].strip() if len(parts) > 1 else None

        return name, headline

    def _extract_location_from_subtitle(self, subtitle: str) -> Optional[str]:
        """
        Extract location from Serper's subtitle field.

        Subtitle format: "Location . Role . Company" or "Location, Country . Role . Company"
        """
        if not subtitle:
            return None

        # Split by middle dot (not period)
        parts = subtitle.split(" \u00b7 ")
        if parts:
            # First part is typically location
            location = parts[0].strip()
            if location and len(location) <= 100:
                return location

        return None

    def _extract_location_from_snippet(self, snippet: str) -> Optional[str]:
        """
        Extract location from snippet using Peoplehub's approach.

        Looks for "Location: ..." pattern or last " . " segment.
        """
        if not snippet:
            return None

        # Try "Location: ..." pattern first
        location_match = re.search(r"Location:\s*([^\u00b7]+)", snippet, re.IGNORECASE)
        if location_match:
            return location_match.group(1).strip()

        # Fallback: last " . " segment (middle dot, not period)
        parts = snippet.split(" \u00b7 ")
        if len(parts) > 1:
            candidate = parts[-1].strip()
            if candidate and len(candidate) <= 80:
                return candidate

        return None

    def _get_timestamp(self) -> int:
        """Get current timestamp in milliseconds."""
        import time
        return int(time.time() * 1000)
