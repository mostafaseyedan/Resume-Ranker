"""
Web Verification Service

This service performs web searches to verify candidate claims from resumes.
It extracts basic candidate information (name, profession, companies) from the
resume analysis and searches the web to verify these claims.

Supports both Gemini and OpenAI providers with their respective web search tools.
"""

from google import genai
from google.genai import types
from openai import OpenAI
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal, Any
import logging
import json
import os
import time

logger = logging.getLogger(__name__)

ISO_PARTIAL_DATE_PATTERN = r"^\d{4}(-\d{2}(-\d{2})?)?$"


# Pydantic models for structured output
class CandidateSearchInfo(BaseModel):
    """Basic candidate information extracted for web search"""
    full_name: str = Field(description="Candidate's full name")
    current_title: str = Field(description="Current or most recent job title")
    current_company: str = Field(description="Current or most recent company")
    linkedin_keywords: str = Field(description="Keywords to search for LinkedIn profile")
    previous_companies: List[str] = Field(default_factory=list, description="List of previous companies")
    notable_achievements: List[str] = Field(default_factory=list, description="Key achievements that could be verified")
    certifications: List[str] = Field(default_factory=list, description="Certifications claimed")
    education: List[str] = Field(default_factory=list, description="Educational institutions attended")


class VerificationSource(BaseModel):
    """A source used for verification"""
    url: str
    title: Optional[str] = None
    relevant_text: Optional[str] = None
    source_type: Optional[Literal["search_result", "profile", "company_site", "news", "document", "other"]] = None


class IdentityResolution(BaseModel):
    status: Literal["matched", "ambiguous", "not_found"]
    confidence: Literal["high", "medium", "low"]
    reason: str
    signals: List[str] = Field(default_factory=list)


class OnlinePresenceProfile(BaseModel):
    type: Literal["linkedin", "github", "personal_site", "portfolio", "company_bio", "other"]
    url: str
    title: Optional[str] = None
    match_strength: Literal["high", "medium", "low"]
    notes: Optional[str] = None


class OnlinePresence(BaseModel):
    presence_level: Literal["strong", "moderate", "weak", "none"]
    profiles: List[OnlinePresenceProfile] = Field(default_factory=list)
    summary: str


class ClaimEntity(BaseModel):
    organization: Optional[str] = None
    role: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = Field(default=None, pattern=ISO_PARTIAL_DATE_PATTERN)
    end_date: Optional[str] = Field(default=None, pattern=ISO_PARTIAL_DATE_PATTERN)
    credential: Optional[str] = None

    @field_validator("start_date", "end_date")
    @classmethod
    def validate_partial_iso_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        parts = value.split("-")
        if len(parts) >= 2:
            month = int(parts[1])
            if month < 1 or month > 12:
                raise ValueError("month out of range")
        if len(parts) == 3:
            day = int(parts[2])
            if day < 1 or day > 31:
                raise ValueError("day out of range")
        return value


class Discrepancy(BaseModel):
    type: Literal[
        "date_mismatch",
        "role_mismatch",
        "org_mismatch",
        "location_mismatch",
        "identity_mismatch",
        "other",
    ]
    description: str
    severity: Literal["high", "medium", "low"]
    source_urls: List[str] = Field(default_factory=list)


class VerificationMetrics(BaseModel):
    claims_total: int = 0
    claims_verified: int = 0
    claims_partially_verified: int = 0
    claims_unverified: int = 0
    claims_contradicted: int = 0
    claims_inconclusive: int = 0
    verifiable_ratio: float = 0.0


class ClaimVerification(BaseModel):
    """Verification result for a specific claim"""
    id: str = Field(description="Stable claim identifier provided in input")
    category: Literal["employment", "education", "certification", "project", "publication", "award", "identity", "other"]
    claim: str = Field(description="Human-readable claim text")
    entity: ClaimEntity = Field(default_factory=ClaimEntity)
    verification_status: Literal["verified", "partially_verified", "unverified", "contradicted", "inconclusive"]
    confidence: Literal["high", "medium", "low"]
    reason: str = Field(description="Short reason for the verification status")
    evidence_snippets: List[str] = Field(default_factory=list)
    sources: List[VerificationSource] = Field(default_factory=list)
    discrepancies: List[Discrepancy] = Field(default_factory=list)


