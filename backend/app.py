from flask import Flask, request, jsonify, session, send_from_directory, Response, stream_with_context
from flask_cors import CORS
import os
from dotenv import load_dotenv, find_dotenv
import msal
import firebase_admin
from firebase_admin import credentials, firestore
from google import genai
from google.genai import types
from services.gemini_analyzer import GeminiAnalyzer
from services.firestore_service import FirestoreService
from services.monday_service import MondayService
from services.sharepoint_service import SharePointService
from services.resume_service import ResumeService
from services.activity_logger_service import ActivityLoggerService
from services.vertex_search_service import VertexSearchService
from services.openai_analyzer import OpenAIAnalyzer
from services.web_verification_service import WebVerificationService
import logging
import base64
import json
import uuid

# Load environment variables from shared .env
load_dotenv(find_dotenv())

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')
FRONTEND_DIST_DIR = os.path.join(STATIC_DIR, 'frontend')
LOGO_FILENAME = 'cendien_corp_logo.jpg'
LOGO_URL_PATH = f'/static/{LOGO_FILENAME}'
LOGO_FILE_PATH = os.path.join(STATIC_DIR, LOGO_FILENAME)

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')

# Configure CORS
CORS(app, origins=[os.getenv('FRONTEND_URL', 'http://localhost:3000')],
     supports_credentials=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Firebase with explicit project
try:
    # Check if already initialized (prevents re-initialization errors)
    try:
        firebase_admin.get_app()
        logger.info("Firebase already initialized")
    except ValueError:
        # Initialize with explicit project ID
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'projectId': 'cendien-sales-support-ai',
        })
        logger.info("Firebase initialized successfully with project: cendien-sales-support-ai")
except Exception as e:
    logger.error(f"Firebase initialization failed: {e}")

# Initialize services
firestore_cache_ttl = int(os.getenv('FIRESTORE_CACHE_TTL_SECONDS', '30'))
firestore_service = FirestoreService(cache_ttl_seconds=firestore_cache_ttl)
gemini_analyzer = GeminiAnalyzer(os.getenv('GEMINI_API_KEY'))
openai_analyzer = OpenAIAnalyzer(os.getenv('OPENAI_API_KEY')) if os.getenv('OPENAI_API_KEY') else None
monday_cache_ttl = int(os.getenv('MONDAY_CACHE_TTL_SECONDS', '60'))
monday_service = MondayService(os.getenv('MONDAY_API_KEY'), cache_ttl_seconds=monday_cache_ttl) if os.getenv('MONDAY_API_KEY') else None
logger.info(f"Firestore cache TTL: {firestore_cache_ttl}s, Monday cache TTL: {monday_cache_ttl}s")
resume_service = ResumeService(os.getenv('GEMINI_API_KEY'))
activity_logger = ActivityLoggerService()

# Azure AD Configuration
AZURE_CONFIG = {
    'client_id': os.getenv('AZURE_CLIENT_ID'),
    'client_secret': os.getenv('AZURE_CLIENT_SECRET'),
    'tenant_id': os.getenv('AZURE_TENANT_ID'),
    'authority': os.getenv('AZURE_AUTHORITY'),
    'scope': ['User.Read']
}

# Initialize SharePoint service after AZURE_CONFIG
# Cache TTL can be configured via environment variable (default: 15 minutes)
sharepoint_cache_ttl = int(os.getenv('SHAREPOINT_CACHE_TTL_MINUTES', '15'))
sharepoint_service = SharePointService(AZURE_CONFIG, cache_ttl_minutes=sharepoint_cache_ttl)
logger.info(f"SharePoint service initialized with cache TTL: {sharepoint_cache_ttl} minutes")

# Initialize Vertex Search service with SharePoint service for metadata enrichment
vertex_search_service = VertexSearchService(sharepoint_service=sharepoint_service)
logger.info("Vertex AI Search service initialized with SharePoint integration")


def build_job_analysis_payload(job_description, extraction_data=None, analyzer=None):
    job_description = (job_description or '').strip()
    
    # Default to Gemini if no analyzer provided (backward compatibility)
    if analyzer is None:
        analyzer = gemini_analyzer

    job_analysis = {}
    if job_description:
        # Use the provided analyzer
        job_analysis = analyzer.analyze_job_description(job_description) or {}

    requirements = {}
    if job_analysis:
        requirements = {
            'mandatory_skills': job_analysis.get('mandatory_skills', []),
            'preferred_skills': job_analysis.get('preferred_skills', []),
            'experience_years': job_analysis.get('experience_years', ''),
            'education': job_analysis.get('education', []),
            'soft_skills': job_analysis.get('soft_skills', [])
        }

    skill_weights = {}
    if job_analysis:
        skill_weights = {
            item.get('skill_name'): item.get('weight')
            for item in job_analysis.get('skill_weights', [])
            if isinstance(item, dict) and item.get('skill_name')
        }

    payload = {
        'description': job_description,
        'requirements': requirements,
        'skill_weights': skill_weights
    }

    if extraction_data is not None:
        payload['extracted_data'] = {
            'required_skills': extraction_data.get('required_skills', []),
            'preferred_skills': extraction_data.get('preferred_skills', []),
            'experience_requirements': extraction_data.get('experience_requirements', ''),
            'education_requirements': extraction_data.get('education_requirements', []),
            'certifications': extraction_data.get('certifications', []),
            'key_responsibilities': extraction_data.get('key_responsibilities', []),
            'soft_skills': extraction_data.get('soft_skills', []),
            'other': extraction_data.get('other', []),
            'questions_for_candidate': extraction_data.get('questions_for_candidate', [])
        }

    return payload


