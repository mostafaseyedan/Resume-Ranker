import logging
from typing import List, Dict, Optional, Any
import os
from urllib.parse import quote
from google import genai
from google.genai.types import (
    GenerateContentConfig,
    VertexAISearch,
    Retrieval,
    Tool,
    HttpOptions,
)

logger = logging.getLogger(__name__)

class VertexSearchService:
    def __init__(self, sharepoint_service=None):
        """Initialize Vertex AI Search service with grounding configuration"""
        self.project_id = "cendien-sales-support-ai"
        self.location = "global"
        self.datastore_id = "sharepoint-files-datastore"
        self.sharepoint_service = sharepoint_service

        # Construct datastore path
        self.datastore_path = f"projects/{self.project_id}/locations/{self.location}/collections/default_collection/dataStores/{self.datastore_id}"

        # Initialize client for Vertex AI using Application Default Credentials
        # Note: vertexai=True parameter makes THIS client use Vertex AI without affecting other clients
        self.client = genai.Client(
            vertexai=True,
            project=self.project_id,
            location=self.location,
            http_options=HttpOptions(api_version="v1")
        )

        logger.info(f"Initialized Vertex AI Search with datastore: {self.datastore_path}")

    def search_candidates(self, job_description: str) -> Dict[str, Any]:
        """
        Search for potential candidates using Vertex AI Search grounding

        Args:
            job_description: The full job description text

        Returns:
            Dictionary with success status and list of candidate files
        """
        try:
            if not job_description or not job_description.strip():
                return {
                    'success': False,
                    'error': 'No job description provided'
                }

            # Create grounding tool with Vertex AI Search
            tool = Tool(
                retrieval=Retrieval(
                    vertex_ai_search=VertexAISearch(
                        datastore=self.datastore_path
                    )
                )
            )

            # Construct search prompt
            # Generate grounded response
            response = self.client.models.generate_content(
                model=os.getenv("VERTEX_MODEL", "gemini-1.5-flash"),
                contents=f"Based on the job description below, check all resumes and CVs in the knowledge base, then identify candidates that would be a good match for this position.\n\nJob Description:\n{job_description}",
                config=GenerateContentConfig(
                    tools=[tool],
                    system_instruction="""
                    You are an expert technical recruiter. Identify candidates whose experience, skills, and qualifications align with the job requirements.
                    
                    Rules:
                    1. If the resume filename contains "improved_resume_", ignore them.
                    2. Return ONLY a numbered list of Candidate names.
                    3. Format the response in Markdown, use bold for candidate names (e.g., **Name**).
                    4. For each candidate, include the filename found.
                    5. State "Top x candidates found" at the top.
                    6. Sort by best match first. Provide reasoning for each selection.
                    7. Do not include any other additional commentary.
                    8. Only use information retrieved from Vertex AI Search grounding. If no results are retrieved, answer exactly "No matching candidates found."
                    """
                ),
            )

            response_text = response.text if hasattr(response, 'text') else None

            # Log grounding metadata to verify datastore usage
            self._log_grounding_metadata(response)
            # Log response summary (excluding verbose grounding chunks)
            self._log_response_summary(response)

            # Extract filenames from grounding metadata
            filenames = self._extract_filenames_from_response(response)

            logger.info(f"Extracted {len(filenames)} filenames from grounding metadata")

            if not filenames:
                logger.info("No candidates found in search results")
                return {
                    'success': True,
                    'candidates': [],
                    'message': 'No matching candidates found in the knowledge base',
                    'response_text': response_text
                }

            # Transform GCS paths to SharePoint URLs
            candidates = self._transform_to_sharepoint_urls(filenames)

            # Note: We don't enrich with SharePoint metadata here because download URLs expire quickly.
            # Instead, enrichment should happen when the user clicks "Analyze" to get fresh URLs.

            logger.info(f"Found {len(candidates)} potential candidates")
            return {
                'success': True,
                'candidates': candidates,
                'response_text': response_text
            }

        except Exception as e:
            logger.error(f"Error searching for candidates: {e}")
            return {
                'success': False,
                'error': f'Failed to search for candidates: {str(e)}'
            }

    def _log_grounding_metadata(self, response) -> None:
        """Log key grounding metadata fields so we can see whether Vertex AI Search was used."""
        try:
            if not response.candidates:
                logger.warning("No candidates returned from Gemini response")
                return

            metadata = getattr(response.candidates[0], 'grounding_metadata', None)
            if not metadata:
                logger.warning("No grounding metadata returned from Gemini response")
                return

            chunk_count = len(metadata.grounding_chunks or [])
            support_count = len(metadata.grounding_supports or [])
            queries = metadata.retrieval_queries or []
            logger.info(
                "Grounding metadata | chunks=%s | supports=%s | retrieval_queries=%s",
                chunk_count,
                support_count,
                queries
            )
        except Exception as log_err:
            logger.warning(f"Failed to log grounding metadata: {log_err}")

    def _log_response_summary(self, response) -> None:
        """Log a compact summary of the model response, excluding grounding chunks content."""
        try:
            summary: Dict[str, Any] = {}

            summary["candidate_count"] = len(getattr(response, "candidates", []) or [])

            usage = getattr(response, "usage_metadata", None)
            if usage is not None:
                summary["usage_metadata"] = {
                    "prompt_token_count": getattr(usage, "prompt_token_count", None),
                    "candidates_token_count": getattr(usage, "candidates_token_count", None),
                    "total_token_count": getattr(usage, "total_token_count", None),
                }

            response_text = getattr(response, "text", None)
            if isinstance(response_text, str):
                summary["text_len"] = len(response_text)
                summary["text_preview"] = response_text[:500]

            candidates_summary: List[Dict[str, Any]] = []
            for idx, cand in enumerate((getattr(response, "candidates", None) or [])[:3]):
                cand_summary: Dict[str, Any] = {"index": idx}
                cand_summary["finish_reason"] = getattr(cand, "finish_reason", None)

                content = getattr(cand, "content", None)
                parts = getattr(content, "parts", None) if content is not None else None
                if parts is not None:
                    part_types: List[str] = []
                    for part in parts:
                        present = []
                        for field_name in ("text", "function_call", "function_response", "inline_data", "thought_signature"):
                            if getattr(part, field_name, None) is not None:
                                present.append(field_name)
                        part_types.append(",".join(present) if present else part.__class__.__name__)
                    cand_summary["content_part_types"] = part_types

                grounding = getattr(cand, "grounding_metadata", None)
                if grounding is not None:
                    cand_summary["grounding_metadata"] = {
                        "chunks_count": len(getattr(grounding, "grounding_chunks", []) or []),
                        "supports_count": len(getattr(grounding, "grounding_supports", []) or []),
                        "retrieval_queries": getattr(grounding, "retrieval_queries", None),
                        "web_search_queries": getattr(grounding, "web_search_queries", None),
                    }

                candidates_summary.append(cand_summary)

            summary["candidates"] = candidates_summary

            logger.info("Vertex search model response summary: %s", summary)
        except Exception as e:
            logger.warning("Failed to log response summary: %s", e)

    def _extract_filenames_from_response(self, response) -> List[str]:
        """Extract all file URIs referenced in the grounding metadata"""
        file_uris = []

        if not response.candidates:
            return file_uris

        candidate = response.candidates[0]

        if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
            metadata = candidate.grounding_metadata

            if hasattr(metadata, 'grounding_chunks') and metadata.grounding_chunks:
                for chunk in metadata.grounding_chunks:
                    if hasattr(chunk, 'retrieved_context'):
                        context = chunk.retrieved_context

                        # Try to get the URI first (full GCS path), fallback to title
                        uri = getattr(context, 'uri', '') or ''
                        title = getattr(context, 'title', '') or ''
                        document_name = getattr(context, 'document_name', '') or ''

                        # Prefer URI as it has the full path
                        if uri:
                            file_uris.append(uri)
                        elif document_name:
                            # Document name is the Vertex AI Search doc resource. Keep for debugging.
                            file_uris.append(document_name)
                        elif title:
                            # Fallback to title if URI not available
                            file_uris.append(title)

        # Remove duplicates while preserving order
        seen = set()
        unique_uris = []
        for uri in file_uris:
            if uri not in seen:
                seen.add(uri)
                unique_uris.append(uri)

        return unique_uris

    def _transform_to_sharepoint_urls(self, gcs_paths: List[str]) -> List[Dict[str, str]]:
        """
        Transform GCS bucket file paths to SharePoint URLs

        The GCS bucket is a replica of the SharePoint site.
        GCS path format: gs://bucket-name/sites/Cendien-SalesSupport/Shared Documents/path/to/file.pdf
        SharePoint URL format: https://cendien.sharepoint.com/sites/Cendien-SalesSupport/Shared Documents/path/to/file.pdf
        """
        candidates = []

        for gcs_path in gcs_paths:
            try:
                # Extract filename from path
                filename = gcs_path.split('/')[-1] if '/' in gcs_path else gcs_path

                # If this is a Vertex AI Search document name (projects/.../documents/xyz), we can't map to SharePoint
                if gcs_path.startswith('projects/'):
                    sharepoint_url = None
                else:
                    # Transform GCS path to SharePoint URL
                    sharepoint_url = self._gcs_to_sharepoint_url(gcs_path)

                candidates.append({
                    'filename': filename,
                    'sharepoint_url': sharepoint_url,
                    'download_url': sharepoint_url,  # Use the same URL for download
                    'original_path': gcs_path
                })

            except Exception as e:
                logger.warning(f"Could not transform path {gcs_path}: {e}")
                # Still add the candidate with just the filename
                candidates.append({
                    'filename': gcs_path.split('/')[-1] if '/' in gcs_path else gcs_path,
                    'sharepoint_url': None,
                    'download_url': None,
                    'original_path': gcs_path
                })

        return candidates

    def search_by_skill(self, skill_or_requirement: str) -> Dict[str, Any]:
        """
        Search for candidates who have a specific skill or requirement using your knowledge base (grounding)

        Args:
            skill_or_requirement: The skill, education requirement, or certification to search for

        Returns:
            Dictionary with success status and Gemini's response text
        """
        try:
            if not skill_or_requirement or not skill_or_requirement.strip():
                return {
                    'success': False,
                    'error': 'No skill or requirement provided'
                }

            # Create grounding tool with Vertex AI Search
            tool = Tool(
                retrieval=Retrieval(
                    vertex_ai_search=VertexAISearch(
                        datastore=self.datastore_path
                    )
                )
            )

            # Construct search prompt - focused on just names and filenames
            # Generate grounded response
            response = self.client.models.generate_content(
                model=os.getenv("VERTEX_MODEL", "gemini-1.5-flash"),
                contents=f"Check all resumes and CVs in the knowledge base that have \"{skill_or_requirement}\".",
                config=GenerateContentConfig(
                    tools=[tool],
                    system_instruction=f"""
                    You are an expert recruiter searching for candidates with specific skills.
                    
                    Rules:
                    1. Return only the candidate names and their filenames in this format: **Candidate Name** - filename.pdf
                    2. Keep it brief, maximum 5 candidates.
                    3. Try to find at least 2 unique matches.
                    4. Never invent candidate names.
                    5. If no candidates are found, respond with "No candidates found for {skill_or_requirement}".
                    6. Look everywhere in the knowledge base before concluding.
                    7. Do not include any other commentary.
                    """
                ),
            )

            response_text = response.text if hasattr(response, 'text') else None

            if not response_text or not response_text.strip():
                return {
                    'success': True,
                    'response_text': f'No candidates found with "{skill_or_requirement}"',
                    'count': 0
                }

            logger.info(f"Found candidates with skill: {skill_or_requirement}")
            return {
                'success': True,
                'response_text': response_text,
                'skill_searched': skill_or_requirement
            }

        except Exception as e:
            logger.error(f"Error searching by skill '{skill_or_requirement}': {e}")
            return {
                'success': False,
                'error': f'Failed to search for skill: {str(e)}'
            }

    def _gcs_to_sharepoint_url(self, gcs_path: str) -> Optional[str]:
        """
        Convert GCS bucket path to SharePoint URL

        Example:
        Input: gs://sales-support-ai-sharepoint-files/General/03-RFP's & Submission/2024-04-12 Albuquerque Public Schools, NM/Submissions/file.docx
        Output: https://cendien.sharepoint.com/sites/Cendien-SalesSupport/Shared%20Documents/General/03-RFP%27s%20%26%20Submission/2024-04-12%20Albuquerque%20Public%20Schools,%20NM/Submissions/file.docx
        """
        try:
            # Remove gs:// prefix and bucket name
            if gcs_path.startswith('gs://'):
                # Remove gs:// and extract path after bucket name
                # Format: gs://bucket-name/path/to/file
                path_parts = gcs_path.replace('gs://', '').split('/', 1)
                if len(path_parts) > 1:
                    # Get the path after the bucket name
                    relative_path = path_parts[1]
                else:
                    # Just the bucket name, no path
                    logger.warning(f"GCS path has no file path: {gcs_path}")
                    return None
            else:
                # If it doesn't start with gs://, treat it as a relative path
                relative_path = gcs_path

            # URL-encode each path component to handle special characters
            # Split by '/', encode each part, then rejoin
            path_components = relative_path.split('/')
            encoded_components = [quote(component, safe='') for component in path_components]
            encoded_path = '/'.join(encoded_components)

            # Construct SharePoint URL
            # The GCS bucket mirrors the SharePoint "Shared Documents" folder structure
            # So we prepend the SharePoint site base path
            sharepoint_url = f"https://cendien.sharepoint.com/sites/Cendien-SalesSupport/Shared%20Documents/{encoded_path}"

            return sharepoint_url

        except Exception as e:
            logger.error(f"Error converting GCS path to SharePoint URL: {e}")
            return None
