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
    def __init__(self):
        """Initialize Vertex AI Search service with grounding configuration"""
        self.project_id = "cendien-sales-support-ai"
        self.location = "global"
        self.datastore_id = "sharepoint-files-datastore"

        # Construct datastore path
        self.datastore_path = f"projects/{self.project_id}/locations/{self.location}/collections/default_collection/dataStores/{self.datastore_id}"

        # Initialize client for Vertex AI using Application Default Credentials
        os.environ['GOOGLE_GENAI_USE_VERTEXAI'] = 'True'
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
            prompt = f"""Based on the job description below, find relevant candidate resumes in the knowledge base that would be a good match for this position.

Job Description:
{job_description}

Please identify candidates whose experience, skills, and qualifications align with this job's requirements.
Just retrun of Candidate names in and numbered list format. Format the response in markdown, use bold for candidate names. 
For each candidate, include the filename that you found them in. 
State the number of candidates found at the end of the list as "Top x candidates found".
Sort the list by best match first. Provide reasoning for each candidate in 1-2 sentences.
Do not include any other additional commentary or explanation."""

            # Generate grounded response
            response = self.client.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt,
                config=GenerateContentConfig(
                    tools=[tool],
                ),
            )

            # Extract filenames from grounding metadata
            filenames = self._extract_filenames_from_response(response)

            logger.info(f"Extracted {len(filenames)} filenames from grounding metadata")

            if not filenames:
                logger.info("No candidates found in search results")
                return {
                    'success': True,
                    'candidates': [],
                    'message': 'No matching candidates found in the knowledge base'
                }

            # Transform GCS paths to SharePoint URLs
            candidates = self._transform_to_sharepoint_urls(filenames)

            logger.info(f"Found {len(candidates)} potential candidates")
            return {
                'success': True,
                'candidates': candidates,
                'response_text': response.text if hasattr(response, 'text') else None
            }

        except Exception as e:
            logger.error(f"Error searching for candidates: {e}")
            return {
                'success': False,
                'error': f'Failed to search for candidates: {str(e)}'
            }

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
                        uri = getattr(context, 'uri', '')
                        title = getattr(context, 'title', '')

                        # Prefer URI as it has the full path
                        if uri:
                            file_uris.append(uri)
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