def build_job_chat_context(job: dict, candidates: list) -> str:
    job_payload = {
        'id': job.get('id'),
        'title': job.get('title'),
        'description': job.get('description'),
        'requirements': job.get('requirements'),
        'skill_weights': job.get('skill_weights'),
        'extracted_data': job.get('extracted_data'),
        'monday_metadata': job.get('monday_metadata')
    }

    context = {
        'job': job_payload,
        'candidates': candidates
    }

    return (
        "You are an AI assistant for a resume evaluation system. "
        "Use ONLY the provided job and candidate data plus grounded retrieval results to answer questions.\n\n"
        "CONTEXT DATA (do not omit any details):\n"
        f"{json.dumps(context, indent=2)}"
    )


def normalize_chat_messages(raw_messages: list) -> list:
    normalized = []
    if not isinstance(raw_messages, list):
        return normalized
    for message in raw_messages:
        if not isinstance(message, dict):
            continue
        role = message.get('role')
        content = message.get('content')
        if role not in ('user', 'assistant'):
            continue
        if not isinstance(content, str):
            continue
        normalized.append({
            'id': message.get('id') or uuid.uuid4().hex,
            'role': role,
            'content': content
        })
    return normalized

def get_msal_app():
    return msal.ConfidentialClientApplication(
        AZURE_CONFIG['client_id'],
        authority=AZURE_CONFIG['authority'],
        client_credential=AZURE_CONFIG['client_secret']
    )

# JWT token parsing helper
def decode_jwt_token(token):
    """Decode JWT token without verification (for development)"""
    try:
        # Split the token and decode the payload
        parts = token.split('.')
        if len(parts) != 3:
            return None

        # Add padding if needed
        payload = parts[1]
        payload += '=' * (4 - len(payload) % 4)

        # Decode base64
        decoded_bytes = base64.urlsafe_b64decode(payload)
        decoded_json = json.loads(decoded_bytes)

        return decoded_json
    except Exception as e:
        logger.error(f"Error decoding JWT token: {e}")
        return None

# Authentication middleware
def require_auth(f):
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# Authentication routes
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        access_token = data.get('code')  # Frontend sends access token in 'code' field

        if not access_token:
            return jsonify({'error': 'Access token required'}), 400

        # Decode JWT token to extract user information
        token_payload = decode_jwt_token(access_token)

        if not token_payload:
            logger.error("Failed to decode JWT token")
            return jsonify({'error': 'Invalid access token'}), 401

        # Extract email from various possible claims
        user_email = (token_payload.get('email') or
                     token_payload.get('preferred_username') or
                     token_payload.get('upn') or
                     token_payload.get('unique_name'))

        if not user_email:
            logger.error("No email claim found in JWT token")
            return jsonify({'error': 'Invalid token: missing email claim'}), 401

        # Extract user name
        user_name = token_payload.get('name')
        if not user_name:
            given_name = token_payload.get('given_name', '')
            family_name = token_payload.get('family_name', '')
            user_name = f"{given_name} {family_name}".strip() or user_email.split('@')[0]

        # Store session data with extracted user info
        session['user'] = {
            'authenticated': True,
            'token': access_token,
            'email': user_email,
            'name': user_name
        }

        # Log the login activity
        activity_logger.log_activity(
            user_email=user_email,
            user_name=user_name,
            action='login'
        )

        return jsonify({'success': True, 'user': session['user']})

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500

@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/auth/user', methods=['GET'])
@require_auth
def get_user():
    return jsonify({'user': session['user']})

# Job position routes
@app.route('/api/jobs', methods=['POST'])
@require_auth
def create_job():
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ['title', 'description']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400

        # Use AI to extract job requirements and assign weights
        # Explicitly use Gemini for direct job creation for now
        job_analysis = gemini_analyzer.analyze_job_description(data['description'])

        # Construct requirements object from flattened job analysis
        requirements = {
            'mandatory_skills': job_analysis.get('mandatory_skills', []),
            'preferred_skills': job_analysis.get('preferred_skills', []),
            'experience_years': job_analysis.get('experience_years', ''),
            'education': job_analysis.get('education', []),
            'soft_skills': job_analysis.get('soft_skills', [])
        } if job_analysis else {}

        job_data = {
            'title': data['title'],
            'description': data['description'],
            'status': data.get('status', 'active'),
            'requirements': requirements,
            'skill_weights': {item['skill_name']: item['weight'] for item in job_analysis.get('skill_weights', [])},
            'created_by': session['user']['email'],
            'created_at': firestore.SERVER_TIMESTAMP
        }

        job_id = firestore_service.create_job(job_data)

        # Log the job creation activity
        activity_logger.log_activity(
            user_email=session['user']['email'],
            user_name=session['user']['name'],
            action='job_created',
            details={'job_title': data['title']}
        )

        return jsonify({'success': True, 'job_id': job_id})

    except Exception as e:
        logger.error(f"Create job error: {e}")
        return jsonify({'error': 'Failed to create job'}), 500

@app.route('/api/jobs/upload-pdf', methods=['POST'])
@require_auth
def create_job_from_pdf():
    try:
        if 'job_pdf' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['job_pdf']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not file.filename.lower().endswith(('.pdf', '.doc', '.docx')):
            return jsonify({'error': 'Only PDF or DOCX files are allowed'}), 400

        # Validate and extract structured data using Gemini
        is_valid, error_msg = gemini_analyzer.validate_file(file)
        if not is_valid:
            return jsonify({'error': error_msg}), 400

        # Extract structured job information
        job_extraction = gemini_analyzer.analyze_job_description_from_file(file)
        if not job_extraction or not job_extraction.get('job_title'):
            return jsonify({'error': 'Could not extract job information from file'}), 400

        # Get additional form data
        title = request.form.get('title', '').strip()
        # Use extracted title from PDF if no title provided by user
        if not title:
            title = job_extraction.get('job_title', '').strip()

        # Fallback: use filename without extension if still no title
        if not title:
            title = file.filename.rsplit('.', 1)[0]

        # Use the full job description text from extraction
        job_description = job_extraction.get('job_description_text', '')

        analysis_payload = build_job_analysis_payload(job_description, job_extraction, analyzer=gemini_analyzer)

        job_data = {
            'title': title,
            'status': 'active',
            'created_by': session['user']['email'],
            'created_at': firestore.SERVER_TIMESTAMP,
            'source': 'file_upload',
            'source_filename': file.filename
        }
        job_data.update(analysis_payload)

        job_id = firestore_service.create_job(job_data)

        # Log the job creation activity
        activity_logger.log_activity(
            user_email=session['user']['email'],
            user_name=session['user']['name'],
            action='job_created',
            details={'job_title': title}
        )

        return jsonify({'success': True, 'job_id': job_id})

    except Exception as e:
        logger.error(f"Create job from PDF error: {e}")
        return jsonify({'error': 'Failed to create job from PDF'}), 500