class VerificationRunInfo(BaseModel):
    provider: Literal["gemini", "openai"]
    model: str
    run_at: str = Field(description="ISO-8601 timestamp")


class WebVerificationResult(BaseModel):
    """Complete web verification result for a candidate"""
    schema_version: Literal["1.0"] = "1.0"
    candidate_name: str
    run: Optional[VerificationRunInfo] = None
    search_queries_used: List[str] = Field(default_factory=list)
    profile_found: bool = Field(description="Whether a professional profile was found")
    online_presence: OnlinePresence
    identity_resolution: IdentityResolution
    profile_summary: str = Field(description="Summary of what was found about the candidate online")
    claim_verifications: List[ClaimVerification] = Field(default_factory=list)
    overall_verification_status: Literal["verified", "partially_verified", "limited_information", "no_information_found", "contradicted"]
    overall_confidence: Literal["high", "medium", "low"]
    verification_summary: str = Field(description="Overall summary of the verification findings")
    metrics: Optional[VerificationMetrics] = None
    discrepancies_summary: List[Discrepancy] = Field(default_factory=list)
    sources: List[VerificationSource] = Field(default_factory=list, description="All sources consulted")

    @field_validator("search_queries_used", mode="before")
    @classmethod
    def coerce_queries(cls, value: Any) -> Any:
        return value or []


