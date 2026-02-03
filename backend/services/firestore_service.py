from firebase_admin import firestore as firebase_firestore
from google.cloud import firestore
import logging
import threading
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

class FirestoreService:
    # Collection path constant
    COLLECTION_ROOT = 'resume-evaluator'

    def __init__(self, cache_ttl_seconds: int = 30):
        self.db = firebase_firestore.client()
        self.cache_ttl_seconds = max(int(cache_ttl_seconds or 0), 0)
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_lock = threading.Lock()

    def _cache_get(self, key: str):
        if self.cache_ttl_seconds <= 0:
            return None
        with self._cache_lock:
            entry = self._cache.get(key)
            if not entry:
                return None
            if datetime.utcnow() > entry['expires_at']:
                self._cache.pop(key, None)
                return None
            return entry['data']

    def _cache_set(self, key: str, data: Any):
        if self.cache_ttl_seconds <= 0:
            return
        with self._cache_lock:
            self._cache[key] = {
                'data': data,
                'expires_at': datetime.utcnow() + timedelta(seconds=self.cache_ttl_seconds)
            }

    def _cache_invalidate(self, prefix: str):
        if self.cache_ttl_seconds <= 0:
            return
        with self._cache_lock:
            keys = [k for k in self._cache.keys() if k.startswith(prefix)]
            for k in keys:
                self._cache.pop(k, None)

    # Job-related operations
    def create_job(self, job_data):
        """Create a new job posting"""
        try:
            doc_ref = self.db.collection(self.COLLECTION_ROOT).document('jobs').collection('jobs').document()
            job_data['id'] = doc_ref.id
            doc_ref.set(job_data)
            self._cache_invalidate('jobs:')
            self._cache_set(f'job:{doc_ref.id}', job_data)
            logger.info(f"Created job with ID: {doc_ref.id}")
            return doc_ref.id
        except Exception as e:
            logger.error(f"Error creating job: {e}")
            raise

    def get_job(self, job_id):
        """Get a specific job by ID"""
        try:
            cached = self._cache_get(f'job:{job_id}')
            if cached is not None:
                return cached
            doc_ref = self.db.collection(self.COLLECTION_ROOT).document('jobs').collection('jobs').document(job_id)
            doc = doc_ref.get()
            if doc.exists:
                job_data = doc.to_dict()
                job_data['id'] = doc.id
                self._cache_set(f'job:{job_id}', job_data)
                return job_data
            return None
        except Exception as e:
            logger.error(f"Error getting job {job_id}: {e}")
            raise

    def get_all_jobs(self):
        """Get all job postings"""
        try:
            cached = self._cache_get('jobs:all')
            if cached is not None:
                return cached
            # Get all jobs without ordering first (to avoid filtering out jobs without created_at)
            docs = self.db.collection(self.COLLECTION_ROOT).document('jobs').collection('jobs').stream()
            jobs = []
            for doc in docs:
                job_data = doc.to_dict()
                job_data['id'] = doc.id

                # Convert Firestore timestamp to string for JSON serialization
                if 'created_at' in job_data and job_data['created_at']:
                    job_data['created_at'] = job_data['created_at'].isoformat() if hasattr(job_data['created_at'], 'isoformat') else str(job_data['created_at'])
                else:
                    # Jobs without created_at will have None, which will be handled by sort_key
                    job_data['created_at'] = None

                jobs.append(job_data)

            # Sort jobs: Monday.com jobs by monday_id (ascending), then others by created_at (descending)
            def sort_key(job):
                # If it's a Monday.com job, sort by monday_id numerically
                if job.get('monday_id'):
                    try:
                        # Use negative monday_id to get ascending order (lower IDs first)
                        return (0, -int(job['monday_id']))
                    except (ValueError, TypeError):
                        # If monday_id is not a number, treat as string
                        return (0, job['monday_id'])
                else:
                    # Non-Monday jobs sorted by creation date (newer first)
                    # None timestamps go to the end
                    created_at = job.get('created_at')
                    return (1, created_at if created_at else '')

            jobs.sort(key=sort_key, reverse=False)

            logger.info(f"Retrieved {len(jobs)} jobs")
            self._cache_set('jobs:all', jobs)
            return jobs
        except Exception as e:
            logger.error(f"Error getting all jobs: {e}")
            raise

    def update_job(self, job_id, update_data):
        """Update a job posting"""
        try:
            doc_ref = self.db.collection(self.COLLECTION_ROOT).document('jobs').collection('jobs').document(job_id)
            update_data['updated_at'] = firestore.SERVER_TIMESTAMP
            if 'monday_metadata' in update_data:
                doc = doc_ref.get()
                if doc.exists:
                    for key, value in update_data['monday_metadata'].items():
                        doc_ref.update({f'monday_metadata.{key}': value})
                update_data.pop('monday_metadata')
            doc_ref.update(update_data)
            self._cache_invalidate('jobs:')
            self._cache_invalidate(f'job:{job_id}')
            logger.info(f"Updated job {job_id}")
            return True
        except Exception as e:
            logger.error(f"Error updating job {job_id}: {e}")
            raise

    def delete_job(self, job_id):
        """Delete a job posting and all associated candidates"""
        try:
            # First delete all candidates associated with this job
            candidates = self.get_candidates_by_job(job_id)
            for candidate in candidates:
                self.delete_candidate(candidate['candidate_id'])

            # Delete the job document
            doc_ref = self.db.collection(self.COLLECTION_ROOT).document('jobs').collection('jobs').document(job_id)
            doc_ref.delete()

            self._cache_invalidate('jobs:')
            self._cache_invalidate(f'job:{job_id}')
            logger.info(f"Deleted job {job_id} and {len(candidates)} associated candidates")
            return True
        except Exception as e:
            logger.error(f"Error deleting job {job_id}: {e}")
            return False

    # Candidate-related operations
    def save_candidate(self, candidate_data):
        """Save candidate and analysis data"""
        try:
            doc_ref = self.db.collection(self.COLLECTION_ROOT).document('candidates').collection('candidates').document()
            candidate_data['id'] = doc_ref.id
            doc_ref.set(candidate_data)

            # Also save to job's candidates subcollection for easy querying
            job_id = candidate_data['job_id']
            job_candidate_ref = self.db.collection(self.COLLECTION_ROOT).document('jobs').collection('jobs').document(job_id).collection('candidates').document(doc_ref.id)

            # Create summary for job subcollection
            summary_data = {
                'candidate_id': doc_ref.id,
                'name': candidate_data.get('name', 'Unknown'),
                'email': candidate_data.get('email', ''),
                'overall_score': candidate_data.get('analysis', {}).get('overall_score', 0),
                'summary': candidate_data.get('analysis', {}).get('summary', ''),
                'created_at': candidate_data.get('created_at'),
                'uploaded_by': candidate_data.get('uploaded_by', '')
            }

            job_candidate_ref.set(summary_data)

            self._cache_invalidate('candidates:')
            self._cache_invalidate('candidate:')
            logger.info(f"Saved candidate with ID: {doc_ref.id}")
            return doc_ref.id

        except Exception as e:
            logger.error(f"Error saving candidate: {e}")
            raise

    def get_candidate(self, candidate_id):
        """Get a specific candidate by ID"""
        try:
            cached = self._cache_get(f'candidate:{candidate_id}')
            if cached is not None:
                return cached
            doc_ref = self.db.collection(self.COLLECTION_ROOT).document('candidates').collection('candidates').document(candidate_id)
            doc = doc_ref.get()
            if doc.exists:
                candidate_data = doc.to_dict()
                candidate_data['id'] = doc.id

                # Convert timestamps for JSON serialization
                if 'created_at' in candidate_data and candidate_data['created_at']:
                    candidate_data['created_at'] = candidate_data['created_at'].isoformat() if hasattr(candidate_data['created_at'], 'isoformat') else str(candidate_data['created_at'])

                self._cache_set(f'candidate:{candidate_id}', candidate_data)
                return candidate_data
            return None
        except Exception as e:
            logger.error(f"Error getting candidate {candidate_id}: {e}")
            raise

    def update_candidate(self, candidate_id, update_data):
        """Update a candidate with additional data"""
        try:
            doc_ref = self.db.collection(self.COLLECTION_ROOT).document('candidates').collection('candidates').document(candidate_id)
            doc = doc_ref.get()
            if not doc.exists:
                logger.error(f"Candidate {candidate_id} not found for update")
                return False

            doc_ref.update(update_data)
            self._cache_invalidate('candidates:')
            self._cache_invalidate(f'candidate:{candidate_id}')
            logger.info(f"Updated candidate {candidate_id} with fields: {list(update_data.keys())}")
            return True
        except Exception as e:
            logger.error(f"Error updating candidate {candidate_id}: {e}")
            raise

    # User settings
    def get_user_settings(self, user_email: str) -> Optional[Dict[str, Any]]:
        """Get user settings by email."""
        try:
            cache_key = f'user:{user_email}'
            cached = self._cache_get(cache_key)
            if cached is not None:
                return cached

            doc_ref = (
                self.db.collection(self.COLLECTION_ROOT)
                .document('users')
                .collection('users')
                .document(user_email)
            )
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict() or {}
                self._cache_set(cache_key, data)
                return data
            return None
        except Exception as e:
            logger.error(f"Error getting user settings for {user_email}: {e}")
            raise

    def set_user_settings(self, user_email: str, update_data: Dict[str, Any]) -> None:
        """Set user settings by email (merge)."""
        try:
            doc_ref = (
                self.db.collection(self.COLLECTION_ROOT)
                .document('users')
                .collection('users')
                .document(user_email)
            )
            update_data['updated_at'] = firestore.SERVER_TIMESTAMP
            doc_ref.set(update_data, merge=True)
            self._cache_invalidate('user:')
            self._cache_invalidate(f'user:{user_email}')
        except Exception as e:
            logger.error(f"Error setting user settings for {user_email}: {e}")
            raise

    def save_improved_resume(self, candidate_id: str, job_id: str, improved_data: Dict[str, Any], metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Save latest improved resume JSON for a candidate."""
        try:
            doc_ref = (self.db.collection(self.COLLECTION_ROOT)
                       .document('improved_resumes')
                       .collection('improved_resumes')
                       .document(candidate_id))

            payload = {
                'candidate_id': candidate_id,
                'job_id': job_id,
                'resume_json': self._serialize_for_firestore(improved_data),
                'updated_at': firestore.SERVER_TIMESTAMP
            }

            if metadata:
                payload.update(metadata)

            doc_ref.set(payload)
            logger.info(f"Saved improved resume for candidate {candidate_id}")
            return True
        except Exception as e:
            logger.error(f"Error saving improved resume for candidate {candidate_id}: {e}")
            return False

    def get_job_chat(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get chat history for a job."""
        try:
            doc_ref = (self.db.collection(self.COLLECTION_ROOT)
                       .document('job_chats')
                       .collection('job_chats')
                       .document(job_id))
            doc = doc_ref.get()
            if not doc.exists:
                return None
            chat_data = doc.to_dict()
            chat_data['id'] = doc.id
            return chat_data
        except Exception as e:
            logger.error(f"Error getting job chat for {job_id}: {e}")
            return None

    def save_job_chat(self, job_id: str, messages: List[Dict[str, Any]], system_prompt: Optional[str] = None, context_seeded: Optional[bool] = None) -> bool:
        """Save latest chat messages for a job."""
        try:
            doc_ref = (self.db.collection(self.COLLECTION_ROOT)
                       .document('job_chats')
                       .collection('job_chats')
                       .document(job_id))

            payload: Dict[str, Any] = {
                'job_id': job_id,
                'messages': self._serialize_for_firestore(messages),
                'updated_at': firestore.SERVER_TIMESTAMP
            }

            if system_prompt is not None:
                payload['system_prompt'] = system_prompt
            if context_seeded is not None:
                payload['context_seeded'] = context_seeded

            doc_ref.set(payload, merge=True)
            logger.info(f"Saved job chat for job {job_id}")
            return True
        except Exception as e:
            logger.error(f"Error saving job chat for {job_id}: {e}")
            return False

    def _serialize_for_firestore(self, value: Any) -> Any:
        """Recursively convert dates to ISO strings for Firestore."""
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, date):
            return value.isoformat()
        if isinstance(value, dict):
            return {key: self._serialize_for_firestore(val) for key, val in value.items()}
        if isinstance(value, list):
            return [self._serialize_for_firestore(item) for item in value]
        return value

    def get_candidates_by_job(self, job_id):
        """Get all candidates for a specific job, ranked by score"""
        try:
            # First get candidate IDs from job's candidates subcollection
            summary_docs = (self.db.collection(self.COLLECTION_ROOT)
                           .document('jobs')
                           .collection('jobs')
                           .document(job_id)
                           .collection('candidates')
                           .order_by('overall_score', direction=firestore.Query.DESCENDING)
                           .stream())

            candidates = []
            for summary_doc in summary_docs:
                summary_data = summary_doc.to_dict()
                candidate_id = summary_data.get('candidate_id', summary_doc.id)

                # Get full candidate data from main candidates collection
                full_candidate = self.get_candidate(candidate_id)
                if full_candidate:
                    # Flatten analysis data to root level for frontend compatibility
                    if 'analysis' in full_candidate:
                        analysis = full_candidate.pop('analysis')
                        # Move analysis fields to root level
                        for key, value in analysis.items():
                            full_candidate[key] = value

                    candidates.append(full_candidate)

            logger.info(f"Retrieved {len(candidates)} candidates for job {job_id}")
            return candidates

        except Exception as e:
            logger.error(f"Error getting candidates for job {job_id}: {e}")
            raise

    def get_all_candidates(self):
        """Get all candidates across all jobs, with job information included"""
        try:
            cached = self._cache_get('candidates:all')
            if cached is not None:
                return cached
            # Get all candidates from the main candidates collection
            docs = (self.db.collection(self.COLLECTION_ROOT)
                   .document('candidates')
                   .collection('candidates')
                   .stream())

            candidates = []
            jobs_cache = {}  # Cache job data to avoid repeated fetches

            for doc in docs:
                candidate_data = doc.to_dict()
                candidate_data['id'] = doc.id

                # Convert timestamps for JSON serialization
                if 'created_at' in candidate_data and candidate_data['created_at']:
                    candidate_data['created_at'] = (
                        candidate_data['created_at'].isoformat()
                        if hasattr(candidate_data['created_at'], 'isoformat')
                        else str(candidate_data['created_at'])
                    )

                # Flatten analysis data to root level for frontend compatibility
                if 'analysis' in candidate_data:
                    analysis = candidate_data.pop('analysis')
                    for key, value in analysis.items():
                        candidate_data[key] = value

                # Get job information (cached)
                job_id = candidate_data.get('job_id')
                if job_id:
                    if job_id not in jobs_cache:
                        job = self.get_job(job_id)
                        jobs_cache[job_id] = job
                    job = jobs_cache.get(job_id)
                    if job:
                        candidate_data['job_title'] = job.get('title', 'Unknown Job')
                        candidate_data['job_status'] = job.get('status', '')
                        candidate_data['job_monday_metadata'] = job.get('monday_metadata')

                candidates.append(candidate_data)

            # Sort by overall_score descending
            candidates.sort(key=lambda c: c.get('overall_score', 0), reverse=True)

            logger.info(f"Retrieved {len(candidates)} candidates across all jobs")
            self._cache_set('candidates:all', candidates)
            return candidates

        except Exception as e:
            logger.error(f"Error getting all candidates: {e}")
            raise

    def delete_candidate(self, candidate_id):
        """Delete a candidate"""
        try:
            # Get candidate data first to find job_id
            candidate = self.get_candidate(candidate_id)
            if not candidate:
                return False

            job_id = candidate['job_id']

            # Delete from main candidates collection
            self.db.collection(self.COLLECTION_ROOT).document('candidates').collection('candidates').document(candidate_id).delete()

            # Delete from job's candidates subcollection
            self.db.collection(self.COLLECTION_ROOT).document('jobs').collection('jobs').document(job_id).collection('candidates').document(candidate_id).delete()

            self._cache_invalidate('candidates:')
            self._cache_invalidate(f'candidate:{candidate_id}')
            logger.info(f"Deleted candidate {candidate_id}")
            return True

        except Exception as e:
            logger.error(f"Error deleting candidate {candidate_id}: {e}")
            raise

    # Analytics and statistics
    def get_job_statistics(self, job_id):
        """Get statistics for a specific job"""
        try:
            candidates = self.get_candidates_by_job(job_id)

            if not candidates:
                return {
                    'total_candidates': 0,
                    'average_score': 0,
                    'top_score': 0,
                    'score_distribution': {}
                }

            scores = [c.get('overall_score', 0) for c in candidates]

            statistics = {
                'total_candidates': len(candidates),
                'average_score': sum(scores) / len(scores) if scores else 0,
                'top_score': max(scores) if scores else 0,
                'score_distribution': {
                    'excellent': len([s for s in scores if s >= 90]),
                    'good': len([s for s in scores if 80 <= s < 90]),
                    'fair': len([s for s in scores if 70 <= s < 80]),
                    'poor': len([s for s in scores if s < 70])
                }
            }

            return statistics

        except Exception as e:
            logger.error(f"Error getting job statistics for {job_id}: {e}")
            raise

    # Monday.com integration methods
    def get_jobs_by_monday_id(self, monday_id):
        """Get jobs by Monday.com ID"""
        try:
            docs = (self.db.collection(self.COLLECTION_ROOT)
                   .document('jobs')
                   .collection('jobs')
                   .where('monday_id', '==', monday_id)
                   .stream())

            jobs = []
            for doc in docs:
                job_data = doc.to_dict()
                job_data['id'] = doc.id
                jobs.append(job_data)

            return jobs
        except Exception as e:
            logger.error(f"Error getting jobs by Monday ID {monday_id}: {e}")
            raise

    # Utility methods
    def health_check(self):
        """Check if Firestore connection is healthy"""
        try:
            # Try to read from the collection
            test_ref = self.db.collection(self.COLLECTION_ROOT).document('health-check')
            test_ref.set({'timestamp': firestore.SERVER_TIMESTAMP, 'status': 'healthy'})
            doc = test_ref.get()
            test_ref.delete()
            return doc.exists
        except Exception as e:
            logger.error(f"Firestore health check failed: {e}")
            return False