@app.route('/api/jobs', methods=['GET'])
@require_auth
def get_jobs():
    try:
        jobs = firestore_service.get_all_jobs()
        return jsonify({'jobs': jobs})
    except Exception as e:
        logger.error(f"Get jobs error: {e}")
        return jsonify({'error': 'Failed to retrieve jobs'}), 500

@app.route('/api/jobs/<job_id>', methods=['GET'])
@require_auth
def get_job(job_id):
    try:
        job = firestore_service.get_job(job_id)
        if job:
            return jsonify({'job': job})
        else:
            return jsonify({'error': 'Job not found'}), 404
    except Exception as e:
        logger.error(f"Get job error: {e}")
        return jsonify({'error': 'Failed to retrieve job'}), 500

@app.route('/api/jobs/<job_id>', methods=['DELETE'])
@require_auth
def delete_job(job_id):
    try:
        # Check if job exists and user has permission to delete it
        job = firestore_service.get_job(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        # For now, allow any authenticated user to delete (in production, check ownership)
        success = firestore_service.delete_job(job_id)
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to delete job'}), 500

    except Exception as e:
        logger.error(f"Delete job error: {e}")
        return jsonify({'error': 'Failed to delete job'}), 500

@app.route('/api/jobs/sync-monday', methods=['POST'])
@require_auth
def sync_jobs_from_monday():
    try:
        if not monday_service:
            return jsonify({'error': 'Monday.com integration not configured'}), 500

        # Sync jobs from Monday.com
        result = monday_service.sync_jobs(firestore_service)

        if result['success']:
            return jsonify({
                'success': True,
                'message': f"Successfully synced {result['total_synced']} jobs from Monday.com",
                'synced_jobs': result['synced_jobs'],
                'errors': result.get('errors', [])
            })
        else:
            return jsonify({'error': result['message']}), 500

    except Exception as e:
        logger.error(f"Sync Monday jobs error: {e}")
        return jsonify({'error': 'Failed to sync jobs from Monday.com'}), 500

# SharePoint integration routes
@app.route('/api/jobs/<job_id>/sharepoint-files', methods=['GET'])
@require_auth
def get_job_sharepoint_files(job_id):
    try:
        # Get job details
        job = firestore_service.get_job(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        # Check if job has SharePoint link in metadata
        sharepoint_link = job.get('monday_metadata', {}).get('sharepoint_link')
        if not sharepoint_link:
            return jsonify({'error': 'No SharePoint link found for this job'}), 404

        # Get files from SharePoint
        files = sharepoint_service.get_folder_files(sharepoint_link, recursive=True, job_title=job.get('title'))
        if not files:
            return jsonify({'error': 'No files found or access denied'}), 404

        # Categorize files
        categorized = sharepoint_service.categorize_files(files)

        return jsonify({
            'success': True,
            'sharepoint_link': sharepoint_link,
            'job_files': categorized['job_files'],
            'resume_files': categorized['resume_files'],
            'total_files': len(files)
        })

    except Exception as e:
        logger.error(f"Get SharePoint files error: {e}")
        return jsonify({'error': 'Failed to retrieve SharePoint files'}), 500

@app.route('/api/jobs/<job_id>/debug-sharepoint', methods=['GET'])
@require_auth
def debug_sharepoint_job(job_id):
    try:
        # Get job details
        job = firestore_service.get_job(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        debug_info = {
            'job_title': job.get('title'),
            'job_id': job_id,
            'monday_metadata': job.get('monday_metadata', {}),
            'sharepoint_link': job.get('monday_metadata', {}).get('sharepoint_link'),
            'created_by': job.get('created_by'),
        }

        # Test URL parsing if SharePoint link exists
        sharepoint_link = job.get('monday_metadata', {}).get('sharepoint_link')
        if sharepoint_link:
            url_info = sharepoint_service._parse_sharepoint_url(sharepoint_link)
            debug_info['parsed_url'] = url_info
        else:
            debug_info['error'] = 'No SharePoint link found'

        return jsonify(debug_info)

    except Exception as e:
        logger.error(f"Debug SharePoint error: {e}")
        return jsonify({'error': f'Debug failed: {str(e)}'}), 500

@app.route('/api/sharepoint/download-file', methods=['POST'])
@require_auth
def download_sharepoint_file():
    try:
        data = request.get_json()
        download_url = data.get('download_url')
        as_binary = data.get('as_binary', False)  # Flag to determine if we need binary content
        file_id = data.get('file_id')  # File ID for refreshing expired URLs
        site_id = data.get('site_id')  # Site ID for refreshing expired URLs
        drive_id = data.get('drive_id')  # Drive ID for refreshing expired URLs

        logger.info(f"Download request - URL: {download_url[:100] if download_url else 'None'}...")
        logger.info(f"Download metadata - file_id: {file_id}, site_id: {site_id}, drive_id: {drive_id}")

        if not download_url:
            return jsonify({'error': 'Download URL required'}), 400

        # If metadata is missing and this is a SharePoint web URL, convert it to a download URL
        if not file_id and 'sharepoint.com' in download_url:
            logger.info("Metadata missing - converting SharePoint web URL to download URL")
            try:
                # Convert the SharePoint web URL directly to a Graph API download URL
                fresh_metadata = sharepoint_service.convert_web_url_to_download_url(download_url)

                if fresh_metadata:
                    download_url = fresh_metadata.get('download_url')
                    file_id = fresh_metadata.get('file_id')
                    site_id = fresh_metadata.get('site_id')
                    drive_id = fresh_metadata.get('drive_id')
                    logger.info(f"Successfully converted web URL to download URL")
                else:
                    logger.warning(f"Could not convert web URL to download URL")
            except Exception as e:
                logger.warning(f"Error converting web URL: {e}")

        if as_binary:
            # Get binary content for resume files, with support for refreshing expired URLs
            content = sharepoint_service.get_file_content_as_binary(
                download_url,
                file_id=file_id,
                site_id=site_id,
                drive_id=drive_id
            )
            if content is None:
                return jsonify({'error': 'Failed to download file'}), 500

            import base64
            encoded_content = base64.b64encode(content).decode('utf-8')
            return jsonify({
                'success': True,
                'content': encoded_content
            })
        else:
            # Get text content for job description files
            content = sharepoint_service.get_file_content_as_text(download_url)
            if content is None:
                return jsonify({'error': 'Failed to download file'}), 500

            return jsonify({
                'success': True,
                'content': content
            })

    except Exception as e:
        logger.error(f"Download SharePoint file error: {e}")
        return jsonify({'error': 'Failed to download file'}), 500

@app.route('/api/sharepoint/process-job-file', methods=['POST'])
@require_auth
def process_sharepoint_job_file():
    try:
        data = request.get_json()
        download_url = data.get('download_url')
        file_name = data.get('file_name')
        job_id = data.get('job_id')  # Add job_id parameter
        provider = (data.get('provider') or 'gemini').lower()

        if not download_url or not file_name or not job_id:
            return jsonify({'error': 'Download URL, file name, and job ID required'}), 400

        # Download file content as bytes for processing
        import requests
        response = requests.get(download_url)
        if response.status_code != 200:
            return jsonify({'error': 'Failed to download file'}), 500

        # Create a proper file-like object for gemini processing
        from io import BytesIO

        class FileWithName(BytesIO):
            def __init__(self, content, filename):
                super().__init__(content)
                self.filename = filename
                self.name = filename

        file_content = FileWithName(response.content, file_name)


        extraction_data = None
        job_description_text = ''

        if file_name.lower().endswith(('.pdf', '.doc', '.docx')):
            if provider == 'openai':
                if not openai_analyzer:
                    return jsonify({'error': 'OpenAI provider not configured'}), 400
                extraction_data = openai_analyzer.analyze_job_description_from_file(file_content)
            else:
                extraction_data = gemini_analyzer.analyze_job_description_from_file(file_content)
            if not extraction_data:
                return jsonify({'error': 'Failed to extract job information'}), 500
            job_description_text = extraction_data.get('job_description_text', '').strip()
        else:
            return jsonify({'error': 'Unsupported file type'}), 400

        if not job_description_text:
            return jsonify({'error': 'Failed to extract job description text'}), 500

        # Select the correct analyzer instance
        active_analyzer = openai_analyzer if provider == 'openai' else gemini_analyzer
        
        analysis_payload = build_job_analysis_payload(job_description_text, extraction_data, analyzer=active_analyzer)

        update_data = {
            'source': 'sharepoint',
            'source_filename': file_name,
            'reviewed_by': session['user']['name'],
            'review_provider': provider,
            'reviewed_at': firestore.SERVER_TIMESTAMP
        }
        update_data.update(analysis_payload)

        # Save to provider-specific slot as well
        if provider == 'openai':
            update_data['openai_analysis'] = analysis_payload
        else:
            update_data['gemini_analysis'] = analysis_payload

        # Note: We don't update the job title to preserve mapping with SharePoint and Monday.com
        # if extraction_data and extraction_data.get('job_title'):
        #     update_data['title'] = extraction_data.get('job_title')

        try:
            firestore_service.update_job(job_id, update_data)
            logger.info(f"Updated job {job_id} with extracted job information (Provider: {provider})")
            
            # Log the job update activity
            job = firestore_service.get_job(job_id)
            if job:
                activity_logger.log_activity(
                    user_email=session['user']['email'],
                    user_name=session['user']['name'],
                    action='job_created',
                    details={'job_title': job.get('title', 'Unknown job')}
                )
        except Exception as update_error:
            logger.error(f"Failed to update job {job_id}: {update_error}")
            return jsonify({'error': 'Failed to update job with extracted information'}), 500

        return jsonify({
            'success': True,
            'job_info': analysis_payload
        })

    except Exception as e:
        logger.error(f"Process SharePoint job file error: {e}")
        return jsonify({'error': 'Failed to process job file'}), 500

@app.route('/api/jobs/<job_id>/search-potential-candidates', methods=['POST'])
@require_auth
def search_potential_candidates(job_id):
    """Search for potential candidates using Vertex AI Search"""
    try:
        # Get job details
        job = firestore_service.get_job(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        # Check if job has a description
        job_description = job.get('description', '').strip()
        if not job_description:
            return jsonify({
                'success': False,
                'error': 'There is no job description'
            }), 400

        # Search for candidates using Vertex AI Search
        search_result = vertex_search_service.search_candidates(job_description)

        # Log Gemini's raw response text for observability
        response_text = search_result.get('response_text')
        if response_text:
            logger.info(
                "Gemini potential candidates response | job_id=%s | response=%s",
                job_id,
                response_text
            )
        else:
            logger.info(
                "Gemini potential candidates response | job_id=%s | response=<empty>",
                job_id
            )

        if not search_result.get('success'):
            return jsonify(search_result), 500

        # Save the potential candidates to Firestore (including Graph API metadata)
        candidates = search_result.get('candidates', [])
        potential_candidates = []
        for candidate in candidates:
            if candidate.get('sharepoint_url'):
                potential_candidates.append({
                    'filename': candidate.get('filename'),
                    'sharepoint_url': candidate.get('sharepoint_url'),
                    'download_url': candidate.get('download_url'),
                    'original_path': candidate.get('original_path'),
                    # Include Graph API metadata for URL refresh
                    'id': candidate.get('id'),
                    'site_id': candidate.get('site_id'),
                    'drive_id': candidate.get('drive_id')
                })

        logger.info(f"Saving {len(potential_candidates)} potential candidates to Firestore (with metadata)")

        # Update job with potential candidates, gemini response, and search timestamp
        try:
            update_data = {
                'potential_candidates': potential_candidates,
                'potential_candidates_last_search': firestore.SERVER_TIMESTAMP
            }

            # Add gemini response if available
            if search_result.get('response_text'):
                update_data['potential_candidates_gemini_response'] = search_result.get('response_text')

            firestore_service.update_job(job_id, update_data)
            logger.info(f"Successfully saved potential candidates to job {job_id}")

            # Verify the data was saved by retrieving the job
            updated_job = firestore_service.get_job(job_id)
            saved_candidates = updated_job.get('potential_candidates', [])
            logger.info(f"Verification: Job now has {len(saved_candidates)} potential candidates")
            if len(saved_candidates) != len(potential_candidates):
                logger.error(f"MISMATCH: Tried to save {len(potential_candidates)} but only {len(saved_candidates)} were saved!")
        except Exception as e:
            logger.error(f"Error saving potential candidates: {e}")
            import traceback
            logger.error(traceback.format_exc())

        # Log the search activity
        activity_logger.log_activity(
            user_email=session['user']['email'],
            user_name=session['user']['name'],
            action='potential_candidates_search',
            details={
                'job_title': job.get('title', 'Unknown job'),
                'candidates_found': len(search_result.get('candidates', []))
            }
        )

        return jsonify(search_result)

    except Exception as e:
        logger.error(f"Search potential candidates error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to search for potential candidates'
        }), 500

@app.route('/api/jobs/<job_id>/search-by-skill', methods=['POST'])
@require_auth
def search_by_skill(job_id):
    """Search for candidates by a specific skill or requirement"""
    try:
        data = request.get_json()
        skill = data.get('skill', '').strip()

        if not skill:
            return jsonify({'error': 'Skill or requirement is required'}), 400

        # Get job details (for logging)
        job = firestore_service.get_job(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        # Search for candidates with this skill
        search_result = vertex_search_service.search_by_skill(skill)

        if not search_result.get('success'):
            return jsonify(search_result), 500

        # Log Gemini's response text for auditing and debugging
        response_text = search_result.get('response_text')
        if response_text:
            logger.info(
                "Gemini skill search response | job_id=%s | skill=%s | response=%s",
                job_id,
                skill,
                response_text
            )
        else:
            logger.info(
                "Gemini skill search response | job_id=%s | skill=%s | response=<empty>",
                job_id,
                skill
            )

        # Log the skill search activity
        activity_logger.log_activity(
            user_email=session['user']['email'],
            user_name=session['user']['name'],
            action='skill_search',
            details={
                'job_title': job.get('title', 'Unknown job'),
                'skill_searched': skill
            }
        )

        return jsonify(search_result)

    except Exception as e:
        logger.error(f"Search by skill error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to search by skill'
        }), 500

# Job chat routes
@app.route('/api/jobs/<job_id>/chat', methods=['GET'])
@require_auth
def get_job_chat(job_id):
    try:
        chat = firestore_service.get_job_chat(job_id)
        if not chat:
            return jsonify({'messages': []})
        messages = chat.get('messages', [])
        if not isinstance(messages, list):
            messages = []
        return jsonify({'messages': messages})
    except Exception as e:
        logger.error(f"Get job chat error: {e}")
        return jsonify({'error': 'Failed to retrieve chat history'}), 500


@app.route('/api/jobs/<job_id>/chat', methods=['POST'])
@require_auth
def stream_job_chat(job_id):
    data = request.get_json(silent=True) or {}
    incoming_messages = normalize_chat_messages(data.get('messages', []))
    if not incoming_messages:
        return jsonify({'error': 'No messages provided'}), 400

    chat_state = firestore_service.get_job_chat(job_id) or {}
    context_seeded = bool(chat_state.get('context_seeded'))
    system_prompt = chat_state.get('system_prompt') if context_seeded else None

    should_save_system_prompt = False
    if not context_seeded or not system_prompt:
        job = firestore_service.get_job(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        candidates = firestore_service.get_candidates_by_job(job_id)
        system_prompt = build_job_chat_context(job, candidates)
        should_save_system_prompt = True

    contents = []
    for message in incoming_messages:
        role = 'model' if message['role'] == 'assistant' else 'user'
        contents.append({
            'role': role,
            'parts': [{'text': message['content']}]
        })

    tool = vertex_search_service.build_grounding_tool()
    model = os.getenv("VERTEX_MODEL", "gemini-1.5-flash")

    def generate():
        assistant_text = ""
        try:
            stream = vertex_search_service.client.models.generate_content_stream(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    tools=[tool],
                    system_instruction=system_prompt
                )
            )

            for chunk in stream:
                chunk_text = getattr(chunk, 'text', None)
                if not chunk_text:
                    continue
                if chunk_text.startswith(assistant_text):
                    delta = chunk_text[len(assistant_text):]
                    assistant_text = chunk_text
                else:
                    delta = chunk_text
                    assistant_text += delta
                if delta:
                    yield f"data: 0:{json.dumps(delta)}\n\n"
        except Exception as e:
            yield f"data: e:{json.dumps({'error': str(e)})}\n\n"
        finally:
            saved_messages = list(incoming_messages)
            if assistant_text:
                saved_messages.append({
                    'id': uuid.uuid4().hex,
                    'role': 'assistant',
                    'content': assistant_text
                })

            firestore_service.save_job_chat(
                job_id=job_id,
                messages=saved_messages,
                system_prompt=system_prompt if should_save_system_prompt else None,
                context_seeded=True
            )

            yield "data: [DONE]\n\n"

    headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    }
    return Response(stream_with_context(generate()), headers=headers)

# Resume upload and analysis routes
@app.route('/api/jobs/<job_id>/upload-resume', methods=['POST'])
@require_auth
def upload_resume(job_id):
    try:
        if 'resume' not in request.files:
            return jsonify({'error': 'No resume file provided'}), 400

        file = request.files['resume']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        provider = (request.form.get('provider') or 'gemini').lower()

        # Get job details
        job = firestore_service.get_job(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        # Validate file
        is_valid, error_msg = gemini_analyzer.validate_file(file)
        if not is_valid:
            return jsonify({'error': error_msg}), 400

        # Analyze resume directly from file - single Gemini call
        if provider == 'openai':
            if not openai_analyzer:
                return jsonify({'error': 'OpenAI provider not configured'}), 400
            analysis_result = openai_analyzer.analyze_resume(
                file,
                job['description'],
                job.get('skill_weights', {})
            )
        else:
            analysis_result = gemini_analyzer.analyze_resume(
                file,
                job['description'],
                job.get('skill_weights', {})
            )

        # Save candidate and analysis (including extracted text for resume improvement)
        candidate_data = {
            'name': analysis_result.get('candidate_name', file.filename.split('.')[0]),
            'email': analysis_result.get('candidate_email', ''),
            'phone': analysis_result.get('candidate_phone', ''),
            'resume_filename': file.filename,
            'resume_text': analysis_result.get('extracted_text', ''),
            'job_id': job_id,
            'analysis': analysis_result,
            'uploaded_by': session['user']['email'],
            'created_at': firestore.SERVER_TIMESTAMP
        }

        candidate_id = firestore_service.save_candidate(candidate_data)

        # Log the candidate analysis activity
        activity_logger.log_activity(
            user_email=session['user']['email'],
            user_name=session['user']['name'],
            action='candidate_analyzed',
            details={
                'candidate_name': candidate_data.get('name', 'Unknown'),
                'job_title': job.get('title', 'Unknown job')
            }
        )

        return jsonify({
            'success': True,
            'candidate_id': candidate_id,
            'analysis': analysis_result
        })

    except Exception as e:
        logger.error(f"Upload resume error: {e}")
        return jsonify({'error': 'Failed to process resume'}), 500

# Candidate ranking routes
@app.route('/api/jobs/<job_id>/candidates', methods=['GET'])
@require_auth
def get_job_candidates(job_id):
    try:
        candidates = firestore_service.get_candidates_by_job(job_id)
        return jsonify({'candidates': candidates})
    except Exception as e:
        logger.error(f"Get candidates error: {e}")
        return jsonify({'error': 'Failed to retrieve candidates'}), 500

@app.route('/api/candidates', methods=['GET'])
@require_auth
def get_all_candidates():
    """Get all candidates across all jobs"""
    try:
        candidates = firestore_service.get_all_candidates()
        return jsonify({'candidates': candidates})
    except Exception as e:
        logger.error(f"Get all candidates error: {e}")
        return jsonify({'error': 'Failed to retrieve candidates'}), 500

@app.route('/api/candidates/<candidate_id>', methods=['GET'])
@require_auth
def get_candidate_details(candidate_id):
    try:
        candidate = firestore_service.get_candidate(candidate_id)
        if candidate:
            # Flatten analysis data to root level for frontend compatibility
            if 'analysis' in candidate:
                analysis = candidate.pop('analysis')
                # Move analysis fields to root level
                for key, value in analysis.items():
                    candidate[key] = value
            return jsonify({'candidate': candidate})
        else:
            return jsonify({'error': 'Candidate not found'}), 404
    except Exception as e:
        logger.error(f"Get candidate error: {e}")
        return jsonify({'error': 'Failed to retrieve candidate'}), 500

# Resume improvement route
@app.route('/api/candidates/<candidate_id>/improve-resume', methods=['POST'])
@require_auth
def improve_resume(candidate_id):
    try:
        candidate = firestore_service.get_candidate(candidate_id)
        if not candidate:
            return jsonify({'error': 'Candidate not found'}), 404

        job = firestore_service.get_job(candidate['job_id'])
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        # Flatten analysis data to root level if needed
        if 'analysis' in candidate:
            analysis = candidate.pop('analysis')
            for key, value in analysis.items():
                candidate[key] = value

        # Company branding information
        company_info = {
            'logo_path': LOGO_URL_PATH,
            'logo_file_path': LOGO_FILE_PATH,
            'footer': 'Arisma Group LLC dba Cendien | 1846 E Rosemead Pkwy Ste. 200 Carrollton, TX 75007 | Phone: (214) 245-4580 | http://www.cendien.com'
        }

        # Generate improved resume PDF using new service
        pdf_bytes, improved_data = resume_service.improve_and_generate_pdf_with_data(
            candidate_data=candidate,
            job_data=job,
            company_info=company_info
        )

        firestore_service.save_improved_resume(
            candidate_id=candidate_id,
            job_id=candidate.get('job_id', ''),
            improved_data=improved_data,
            metadata={
                'candidate_name': candidate.get('name', 'Unknown candidate'),
                'job_title': job.get('title', 'Unknown job'),
                'template_id': 'professional',
                'template_name': 'resume_template_professional.html',
                'format': 'pdf',
                'source': 'improve_resume'
            }
        )

        # Log the resume improvement activity
        activity_logger.log_activity(
            user_email=session['user']['email'],
            user_name=session['user']['name'],
            action='resume_improved',
            details={
                'candidate_name': candidate.get('name', 'Unknown candidate'),
                'template_used': 'professional',
                'job_title': job.get('title', 'Unknown job'),
                'format': 'pdf'
            }
        )

        # Return PDF as downloadable file
        from flask import make_response
        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename="improved_resume_{candidate.get("name", "candidate").replace(" ", "_")}.pdf"'

        return response

    except Exception as e:
        logger.error(f"Improve resume error: {e}")
        return jsonify({'error': 'Failed to improve resume'}), 500

# Resume preview route (optional - for HTML preview)
@app.route('/api/candidates/<candidate_id>/resume-preview', methods=['POST'])
@require_auth
def resume_preview(candidate_id):
    try:
        candidate = firestore_service.get_candidate(candidate_id)
        if not candidate:
            return jsonify({'error': 'Candidate not found'}), 404

        job = firestore_service.get_job(candidate['job_id'])
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        # Flatten analysis data to root level if needed
        if 'analysis' in candidate:
            analysis = candidate.pop('analysis')
            for key, value in analysis.items():
                candidate[key] = value

        # Company branding information
        company_info = {
            'logo_path': LOGO_URL_PATH,
            'logo_file_path': LOGO_FILE_PATH,
            'footer': 'Arisma Group LLC dba Cendien | 1846 E Rosemead Pkwy Ste. 200 Carrollton, TX 75007 | Phone: (214) 245-4580 | http://www.cendien.com'
        }

        # Generate HTML preview
        html_preview = resume_service.generate_html_preview(
            candidate_data=candidate,
            job_data=job,
            company_info=company_info
        )

        # Log the resume preview activity
        activity_logger.log_activity(
            user_email=session['user']['email'],
            user_name=session['user']['name'],
            action='resume_previewed',
            details={
                'candidate_name': candidate.get('name', 'Unknown candidate'),
                'job_title': job.get('title', 'Unknown job')
            }
        )

        return html_preview, 200, {'Content-Type': 'text/html'}

    except Exception as e:
        logger.error(f"Resume preview error: {e}")
        return jsonify({'error': 'Failed to generate resume preview'}), 500

# Delete candidate route
@app.route('/api/candidates/<candidate_id>', methods=['DELETE'])
@require_auth
def delete_candidate(candidate_id):
    try:
        candidate = firestore_service.get_candidate(candidate_id)
        if not candidate:
            return jsonify({'error': 'Candidate not found'}), 404

        firestore_service.delete_candidate(candidate_id)

        return jsonify({
            'success': True,
            'message': 'Candidate deleted successfully'
        })

    except Exception as e:
        logger.error(f"Delete candidate error: {e}")
        return jsonify({'error': 'Failed to delete candidate'}), 500


# Web verification route - verifies candidate claims using web search
@app.route('/api/candidates/<candidate_id>/verify', methods=['POST'])
@require_auth
def verify_candidate(candidate_id):
    """
    Verify candidate claims using web search.

    This endpoint performs a web search to verify claims made in the candidate's resume,
    such as employment history, education, and certifications.

    Query params:
        provider: 'gemini' or 'openai' (default: 'gemini')
    """
    try:
        candidate = firestore_service.get_candidate(candidate_id)
        if not candidate:
            return jsonify({'error': 'Candidate not found'}), 404

        # Get provider from request
        data = request.get_json() or {}
        provider = data.get('provider', 'gemini').lower()

        # Prepare analysis data for verification
        # The analysis may be nested or at root level
        if 'analysis' in candidate:
            analysis = candidate['analysis']
        else:
            # Analysis fields are at root level
            analysis = {
                'candidate_name': candidate.get('candidate_name') or candidate.get('name', ''),
                'candidate_email': candidate.get('candidate_email') or candidate.get('email', ''),
                'experience_match': candidate.get('experience_match', {}),
                'education_match': candidate.get('education_match', {}),
                'strengths': candidate.get('strengths', []),
                'certifications': candidate.get('education_match', {}).get('certifications', [])
            }

        # Initialize verification service with chosen provider
        try:
            verification_service = WebVerificationService(provider=provider)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

        # Perform verification
        verification_result = verification_service.verify_candidate(analysis)

        # Optionally store verification result with candidate
        # Update candidate with verification data
        firestore_service.update_candidate(candidate_id, {
            'web_verification': verification_result,
            'web_verification_provider': provider
        })

        # Log the verification activity
        activity_logger.log_activity(
            user_email=session['user']['email'],
            user_name=session['user']['name'],
            action='candidate_verified',
            details={
                'candidate_name': candidate.get('name', 'Unknown'),
                'verification_status': verification_result.get('overall_verification_status', 'unknown'),
                'provider': provider
            }
        )

        return jsonify({
            'success': True,
            'verification': verification_result
        })

    except Exception as e:
        logger.error(f"Web verification error: {e}")
        return jsonify({'error': f'Failed to verify candidate: {str(e)}'}), 500


@app.route('/api/resume/templates', methods=['GET'])
@require_auth
def list_resume_templates():
    """List all available resume templates"""
    try:
        templates = resume_service.resume_generator.template_registry.list_templates()
        return jsonify({'templates': templates})
    except Exception as e:
        logger.error(f"List templates error: {e}")
        return jsonify({'error': 'Failed to list templates'}), 500

@app.route('/api/candidates/<candidate_id>/generate-resume', methods=['POST'])
@require_auth
def generate_and_save_resume(candidate_id):
    """Generate resume and optionally save to SharePoint"""
    try:
        data = request.get_json()
        template_id = data.get('template_id', 'professional')
        save_to_sharepoint = data.get('save_to_sharepoint', False)
        output_format = data.get('format', 'pdf')

        candidate = firestore_service.get_candidate(candidate_id)
        if not candidate:
            return jsonify({'error': 'Candidate not found'}), 404

        job = firestore_service.get_job(candidate['job_id'])
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        # Flatten analysis data if needed
        if 'analysis' in candidate:
            analysis = candidate.pop('analysis')
            for key, value in analysis.items():
                candidate[key] = value

        # Company branding information
        company_info = {
            'logo_path': LOGO_URL_PATH,
            'logo_file_path': LOGO_FILE_PATH,
            'footer': 'Arisma Group LLC dba Cendien | 1846 E Rosemead Pkwy Ste. 200 Carrollton, TX 75007 | Phone: (214) 245-4580 | http://www.cendien.com'
        }

        # Get template metadata
        template = resume_service.resume_generator.template_registry.get_template(template_id)
        if not template:
            return jsonify({'error': f'Template not found: {template_id}'}), 404

        # Generate improved resume in requested format
        if output_format == 'docx':
            file_bytes, improved_data = resume_service.improve_and_generate_docx_with_data(
                candidate_data=candidate,
                job_data=job,
                company_info=company_info,
                template_name=template.filename
            )
            content_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            file_extension = 'docx'
        else:
            file_bytes, improved_data = resume_service.improve_and_generate_pdf_with_data(
                candidate_data=candidate,
                job_data=job,
                company_info=company_info,
                template_name=template.filename
            )
            content_type = 'application/pdf'
            file_extension = 'pdf'

        firestore_service.save_improved_resume(
            candidate_id=candidate_id,
            job_id=candidate.get('job_id', ''),
            improved_data=improved_data,
            metadata={
                'candidate_name': candidate.get('name', 'Unknown candidate'),
                'job_title': job.get('title', 'Unknown job'),
                'template_id': template_id,
                'template_name': template.filename,
                'format': output_format,
                'source': 'generate_resume',
                'save_to_sharepoint': save_to_sharepoint
            }
        )

        # Log the resume generation activity
        activity_logger.log_activity(
            user_email=session['user']['email'],
            user_name=session['user']['name'],
            action='resume_improved',
            details={
                'candidate_name': candidate.get('name', 'Unknown candidate'),
                'template_used': template.name,
                'job_title': job.get('title', 'Unknown job'),
                'format': output_format,
                'save_to_sharepoint': save_to_sharepoint
            }
        )

        # Save to SharePoint if requested
        sharepoint_url = None
        sharepoint_link = job.get('monday_metadata', {}).get('sharepoint_link')
        logger.info(f"SharePoint save requested: {save_to_sharepoint}, Job has sharepoint_link: {bool(sharepoint_link)}")

        if save_to_sharepoint and sharepoint_link:
            logger.info(f"Attempting to save resume to SharePoint for job: {job.get('title')}")
            # Get template display name (e.g., "professional" -> "cendien", "modern" -> "modern", "minimal" -> "minimal")
            template_display_name = "cendien" if template_id == "professional" else template_id
            filename = f"improved_resume_{template_display_name}_{candidate.get('name', 'candidate').replace(' ', '_')}.{file_extension}"
            upload_result = sharepoint_service.upload_file_to_folder(
                sharepoint_url=sharepoint_link,
                file_content=file_bytes,
                filename=filename,
                job_title=job.get('title'),
                subfolder='Resume Ranker Improvement'
            )

            if upload_result:
                sharepoint_url = upload_result.get('web_url')
                logger.info(f"Resume saved to SharePoint: {sharepoint_url}")

                # Log successful SharePoint upload
                activity_logger.log_activity(
                    user_email=session['user']['email'],
                    user_name=session['user']['name'],
                    action='resume_saved_to_sharepoint',
                    details={
                        'candidate_name': candidate.get('name', 'Unknown candidate'),
                        'template_used': template.name,
                        'job_title': job.get('title', 'Unknown job'),
                        'sharepoint_url': sharepoint_url,
                        'format': output_format
                    }
                )
            else:
                logger.warning("Failed to save resume to SharePoint")
        elif save_to_sharepoint and not sharepoint_link:
            logger.warning(f"SharePoint save requested but job has no sharepoint_link in monday_metadata")
        else:
            logger.info("SharePoint save not requested")

        # Return file as downloadable
        from flask import make_response
        response = make_response(file_bytes)
        response.headers['Content-Type'] = content_type
        # Use same template display name for download filename
        template_display_name = "cendien" if template_id == "professional" else template_id
        response.headers['Content-Disposition'] = f'attachment; filename="improved_resume_{template_display_name}_{candidate.get("name", "candidate").replace(" ", "_")}.{file_extension}"'

        if sharepoint_url:
            response.headers['X-SharePoint-URL'] = sharepoint_url

        return response

    except Exception as e:
        logger.error(f"Generate and save resume error: {e}")
        return jsonify({'error': 'Failed to generate resume'}), 500

@app.route('/api/sharepoint/clear-cache', methods=['POST'])
@require_auth
def clear_sharepoint_cache():
    """Clear the SharePoint cache manually"""
    try:
        sharepoint_service.clear_cache()
        return jsonify({
            'success': True,
            'message': 'SharePoint cache cleared successfully'
        })
    except Exception as e:
        logger.error(f"Clear cache error: {e}")
        return jsonify({'error': 'Failed to clear cache'}), 500

@app.route('/api/activities', methods=['GET'])
@require_auth
def get_activities():
    """Get recent activity logs"""
    try:
        limit = int(request.args.get('limit', 50))
        activities = activity_logger.get_recent_activities(limit=limit)
        return jsonify({'activities': activities})
    except Exception as e:
        logger.error(f"Get activities error: {e}")
        return jsonify({'error': 'Failed to retrieve activities'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'TalentMax API is running'})

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404

    if os.path.exists(os.path.join(FRONTEND_DIST_DIR, path)) and path:
        return send_from_directory(FRONTEND_DIST_DIR, path)

    index_path = os.path.join(FRONTEND_DIST_DIR, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(FRONTEND_DIST_DIR, 'index.html')

    return jsonify({'error': 'Frontend build not found'}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(
        debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true',
        host='0.0.0.0',
        port=port
    )
