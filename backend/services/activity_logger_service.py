from firebase_admin import firestore as firebase_firestore
from google.cloud import firestore
import logging
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class ActivityLoggerService:
    # Collection path constant
    COLLECTION_ROOT = 'resume-evaluator'

    def __init__(self):
        self.db = firebase_firestore.client()

    def log_activity(
        self,
        user_email: str,
        user_name: str,
        action: str,
        details: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Log a user activity to Firestore

        Args:
            user_email: Email of the user performing the action
            user_name: Name of the user performing the action
            action: Type of action (login, job_created, candidate_analyzed, etc.)
            details: Additional details about the action

        Returns:
            True if logged successfully, False otherwise
        """
        try:
            activity_data = {
                'user_email': user_email,
                'user_name': user_name,
                'action': action,
                'details': details or {},
                'timestamp': firestore.SERVER_TIMESTAMP
            }

            # Create the activity log document
            self.db.collection(self.COLLECTION_ROOT)\
                .document('activities')\
                .collection('logs')\
                .document()\
                .set(activity_data)

            logger.info(f"Activity logged: {user_name} - {action}")
            return True

        except Exception as e:
            logger.error(f"Error logging activity: {e}")
            return False

    def get_recent_activities(self, limit: int = 50) -> list:
        """
        Get recent activity logs

        Args:
            limit: Maximum number of activities to retrieve

        Returns:
            List of activity log dictionaries
        """
        try:
            docs = (self.db.collection(self.COLLECTION_ROOT)
                   .document('activities')
                   .collection('logs')
                   .order_by('timestamp', direction=firestore.Query.DESCENDING)
                   .limit(limit)
                   .stream())

            activities = []
            for doc in docs:
                activity_data = doc.to_dict()
                activity_data['id'] = doc.id

                # Convert Firestore timestamp to string for JSON serialization
                if 'timestamp' in activity_data and activity_data['timestamp']:
                    activity_data['timestamp'] = activity_data['timestamp'].isoformat() if hasattr(activity_data['timestamp'], 'isoformat') else str(activity_data['timestamp'])

                activities.append(activity_data)

            logger.info(f"Retrieved {len(activities)} activity logs")
            return activities

        except Exception as e:
            logger.error(f"Error retrieving activities: {e}")
            return []

    def get_activities_by_user(self, user_email: str, limit: int = 50) -> list:
        """
        Get activity logs for a specific user

        Args:
            user_email: Email of the user
            limit: Maximum number of activities to retrieve

        Returns:
            List of activity log dictionaries
        """
        try:
            docs = (self.db.collection(self.COLLECTION_ROOT)
                   .document('activities')
                   .collection('logs')
                   .where('user_email', '==', user_email)
                   .order_by('timestamp', direction=firestore.Query.DESCENDING)
                   .limit(limit)
                   .stream())

            activities = []
            for doc in docs:
                activity_data = doc.to_dict()
                activity_data['id'] = doc.id

                # Convert Firestore timestamp to string
                if 'timestamp' in activity_data and activity_data['timestamp']:
                    activity_data['timestamp'] = activity_data['timestamp'].isoformat() if hasattr(activity_data['timestamp'], 'isoformat') else str(activity_data['timestamp'])

                activities.append(activity_data)

            logger.info(f"Retrieved {len(activities)} activity logs for user {user_email}")
            return activities

        except Exception as e:
            logger.error(f"Error retrieving user activities: {e}")
            return []

    @staticmethod
    def format_activity_message(activity: Dict[str, Any]) -> str:
        """
        Format an activity log into a human-readable message

        Args:
            activity: Activity log dictionary

        Returns:
            Formatted message string
        """
        user_name = activity.get('user_name', 'Unknown user')
        action = activity.get('action', '')
        details = activity.get('details', {})

        if action == 'login':
            return f"{user_name} logged in"
        elif action == 'job_created':
            job_title = details.get('job_title', 'Unknown job')
            return f"{user_name} created job '{job_title}'"
        elif action == 'candidate_analyzed':
            candidate_name = details.get('candidate_name', 'Unknown candidate')
            job_title = details.get('job_title', 'Unknown job')
            return f"{user_name} analyzed candidate '{candidate_name}' for job '{job_title}'"
        elif action == 'resume_improved':
            candidate_name = details.get('candidate_name', 'Unknown candidate')
            template = details.get('template_used', 'Unknown template')
            return f"{user_name} improved resume for candidate '{candidate_name}' using template '{template}'"
        elif action == 'job_deleted':
            job_title = details.get('job_title', 'Unknown job')
            return f"{user_name} deleted job '{job_title}'"
        elif action == 'candidate_deleted':
            candidate_name = details.get('candidate_name', 'Unknown candidate')
            return f"{user_name} deleted candidate '{candidate_name}'"
        else:
            return f"{user_name} performed action: {action}"