class WebVerificationService:
    """Service for verifying candidate claims using web search"""

    def __init__(self, provider: str = "gemini"):
        """
        Initialize the web verification service.

        Args:
            provider: "gemini" or "openai"
        """
        self.provider = provider.lower()

        if self.provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY is required for Gemini provider")
            self.gemini_client = genai.Client(api_key=api_key)
        elif self.provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY is required for OpenAI provider")
            self.openai_client = OpenAI(api_key=api_key)
        else:
            raise ValueError(f"Unsupported provider: {provider}. Use 'gemini' or 'openai'")

    def extract_search_info(self, resume_analysis: dict) -> CandidateSearchInfo:
        """
        Extract basic candidate information from resume analysis for web search.

        Args:
            resume_analysis: The analysis result from analyze_resume()

        Returns:
            CandidateSearchInfo with extracted information
        """
        # Extract from the resume analysis
        name = resume_analysis.get("candidate_name", "")

        # Get experience info
        experience = resume_analysis.get("experience_match", {})
        companies = experience.get("companies", [])

        current_company = ""
        current_title = ""
        previous_companies = []

        if companies:
            # First company is typically most recent
            first_company = companies[0]
            if isinstance(first_company, dict):
                current_company = first_company.get("name", "")
            elif isinstance(first_company, str):
                current_company = first_company

            # Rest are previous companies
            for comp in companies[1:]:
                if isinstance(comp, dict):
                    previous_companies.append(comp.get("name", ""))
                elif isinstance(comp, str):
                    previous_companies.append(comp)

        # Get education info
        education = resume_analysis.get("education_match", {})
        institutions = education.get("institutions", [])
        education_list = []
        for inst in institutions:
            if isinstance(inst, dict):
                education_list.append(inst.get("name", ""))
            elif isinstance(inst, str):
                education_list.append(inst)

        certifications = education.get("certifications", [])

        # Get notable achievements from strengths
        achievements = []
        strengths = resume_analysis.get("strengths", [])
        for strength in strengths[:3]:  # Top 3 strengths
            if isinstance(strength, dict):
                evidence = strength.get("evidence", "")
                if evidence:
                    achievements.append(evidence)

        # Build LinkedIn search keywords
        linkedin_keywords = f"{name} {current_company}" if current_company else name

        return CandidateSearchInfo(
            full_name=name,
            current_title=current_title,
            current_company=current_company,
            linkedin_keywords=linkedin_keywords,
            previous_companies=previous_companies,
            notable_achievements=achievements,
            certifications=certifications,
            education=education_list
        )

    def _normalize_date(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        text = str(value).strip()
        if not text:
            return None
        lowered = text.lower()
        if lowered in {"present", "current", "now"}:
            return None

        # Already ISO partial (YYYY, YYYY-MM, YYYY-MM-DD)
        import re
        if re.match(ISO_PARTIAL_DATE_PATTERN, text):
            return text

        # Common stored format in analysis: MM/DD/YYYY
        mmddyyyy = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", text)
        if mmddyyyy:
            month, day, year = mmddyyyy.groups()
            return f"{year}-{int(month):02d}-{int(day):02d}"

        # Unknown / unsupported format -> null
        return None

    def _build_claims_from_analysis(self, resume_analysis: dict) -> List[dict]:
        claims: List[dict] = []

        experience = resume_analysis.get("experience_match", {}) or {}
        companies = experience.get("companies", []) or []
        for idx, company in enumerate(companies):
            if isinstance(company, dict):
                org = company.get("name") or ""
                location = company.get("location")
                start_date = self._normalize_date(company.get("start_date"))
                end_date = self._normalize_date(company.get("end_date"))
                claim_text = f"Employment at {org}".strip()
                claims.append(
                    {
                        "id": f"employment_{idx}",
                        "category": "employment",
                        "claim": claim_text,
                        "entity": {
                            "organization": org or None,
                            "role": None,
                            "location": location or None,
                            "start_date": start_date,
                            "end_date": end_date,
                            "credential": None,
                        },
                    }
                )
            elif isinstance(company, str) and company.strip():
                org = company.strip()
                claims.append(
                    {
                        "id": f"employment_{idx}",
                        "category": "employment",
                        "claim": f"Employment at {org}",
                        "entity": {"organization": org, "role": None, "location": None, "start_date": None, "end_date": None, "credential": None},
                    }
                )

        education = resume_analysis.get("education_match", {}) or {}
        institutions = education.get("institutions", []) or []
        for idx, inst in enumerate(institutions):
            if isinstance(inst, dict):
                org = inst.get("name") or ""
                location = inst.get("location")
                start_date = self._normalize_date(inst.get("start_date"))
                end_date = self._normalize_date(inst.get("end_date"))
                claims.append(
                    {
                        "id": f"education_{idx}",
                        "category": "education",
                        "claim": f"Education at {org}".strip(),
                        "entity": {
                            "organization": org or None,
                            "role": None,
                            "location": location or None,
                            "start_date": start_date,
                            "end_date": end_date,
                            "credential": None,
                        },
                    }
                )
            elif isinstance(inst, str) and inst.strip():
                org = inst.strip()
                claims.append(
                    {
                        "id": f"education_{idx}",
                        "category": "education",
                        "claim": f"Education at {org}",
                        "entity": {"organization": org, "role": None, "location": None, "start_date": None, "end_date": None, "credential": None},
                    }
                )

        certifications = education.get("certifications", []) or []
        for idx, cert in enumerate(certifications):
            if not cert:
                continue
            cert_text = str(cert).strip()
            if not cert_text:
                continue
            claims.append(
                {
                    "id": f"certification_{idx}",
                    "category": "certification",
                    "claim": f"Certification: {cert_text}",
                    "entity": {"organization": None, "role": None, "location": None, "start_date": None, "end_date": None, "credential": cert_text},
                }
            )

        return claims

    def _build_verification_payload(self, resume_analysis: dict, search_info: CandidateSearchInfo) -> dict:
        return {
            "candidate": {
                "name": search_info.full_name,
                "current_company": search_info.current_company or None,
                "current_title": search_info.current_title or None,
            },
            "claims": self._build_claims_from_analysis(resume_analysis),
        }

    def verify_candidate_with_gemini(self, verification_payload: dict) -> WebVerificationResult:
        """
        Verify candidate information using Gemini with Google Search grounding.

        Args:
            verification_payload: Candidate + claims payload

        Returns:
            WebVerificationResult with verification findings
        """
        try:
            # Build the verification prompt
            prompt = self._build_verification_prompt(verification_payload)

            # Configure Google Search tool
            google_search_tool = types.Tool(
                google_search=types.GoogleSearch()
            )

            response = self.gemini_client.models.generate_content(
                model=os.getenv("GEMINI_VERIFICATION_MODEL", "gemini-3-pro-preview"),
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[google_search_tool],
                    response_mime_type="application/json",
                    response_schema=WebVerificationResult,
                    system_instruction="""You are a professional background verification specialist.
Your task is to search the web and verify claims made in a candidate's resume.

IMPORTANT GUIDELINES:
1. Search for the candidate's professional presence (LinkedIn, company pages, news articles, publications)
2. Verify employment history, education, and notable achievements when possible
3. Be objective - report what you find, including when information cannot be verified
4. If no relevant information is found, clearly state "No relevant information found" - do not make assumptions
5. Distinguish between verified, partially verified, unverified, and contradicted claims
6. Provide specific sources for any verification claims

RESPONSE FORMAT:
Return ONLY valid JSON that matches the provided schema. Do not wrap in markdown.

DATE FORMAT:
- Dates must be ISO partial: YYYY, YYYY-MM, or YYYY-MM-DD; use null when unknown.

IDENTITY GUIDANCE:
- If you cannot reliably match the person, mark identity_resolution.status as not_found or ambiguous.
- Identity mismatch does NOT imply claims are false; use unverified/inconclusive accordingly.

CLAIM GUIDANCE:
- Only verify the provided claims by id. Do not invent additional claims.
- Include one claim_verifications entry per input claim id."""
                )
            )

            # Parse the response and grounding metadata
            result = self._parse_gemini_verification_response(response)
            return result

        except Exception as e:
            logger.error(f"Gemini web verification failed: {e}")
            return WebVerificationResult(
                candidate_name=verification_payload.get("candidate", {}).get("name", ""),
                run=VerificationRunInfo(provider="gemini", model=os.getenv("GEMINI_VERIFICATION_MODEL", "gemini-3-pro-preview"), run_at=""),
                search_queries_used=[],
                profile_found=False,
                online_presence=OnlinePresence(presence_level="none", profiles=[], summary=f"Verification failed: {str(e)}"),
                identity_resolution=IdentityResolution(status="not_found", confidence="low", reason=str(e), signals=["error"]),
                profile_summary=f"Verification failed: {str(e)}",
                claim_verifications=[],
                overall_verification_status="no_information_found",
                overall_confidence="low",
                verification_summary=f"Unable to perform web verification due to an error: {str(e)}",
                discrepancies_summary=[],
                sources=[]
            )

    def verify_candidate_with_openai(self, verification_payload: dict) -> WebVerificationResult:
        """
        Verify candidate information using OpenAI with web search tool.

        Args:
            verification_payload: Candidate + claims payload

        Returns:
            WebVerificationResult with verification findings
        """
        import traceback

        candidate_info = verification_payload.get("candidate", {})
        claims = verification_payload.get("claims", [])
        logger.info(
            "OpenAI verification starting: candidate=%s, claims_count=%d",
            candidate_info.get("name", "Unknown"),
            len(claims),
        )
        logger.debug("Verification payload: %s", json.dumps(verification_payload, ensure_ascii=False, default=str)[:2000])

        try:
            # Build the verification prompt
            prompt = self._build_verification_prompt(verification_payload)

            base_input = f"""You are a professional background verification specialist.

{prompt}

IMPORTANT GUIDELINES:
1. Search for the candidate's professional presence (LinkedIn, company pages, news articles, publications)
2. Verify employment history, education, and notable achievements when possible
3. Be objective - report what you find, including when information cannot be verified
4. If no relevant information is found, clearly state "No relevant information found" - do not make assumptions
5. Distinguish between verified, partially verified, unverified, and contradicted claims
6. Provide specific sources for any verification claims

DATE FORMAT:
- Dates must be ISO partial: YYYY, YYYY-MM, or YYYY-MM-DD; use null when unknown.

IDENTITY GUIDANCE:
- If you cannot reliably match the person, mark identity_resolution.status as not_found or ambiguous.
- Identity mismatch does NOT imply claims are false; use unverified/inconclusive accordingly.

CLAIM GUIDANCE:
- Only verify the provided claims by id. Do not invent additional claims.
- Include one claim_verifications entry per input claim id.

Return ONLY valid JSON that matches the provided schema. Do not wrap in markdown."""

            logger.info("OpenAI input prompt length: %d chars", len(base_input))
            logger.debug("OpenAI input prompt (first 1000 chars): %s", base_input[:1000])

            # Use OpenAI Responses API with web_search tool and structured output.
            model = os.getenv("OPENAI_VERIFICATION_MODEL", "gpt-5")
            logger.info(
                "OpenAI web verification request started (model=%s, tools=[web_search], text_format=WebVerificationResult)",
                model,
            )
            request_started_at = time.monotonic()
            response = self.openai_client.responses.parse(
                model=model,
                tools=[{"type": "web_search"}],
                input=base_input,
                text_format=WebVerificationResult,
            )
            request_duration = time.monotonic() - request_started_at
            logger.info("OpenAI web verification request finished in %.1fs", request_duration)

            # Log response structure
            logger.info(
                "OpenAI response received: type=%s, has_output=%s, has_output_parsed=%s",
                type(response).__name__,
                hasattr(response, "output"),
                hasattr(response, "output_parsed"),
            )
            if hasattr(response, "output"):
                output_types = [getattr(item, "type", "unknown") for item in response.output]
                logger.info("OpenAI response output items: %s", output_types)
            if hasattr(response, "output_text") and response.output_text:
                logger.debug("OpenAI output_text (first 500 chars): %s", response.output_text[:500])

            parse_started_at = time.monotonic()
            result = self._parse_openai_verification_response(response)
            logger.info("OpenAI web verification response parsed in %.1fs", time.monotonic() - parse_started_at)
            return result

        except Exception as e:
            logger.error("OpenAI web verification failed: %s", e)
            logger.error("Traceback: %s", traceback.format_exc())
            return WebVerificationResult(
                candidate_name=verification_payload.get("candidate", {}).get("name", ""),
                run=VerificationRunInfo(provider="openai", model=os.getenv("OPENAI_VERIFICATION_MODEL", "gpt-5"), run_at=""),
                search_queries_used=[],
                profile_found=False,
                online_presence=OnlinePresence(presence_level="none", profiles=[], summary=f"Verification failed: {str(e)}"),
                identity_resolution=IdentityResolution(status="not_found", confidence="low", reason=str(e), signals=["error"]),
                profile_summary=f"Verification failed: {str(e)}",
                claim_verifications=[],
                overall_verification_status="no_information_found",
                overall_confidence="low",
                verification_summary=f"Unable to perform web verification due to an error: {str(e)}",
                discrepancies_summary=[],
                sources=[]
            )

    def _build_verification_prompt(self, verification_payload: dict) -> str:
        """
        Build the verification prompt from a structured payload.

        verification_payload example:
        {
          "candidate": {...},
          "claims": [{id, category, claim, entity}, ...]
        }
        """
        candidate = verification_payload.get("candidate", {}) or {}
        claims = verification_payload.get("claims", []) or []
        claim_ids = [c.get("id") for c in claims if isinstance(c, dict) and c.get("id")]

        return f"""Verify the following candidate claims using web search. Use the internet to find evidence.

INPUT (JSON):
{json.dumps(verification_payload, ensure_ascii=False)}

REQUIRED OUTPUT RULES:
1. Return JSON only (no markdown, no extra text).
2. Include one claim_verifications entry for each input claim id: {", ".join(claim_ids) if claim_ids else "(none)"}.
3. Use verification_status=unverified or inconclusive if you cannot find enough evidence.
4. Use contradicted only when you find credible evidence the claim is false.
5. If identity cannot be confidently matched, set identity_resolution.status to not_found or ambiguous (this is not a contradiction).

OUTPUT CONTENT GOALS:
- Provide a clear online_presence summary and any matching profiles found.
- For each claim: status, confidence, short reason, evidence snippets, and source URLs.
- Summarize key discrepancies/contradictions (if any).

CANDIDATE CONTEXT:
- Name: {candidate.get("name") or ""}
- Current company: {candidate.get("current_company") or "Unknown"}
- Current title: {candidate.get("current_title") or "Unknown"}"""

    def _parse_gemini_verification_response(self, response) -> WebVerificationResult:
        """Parse Gemini response with grounding metadata and JSON schema parsing."""
        grounding_sources: List[VerificationSource] = []
        grounding_queries: List[str] = []

        if hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "grounding_metadata") and candidate.grounding_metadata:
                metadata = candidate.grounding_metadata
                if hasattr(metadata, "web_search_queries"):
                    grounding_queries = list(metadata.web_search_queries or [])
                if hasattr(metadata, "grounding_chunks"):
                    for chunk in (metadata.grounding_chunks or []):
                        if hasattr(chunk, "web") and chunk.web:
                            grounding_sources.append(
                                VerificationSource(
                                    url=chunk.web.uri or "",
                                    title=chunk.web.title or None,
                                    relevant_text=None,
                                    source_type="search_result",
                                )
                            )

        parsed_obj: Any = None
        if hasattr(response, "parsed") and response.parsed is not None:
            parsed_obj = response.parsed
        else:
            response_text = response.text if hasattr(response, "text") else ""
            try:
                parsed_obj = json.loads(response_text)
            except Exception:
                parsed_obj = None

        if isinstance(parsed_obj, WebVerificationResult):
            result = parsed_obj
        else:
            result = WebVerificationResult.model_validate(parsed_obj)

        # Merge queries/sources
        merged_queries = list(dict.fromkeys([*(result.search_queries_used or []), *grounding_queries]))
        merged_sources_by_url: dict[str, VerificationSource] = {}
        for source in [*(result.sources or []), *grounding_sources]:
            if not source.url:
                continue
            merged_sources_by_url[source.url] = source

        from datetime import datetime, timezone
        result.search_queries_used = merged_queries
        result.sources = list(merged_sources_by_url.values())
        result.run = VerificationRunInfo(
            provider="gemini",
            model=os.getenv("GEMINI_VERIFICATION_MODEL", "gemini-3-pro-preview"),
            run_at=datetime.now(timezone.utc).isoformat(),
        )
        return result

    def _parse_openai_verification_response(self, response) -> WebVerificationResult:
        """Parse OpenAI response with structured output and web search metadata."""
        from datetime import datetime, timezone

        logger.info("Parsing OpenAI verification response...")

        annotation_sources: List[VerificationSource] = []
        search_queries: List[str] = []

        # Extract web search metadata from response output items
        if hasattr(response, "output"):
            logger.info("Processing %d output items", len(response.output))
            for idx, item in enumerate(response.output):
                item_type = getattr(item, "type", None)
                logger.debug("Output item %d: type=%s", idx, item_type)
                if item_type == "web_search_call":
                    # Extract search query
                    if hasattr(item, "action") and hasattr(item.action, "query") and item.action.query:
                        search_queries.append(item.action.query)
                        logger.info("Extracted search query: %s", item.action.query)
                elif item_type == "message" and hasattr(item, "content"):
                    logger.debug("Message item has %d content parts", len(item.content))
                    # Extract URL citations from annotations
                    for content in item.content:
                        content_type = getattr(content, "type", None)
                        has_parsed = hasattr(content, "parsed") and content.parsed is not None
                        has_annotations = hasattr(content, "annotations") and content.annotations
                        logger.debug(
                            "Content part: type=%s, has_parsed=%s, has_annotations=%s",
                            content_type, has_parsed, has_annotations
                        )
                        if hasattr(content, "annotations"):
                            for annotation in (content.annotations or []):
                                url = getattr(annotation, "url", None)
                                title = getattr(annotation, "title", None)
                                if url:
                                    annotation_sources.append(
                                        VerificationSource(
                                            url=url,
                                            title=title,
                                            relevant_text=None,
                                            source_type="search_result"
                                        )
                                    )
                                    logger.debug("Extracted source: %s", url)
        else:
            logger.warning("Response has no 'output' attribute")

        logger.info("Extracted %d search queries, %d annotation sources", len(search_queries), len(annotation_sources))

        # Get the parsed structured output from SDK auto-parsing
        parsed_result: Optional[WebVerificationResult] = None

        # SDK with text_format provides output_parsed or parsed content
        logger.info(
            "Checking for parsed output: has_output_parsed=%s, output_parsed_type=%s",
            hasattr(response, "output_parsed"),
            type(response.output_parsed).__name__ if hasattr(response, "output_parsed") and response.output_parsed else None
        )

        if hasattr(response, "output_parsed") and response.output_parsed is not None:
            logger.info("Using response.output_parsed for structured output")
            if isinstance(response.output_parsed, WebVerificationResult):
                parsed_result = response.output_parsed
                logger.info("output_parsed is already WebVerificationResult")
            else:
                logger.info("Validating output_parsed as WebVerificationResult")
                parsed_result = WebVerificationResult.model_validate(response.output_parsed)
        else:
            # Fallback: check output items for parsed content
            logger.info("output_parsed not available, checking content.parsed fallback...")
            if hasattr(response, "output"):
                for item in response.output:
                    if getattr(item, "type", None) == "message" and hasattr(item, "content"):
                        for content in item.content:
                            if getattr(content, "type", None) == "output_text" and hasattr(content, "parsed") and content.parsed:
                                logger.info("Found parsed content in output_text, type=%s", type(content.parsed).__name__)
                                if isinstance(content.parsed, WebVerificationResult):
                                    parsed_result = content.parsed
                                else:
                                    parsed_result = WebVerificationResult.model_validate(content.parsed)
                                break
                        if parsed_result:
                            break

        # If still no parsed result, raise an error
        if parsed_result is None:
            logger.error("No structured output found in response")
            raise ValueError("No structured output parsed from OpenAI response")

        logger.info(
            "OpenAI verification parsed: queries=%s sources=%s",
            len(search_queries),
            len(annotation_sources),
        )

        # Merge queries and sources from response metadata
        merged_queries = list(dict.fromkeys([*(parsed_result.search_queries_used or []), *search_queries]))
        merged_sources_by_url: dict[str, VerificationSource] = {}
        for source in [*(parsed_result.sources or []), *annotation_sources]:
            if not source.url:
                continue
            merged_sources_by_url[source.url] = source

        parsed_result.search_queries_used = merged_queries
        parsed_result.sources = list(merged_sources_by_url.values())
        parsed_result.run = VerificationRunInfo(
            provider="openai",
            model=os.getenv("OPENAI_VERIFICATION_MODEL", "gpt-5"),
            run_at=datetime.now(timezone.utc).isoformat(),
        )

        logger.info(
            "OpenAI parsing complete: status=%s, confidence=%s, claims=%d, sources=%d, queries=%d",
            parsed_result.overall_verification_status,
            parsed_result.overall_confidence,
            len(parsed_result.claim_verifications),
            len(parsed_result.sources),
            len(parsed_result.search_queries_used),
        )
        return parsed_result

    def verify_candidate(self, resume_analysis: dict) -> dict:
        """
        Main entry point: Verify a candidate based on their resume analysis.

        Args:
            resume_analysis: The analysis result from analyze_resume()

        Returns:
            Dictionary with verification results
        """
        # Extract search information from resume analysis
        search_info = self.extract_search_info(resume_analysis)
        verification_payload = self._build_verification_payload(resume_analysis, search_info)

        logger.info(f"Starting web verification for candidate: {search_info.full_name}")
        logger.info(f"Search info: company={search_info.current_company}, education={search_info.education}")

        # Perform verification based on provider
        if self.provider == "gemini":
            result = self.verify_candidate_with_gemini(verification_payload)
        else:
            result = self.verify_candidate_with_openai(verification_payload)

        # Ensure we always return one claim_verifications entry per input claim.
        input_claims = verification_payload.get("claims", []) or []
        input_claims_by_id = {
            c.get("id"): c for c in input_claims if isinstance(c, dict) and isinstance(c.get("id"), str) and c.get("id")
        }
        existing_ids = {c.id for c in (result.claim_verifications or []) if getattr(c, "id", None)}
        for claim_id, claim in input_claims_by_id.items():
            if claim_id in existing_ids:
                continue
            try:
                result.claim_verifications.append(
                    ClaimVerification(
                        id=claim_id,
                        category=claim.get("category", "other"),
                        claim=claim.get("claim", ""),
                        entity=ClaimEntity.model_validate(claim.get("entity") or {}),
                        verification_status="unverified",
                        confidence="low",
                        reason="No structured verification output provided for this claim.",
                        evidence_snippets=[],
                        sources=[],
                        discrepancies=[],
                    )
                )
            except Exception:
                continue

        logger.info(f"Web verification completed for {search_info.full_name}: status={result.overall_verification_status}")

        # Compute metrics server-side for UI/analytics.
        counts = {
            "verified": 0,
            "partially_verified": 0,
            "unverified": 0,
            "contradicted": 0,
            "inconclusive": 0,
        }
        for claim in result.claim_verifications or []:
            status = getattr(claim, "verification_status", "unverified")
            if status in counts:
                counts[status] += 1
            else:
                counts["unverified"] += 1

        total = sum(counts.values())
        verifiable = counts["verified"] + counts["partially_verified"]
        result.metrics = VerificationMetrics(
            claims_total=total,
            claims_verified=counts["verified"],
            claims_partially_verified=counts["partially_verified"],
            claims_unverified=counts["unverified"],
            claims_contradicted=counts["contradicted"],
            claims_inconclusive=counts["inconclusive"],
            verifiable_ratio=(verifiable / total) if total else 0.0,
        )

        return result.model_dump()
