import requests
import msal
import logging
from typing import List, Dict, Optional, Any, Union
import os
from urllib.parse import quote, urlparse, parse_qs
from datetime import datetime, timedelta
import hashlib

logger = logging.getLogger(__name__)

class SharePointService:
    def __init__(self, azure_config: Dict[str, Any], cache_ttl_minutes: int = 15):
        self.client_id: str = azure_config['client_id']
        self.client_secret: str = azure_config['client_secret']
        self.tenant_id: str = azure_config['tenant_id']
        self.authority: str = azure_config['authority']
        self.scope: List[str] = ['https://graph.microsoft.com/.default']
        self._token: Optional[str] = None

        # Cache configuration
        self.cache_ttl_minutes = cache_ttl_minutes
        self._cache: Dict[str, Dict[str, Any]] = {}
        # Cache structure: {cache_key: {'data': [...], 'timestamp': datetime, 'ttl': datetime}}

    def _generate_cache_key(self, *args) -> str:
        """Generate a unique cache key from arguments"""
        key_string = '|'.join(str(arg) for arg in args)
        return hashlib.md5(key_string.encode()).hexdigest()

    def _get_from_cache(self, cache_key: str) -> Optional[Any]:
        """Retrieve data from cache if not expired"""
        if cache_key not in self._cache:
            return None

        cache_entry = self._cache[cache_key]
        if datetime.now() > cache_entry['ttl']:
            # Cache expired, remove it
            del self._cache[cache_key]
            logger.debug(f"Cache expired for key: {cache_key}")
            return None

        logger.debug(f"Cache hit for key: {cache_key}")
        return cache_entry['data']

    def _set_cache(self, cache_key: str, data: Any) -> None:
        """Store data in cache with TTL"""
        self._cache[cache_key] = {
            'data': data,
            'timestamp': datetime.now(),
            'ttl': datetime.now() + timedelta(minutes=self.cache_ttl_minutes)
        }
        logger.debug(f"Cached data for key: {cache_key}, TTL: {self.cache_ttl_minutes} minutes")

    def clear_cache(self) -> None:
        """Clear all cached data"""
        self._cache.clear()
        logger.info("SharePoint cache cleared")

    def _get_access_token(self) -> Optional[str]:
        """Get access token for Microsoft Graph API"""
        try:
            if self._token:
                return self._token

            app = msal.ConfidentialClientApplication(
                self.client_id,
                authority=self.authority,
                client_credential=self.client_secret
            )

            result = app.acquire_token_for_client(scopes=self.scope)

            if result and isinstance(result, dict) and 'access_token' in result:
                self._token = result['access_token']
                return self._token
            else:
                error_desc = result.get('error_description', 'Unknown error') if isinstance(result, dict) else 'Unknown error'
                logger.error(f"Token acquisition failed: {error_desc}")
                return None

        except Exception as e:
            logger.error(f"Error getting access token: {e}")
            return None

    def _parse_sharepoint_url(self, sharepoint_url: str) -> Optional[Dict[str, Union[str, bool]]]:
        """Parse SharePoint URL to extract site, drive, and folder path"""
        try:
            from urllib.parse import unquote

            # Handle different SharePoint URL formats:
            # 1. Old format: https://cendien.sharepoint.com/:f:/r/sites/Cendien-SalesSupport/Shared%20Documents/...
            # 2. New format: https://cendien.sharepoint.com/sites/Cendien-SalesSupport/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2F...

            if 'sharepoint.com' not in sharepoint_url:
                return None

            # Extract tenant name
            tenant = sharepoint_url.split('.sharepoint.com')[0].split('//')[-1]

            # Handle new format with ?id= parameter
            if '?id=' in sharepoint_url:
                folder_path = sharepoint_url.split('?id=')[1].split('&')[0]
                folder_path = unquote(folder_path)  # Decode URL encoding

                # Remove the site prefix to get just the folder path within the document library
                # /sites/Cendien-SalesSupport/Shared Documents/General/08-Job Requisitions/001_Oakland Req/472-Software Developer
                if folder_path.startswith('/sites/Cendien-SalesSupport/Shared Documents/'):
                    folder_path = folder_path[len('/sites/Cendien-SalesSupport/Shared Documents/'):]
                    return {
                        'site_name': 'Cendien-SalesSupport',
                        'folder_path': folder_path,
                        'tenant': tenant
                    }

            # Handle sharing format (:f:/s/)
            elif '/:f:/s/' in sharepoint_url:
                # Format: https://cendien.sharepoint.com/:f:/s/Cendien-SalesSupport/Esa6thJOK3FNilCFu9BJvIoBevQ-o19DDCpz4iGTuxm5WQ?email=...
                # This is a sharing link format - we need to resolve it differently
                # For now, we'll extract the site name and use a default path
                clean_url = sharepoint_url.split('?')[0]
                parsed = urlparse(clean_url)
                path = parsed.path

                if path.startswith('/:f:/s/'):
                    path = path[7:]  # Remove '/:f:/s/'

                path_parts = path.split('/')
                if len(path_parts) >= 1:
                    site_name = path_parts[0]  # 'Cendien-SalesSupport'

                    # For sharing links, we can't determine the exact folder path
                    # So we'll return the site info and let the user provide more specific paths
                    return {
                        'site_name': site_name,
                        'folder_path': '',  # Empty - will need to browse from root or provide specific path
                        'tenant': tenant,
                        'sharing_link': True  # Flag to indicate this is a sharing link
                    }

            # Handle old format (:f:/r/)
            elif '/:f:/r/' in sharepoint_url:
                clean_url = sharepoint_url.split('?')[0]  # Remove query parameters
                clean_url = clean_url.replace('%20', ' ').replace('%2520', ' ')

                parsed = urlparse(clean_url)
                path = parsed.path

                if path.startswith('/:f:/r/'):
                    path = path[7:]  # Remove '/:f:/r/'

                path_parts = path.split('/')

                if len(path_parts) < 3 or path_parts[0] != 'sites':
                    logger.error(f"Invalid SharePoint URL format: {sharepoint_url}")
                    return None

                site_name = path_parts[1]  # 'Cendien-SalesSupport'

                # The rest is the folder path within the document library
                if len(path_parts) > 2:
                    folder_path = '/'.join(path_parts[2:])

                    # Remove "Shared Documents" from the beginning if present
                    if folder_path.startswith('Shared Documents/'):
                        folder_path = folder_path[16:]  # Remove 'Shared Documents/'
                    elif folder_path == 'Shared Documents':
                        folder_path = ''
                else:
                    folder_path = ''

                return {
                    'site_name': site_name,
                    'folder_path': folder_path,
                    'tenant': tenant
                }

            return None

        except Exception as e:
            logger.error(f"Error parsing SharePoint URL {sharepoint_url}: {e}")
            return None

    def get_folder_files(self, sharepoint_url: str, recursive: bool = True, job_title: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all files in a SharePoint folder and optionally its subfolders"""
        try:
            # Generate cache key based on URL, recursive flag, and job title
            cache_key = self._generate_cache_key('folder_files', sharepoint_url, recursive, job_title)

            # Check cache first
            cached_files = self._get_from_cache(cache_key)
            if cached_files is not None:
                logger.info(f"Returning cached files for SharePoint URL: {sharepoint_url}")
                return cached_files

            token = self._get_access_token()
            if not token:
                return []

            url_info = self._parse_sharepoint_url(sharepoint_url)
            if not url_info:
                logger.error(f"Could not parse SharePoint URL: {sharepoint_url}")
                return []

            headers = {
                'Authorization': f'Bearer {token}',
                'Accept': 'application/json'
            }

            # Get site ID first
            site_url = f"https://graph.microsoft.com/v1.0/sites/{url_info['tenant']}.sharepoint.com:/sites/{url_info['site_name']}"
            site_response = requests.get(site_url, headers=headers)

            # If token expired, clear cache and retry once
            if site_response.status_code == 401:
                logger.warning("Token expired, refreshing...")
                self._token = None  # Clear cached token
                token = self._get_access_token()  # Get new token
                if token:
                    headers['Authorization'] = f'Bearer {token}'
                    site_response = requests.get(site_url, headers=headers)  # Retry
                else:
                    logger.error("Failed to refresh token")
                    return []

            if site_response.status_code != 200:
                logger.error(f"Failed to get site info: {site_response.status_code} - {site_response.text}")
                return []

            site_data = site_response.json()
            site_id = site_data.get('id')

            if not site_id:
                logger.error("Could not get site ID")
                return []

            # Get default drive (Shared Documents)
            drives_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"
            drives_response = requests.get(drives_url, headers=headers)

            if drives_response.status_code != 200:
                logger.error(f"Failed to get drives: {drives_response.status_code}")
                return []

            drives_data = drives_response.json()
            default_drive = None

            for drive in drives_data.get('value', []):
                if drive.get('name') == 'Documents':
                    default_drive = drive
                    break

            if not default_drive:
                logger.error("Could not find default drive")
                return []

            drive_id = default_drive['id']

            # Get folder contents
            folder_path_raw = url_info['folder_path']
            folder_path = folder_path_raw.strip('/') if isinstance(folder_path_raw, str) else ''

            # Special handling for sharing links - try to find the job requisitions folder
            if url_info.get('sharing_link') and not folder_path:
                if job_title:
                    # Try to find the specific job folder based on job title
                    job_folder = self._find_job_folder_by_title(site_id, drive_id, headers, job_title)
                    if job_folder:
                        folder_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{job_folder['id']}/children"
                        logger.info(f"Found specific job folder for '{job_title}': {job_folder['name']}")
                    else:
                        # Fallback to general job requisitions folder
                        job_req_path = "General/08-Job Requisitions"
                        folder_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{quote(job_req_path)}:/children"
                        logger.info(f"Job folder not found, using default path: {job_req_path}")
                else:
                    # No job title provided, use general path
                    job_req_path = "General/08-Job Requisitions"
                    folder_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{quote(job_req_path)}:/children"
                    logger.info(f"Using default job requisitions path for sharing link: {job_req_path}")
            elif folder_path:
                folder_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{quote(folder_path)}:/children"
            else:
                folder_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root/children"

            files = self._get_files_recursive(folder_url, headers, recursive, "", site_id, drive_id)

            # Cache the results
            self._set_cache(cache_key, files)
            logger.info(f"Fetched and cached {len(files)} files from SharePoint")

            return files

        except Exception as e:
            logger.error(f"Error getting folder files from {sharepoint_url}: {e}")
            return []

    def _get_files_recursive(self, folder_url: str, headers: Dict[str, str], recursive: bool, current_path: str = "", site_id: str = None, drive_id: str = None) -> List[Dict[str, Any]]:
        """Recursively get files from folders"""
        try:
            files = []
            response = requests.get(folder_url, headers=headers)

            if response.status_code != 200:
                logger.error(f"Failed to get folder contents: {response.status_code} - {response.text}")
                return files

            data = response.json()

            # Extract site_id and drive_id from folder_url if not provided
            if not site_id or not drive_id:
                url_parts = folder_url.split('/')
                for i, part in enumerate(url_parts):
                    if part == 'sites' and i + 1 < len(url_parts):
                        site_id = url_parts[i + 1]
                    elif part == 'drives' and i + 1 < len(url_parts):
                        drive_id = url_parts[i + 1]

            for item in data.get('value', []):
                item_path = f"{current_path}/{item['name']}" if current_path else item['name']

                if 'file' in item:  # It's a file
                    file_info = {
                        'id': item['id'],
                        'name': item['name'],
                        'path': item_path,
                        'size': item['size'],
                        'download_url': item.get('@microsoft.graph.downloadUrl'),
                        'web_url': item.get('webUrl'),
                        'mime_type': item.get('file', {}).get('mimeType'),
                        'type': 'file',
                        'created_datetime': item.get('createdDateTime'),
                        'modified_datetime': item.get('lastModifiedDateTime'),
                        'site_id': site_id,  # Include site_id for URL refresh
                        'drive_id': drive_id  # Include drive_id for URL refresh
                    }
                    files.append(file_info)

                elif 'folder' in item and recursive:  # It's a folder and we want to recurse
                    # Verify we have required IDs before recursing
                    if not site_id or not drive_id:
                        logger.error(f"Cannot recurse into subfolder {item_path}: missing site_id or drive_id")
                        continue

                    # Use the Graph API children endpoint directly
                    subfolder_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{item['id']}/children"
                    logger.info(f"Recursing into subfolder: {item_path} (URL: {subfolder_url})")
                    subfolder_files = self._get_files_recursive(subfolder_url, headers, recursive, item_path, site_id, drive_id)
                    files.extend(subfolder_files)
                    logger.info(f"Found {len(subfolder_files)} files in subfolder: {item_path}")

            return files

        except Exception as e:
            logger.error(f"Error in recursive file fetch: {e}")
            return []

    def download_file(self, file_id: str, site_id: str, drive_id: str) -> Optional[bytes]:
        """Download a file by its ID"""
        try:
            token = self._get_access_token()
            if not token:
                return None

            headers = {
                'Authorization': f'Bearer {token}',
            }

            # Get download URL
            file_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{file_id}"
            file_response = requests.get(file_url, headers=headers)

            if file_response.status_code != 200:
                logger.error(f"Failed to get file info: {file_response.status_code}")
                return None

            file_data = file_response.json()
            download_url = file_data.get('@microsoft.graph.downloadUrl')

            if not download_url:
                logger.error("No download URL found")
                return None

            # Download the file
            download_response = requests.get(download_url)
            if download_response.status_code == 200:
                return download_response.content
            else:
                logger.error(f"Failed to download file: {download_response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Error downloading file {file_id}: {e}")
            return None

    def get_file_content_as_text(self, download_url: str) -> Optional[str]:
        """Download file content and return as text (for job descriptions)"""
        try:
            response = requests.get(download_url)
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '').lower()

                if 'text' in content_type:
                    return response.text
                elif 'pdf' in content_type:
                    # For PDFs, we'd need to process with gemini_file_processor
                    return "[PDF file - content extraction needed]"
                elif 'word' in content_type or 'docx' in content_type:
                    # For Word docs, we'd need to process with gemini_file_processor
                    return "[Word document - content extraction needed]"
                else:
                    return f"[{content_type} file - content extraction needed]"
            else:
                logger.error(f"Failed to download file content: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error downloading file content as text: {e}")
            return None

    def convert_web_url_to_download_url(self, sharepoint_web_url: str) -> Optional[Dict[str, str]]:
        """
        Convert a SharePoint web URL to a Graph API download URL

        Args:
            sharepoint_web_url: SharePoint web URL (e.g., https://cendien.sharepoint.com/sites/.../file.pdf)

        Returns:
            Dictionary with download_url, file_id, site_id, drive_id, or None if conversion fails
        """
        try:
            from urllib.parse import unquote

            token = self._get_access_token()
            if not token:
                logger.error("Failed to get access token")
                return None

            # Parse the web URL to extract site, drive path, and file path
            # Format: https://cendien.sharepoint.com/sites/Cendien-SalesSupport/Shared%20Documents/path/to/file.pdf
            if 'sharepoint.com' not in sharepoint_web_url:
                logger.error(f"Not a SharePoint URL: {sharepoint_web_url}")
                return None

            # Extract tenant and site
            url_parts = sharepoint_web_url.split('/')
            tenant = url_parts[2].split('.sharepoint.com')[0]

            # Find 'sites' index
            try:
                sites_idx = url_parts.index('sites')
                site_name = url_parts[sites_idx + 1]
            except (ValueError, IndexError):
                logger.error(f"Could not extract site name from URL: {sharepoint_web_url}")
                return None

            # Extract the file path (everything after "Shared Documents" or "Shared%20Documents")
            # Join remaining parts and decode
            remaining_path = '/'.join(url_parts[sites_idx + 2:])
            remaining_path = unquote(remaining_path)

            # Remove "Shared Documents/" prefix if present
            if remaining_path.startswith('Shared Documents/'):
                file_path = remaining_path[len('Shared Documents/'):]
            elif remaining_path.startswith('Shared%20Documents/'):
                file_path = remaining_path[len('Shared%20Documents/'):]
            else:
                file_path = remaining_path

            logger.info(f"Converting web URL to download URL - Site: {site_name}, File path: {file_path}")

            headers = {
                'Authorization': f'Bearer {token}',
                'Accept': 'application/json'
            }

            # Get site ID
            site_url = f"https://graph.microsoft.com/v1.0/sites/{tenant}.sharepoint.com:/sites/{site_name}"
            site_response = requests.get(site_url, headers=headers)

            if site_response.status_code == 401:
                logger.warning("Token expired, refreshing...")
                self._token = None
                token = self._get_access_token()
                if token:
                    headers['Authorization'] = f'Bearer {token}'
                    site_response = requests.get(site_url, headers=headers)
                else:
                    logger.error("Failed to refresh token")
                    return None

            if site_response.status_code != 200:
                logger.error(f"Failed to get site info: {site_response.status_code} - {site_response.text}")
                return None

            site_data = site_response.json()
            site_id = site_data.get('id')

            # Get default drive
            drives_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"
            drives_response = requests.get(drives_url, headers=headers)

            if drives_response.status_code != 200:
                logger.error(f"Failed to get drives: {drives_response.status_code}")
                return None

            drives_data = drives_response.json()
            default_drive = None

            for drive in drives_data.get('value', []):
                if drive.get('name') == 'Documents':
                    default_drive = drive
                    break

            if not default_drive:
                logger.error("Could not find default drive")
                return None

            drive_id = default_drive['id']

            # Get file metadata using the file path
            file_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{quote(file_path)}"
            file_response = requests.get(file_url, headers=headers)

            if file_response.status_code != 200:
                logger.error(f"Failed to get file info: {file_response.status_code} - {file_response.text}")
                return None

            file_data = file_response.json()
            download_url = file_data.get('@microsoft.graph.downloadUrl')
            file_id = file_data.get('id')

            if not download_url or not file_id:
                logger.error("No download URL or file ID in response")
                return None

            logger.info(f"Successfully converted web URL to download URL for file: {file_path}")
            return {
                'download_url': download_url,
                'file_id': file_id,
                'site_id': site_id,
                'drive_id': drive_id
            }

        except Exception as e:
            logger.error(f"Error converting web URL to download URL: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None

    def get_file_content_as_binary(self, download_url: str, file_id: str = None, site_id: str = None, drive_id: str = None) -> Optional[bytes]:
        """Download file content and return as binary data (for resume files)"""
        try:
            response = requests.get(download_url)

            # If download URL expired (401), try to refresh it using file_id
            if response.status_code == 401 and file_id and site_id and drive_id:
                logger.warning("Download URL expired, refreshing...")

                token = self._get_access_token()
                if not token:
                    logger.error("Failed to get access token for download")
                    return None

                headers = {
                    'Authorization': f'Bearer {token}',
                    'Accept': 'application/json'
                }

                # Get fresh download URL
                file_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{file_id}"
                file_response = requests.get(file_url, headers=headers)

                # If token also expired, refresh it
                if file_response.status_code == 401:
                    self._token = None
                    token = self._get_access_token()
                    if token:
                        headers['Authorization'] = f'Bearer {token}'
                        file_response = requests.get(file_url, headers=headers)
                    else:
                        logger.error("Failed to refresh token")
                        return None

                if file_response.status_code == 200:
                    file_data = file_response.json()
                    fresh_download_url = file_data.get('@microsoft.graph.downloadUrl')

                    if fresh_download_url:
                        logger.info("Successfully refreshed download URL, retrying download")
                        response = requests.get(fresh_download_url)
                    else:
                        logger.error("No download URL in refreshed file metadata")
                        return None
                else:
                    logger.error(f"Failed to refresh file metadata: {file_response.status_code}")
                    return None

            if response.status_code == 200:
                return response.content
            else:
                logger.error(f"Failed to download file content: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Error downloading file content: {e}")
            return None

    def categorize_files(self, files: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Show all files in both categories - let users decide which to process"""
        # Filter to only include PDF and DOCX files
        processable_files = [
            file for file in files
            if file.get('mime_type', '').lower() in [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword'
            ] or file['name'].lower().endswith(('.pdf', '.docx', '.doc'))
        ]

        return {
            'job_files': processable_files,
            'resume_files': processable_files
        }


    def _find_job_folder_by_title(self, site_id: str, drive_id: str, headers: Dict[str, str], job_title: str) -> Optional[Dict[str, Any]]:
        """Find a job folder that matches the job title"""
        try:
            # First, browse the job requisitions folder
            job_req_path = "General/08-Job Requisitions"
            folder_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{quote(job_req_path)}:/children"

            response = requests.get(folder_url, headers=headers)
            if response.status_code != 200:
                logger.warning(f"Could not access job requisitions folder: {response.status_code}")
                return None

            folder_data = response.json()

            # Look through subfolders (001_Oakland Req, 002_Infor-Beeline Reqs, etc.)
            for item in folder_data.get('value', []):
                if 'folder' in item:
                    # Browse this subfolder
                    subfolder_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{item['id']}/children"

                    subfolder_response = requests.get(subfolder_url, headers=headers)
                    if subfolder_response.status_code == 200:
                        subfolder_data = subfolder_response.json()

                        # Look for job folders that match the title
                        for job_folder in subfolder_data.get('value', []):
                            if 'folder' in job_folder:
                                folder_name = job_folder.get('name', '').lower()

                                # Extract job number and title from Monday job title
                                # e.g., "472 - Software Developer" -> look for "472" or "software developer"
                                job_parts = job_title.lower().split(' - ', 1)
                                if len(job_parts) >= 2:
                                    job_number = job_parts[0].strip()
                                    job_name = job_parts[1].strip()

                                    # Check if folder name contains job number or job name
                                    if (job_number in folder_name or
                                        any(word in folder_name for word in job_name.split() if len(word) > 3)):
                                        logger.info(f"Found matching job folder: {job_folder.get('name')} for job: {job_title}")
                                        return job_folder

            return None

        except Exception as e:
            logger.error(f"Error finding job folder for '{job_title}': {e}")
            return None

    def upload_file_to_folder(self, sharepoint_url: str, file_content: bytes, filename: str, job_title: Optional[str] = None, subfolder: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Upload a file to a SharePoint folder

        Args:
            sharepoint_url: SharePoint folder URL
            file_content: File content as bytes
            filename: Name of the file to create
            job_title: Optional job title to find specific job folder
            subfolder: Optional subfolder name to create/upload to within the target folder

        Returns:
            Uploaded file information or None on failure
        """
        try:
            token = self._get_access_token()
            if not token:
                logger.error("Failed to get access token for upload")
                return None

            url_info = self._parse_sharepoint_url(sharepoint_url)
            if not url_info:
                logger.error(f"Could not parse SharePoint URL: {sharepoint_url}")
                return None

            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/octet-stream'
            }

            # Get site ID
            site_url = f"https://graph.microsoft.com/v1.0/sites/{url_info['tenant']}.sharepoint.com:/sites/{url_info['site_name']}"
            site_response = requests.get(site_url, headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'})

            # If token expired, clear cache and retry once
            if site_response.status_code == 401:
                logger.warning("Token expired during upload, refreshing...")
                self._token = None  # Clear cached token
                token = self._get_access_token()  # Get new token
                if token:
                    headers['Authorization'] = f'Bearer {token}'
                    site_response = requests.get(site_url, headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'})
                else:
                    logger.error("Failed to refresh token")
                    return None

            if site_response.status_code != 200:
                logger.error(f"Failed to get site info: {site_response.status_code} - {site_response.text}")
                return None

            site_data = site_response.json()
            site_id = site_data.get('id')

            if not site_id:
                logger.error("Could not get site ID")
                return None

            # Get default drive
            drives_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"
            drives_response = requests.get(drives_url, headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'})

            if drives_response.status_code != 200:
                logger.error(f"Failed to get drives: {drives_response.status_code}")
                return None

            drives_data = drives_response.json()
            default_drive = None

            for drive in drives_data.get('value', []):
                if drive.get('name') == 'Documents':
                    default_drive = drive
                    break

            if not default_drive:
                logger.error("Could not find default drive")
                return None

            drive_id = default_drive['id']

            # Determine upload path
            folder_path_raw = url_info['folder_path']
            folder_path = folder_path_raw.strip('/') if isinstance(folder_path_raw, str) else ''

            # Handle sharing links - try to find specific job folder
            if url_info.get('sharing_link') and job_title:
                job_folder = self._find_job_folder_by_title(site_id, drive_id, headers, job_title)
                if job_folder:
                    # Upload to specific job folder (with optional subfolder)
                    if subfolder:
                        upload_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{job_folder['id']}:/{quote(subfolder)}/{filename}:/content"
                        logger.info(f"Uploading to job folder: {job_folder['name']}/{subfolder}")
                    else:
                        upload_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{job_folder['id']}:/{filename}:/content"
                        logger.info(f"Uploading to job folder: {job_folder['name']}")
                else:
                    logger.error(f"Could not find job folder for: {job_title}")
                    return None
            elif folder_path:
                # Upload to specified folder path (with optional subfolder)
                if subfolder:
                    full_path = f"{folder_path}/{subfolder}"
                    upload_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{quote(full_path)}/{filename}:/content"
                else:
                    upload_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{quote(folder_path)}/{filename}:/content"
            else:
                # Upload to root (with optional subfolder)
                if subfolder:
                    upload_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{quote(subfolder)}/{filename}:/content"
                else:
                    upload_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{filename}:/content"

            # Upload file
            upload_response = requests.put(upload_url, headers=headers, data=file_content)

            if upload_response.status_code in [200, 201]:
                upload_data = upload_response.json()
                logger.info(f"Successfully uploaded file: {filename}")
                return {
                    'id': upload_data.get('id'),
                    'name': upload_data.get('name'),
                    'web_url': upload_data.get('webUrl'),
                    'size': upload_data.get('size')
                }
            else:
                logger.error(f"Failed to upload file: {upload_response.status_code} - {upload_response.text}")
                return None

        except Exception as e:
            logger.error(f"Error uploading file to SharePoint: {e}")
            return None
