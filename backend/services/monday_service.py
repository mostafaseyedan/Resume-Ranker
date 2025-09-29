import requests
import logging
import os
from typing import List, Dict, Optional
from google.cloud import firestore

logger = logging.getLogger(__name__)

class MondayService:
    def __init__(self, api_key: str, board_id: Optional[str] = None):
        self.api_key = api_key
        self.board_id: str = board_id or os.getenv('MONDAY_BOARD_ID', '18004940852')
        self.base_url = "https://api.monday.com/v2"
        self.headers = {
            "Authorization": api_key,
            "Content-Type": "application/json"
        }

    def get_job_requisitions(self, board_id: Optional[str] = None) -> List[Dict]:
        """
        Fetch job requisitions from Monday.com board
        """
        try:
            # Use instance board_id if not provided
            board_id_to_use = board_id if board_id is not None else self.board_id

            query = """
            query {
                boards (ids: %s) {
                    items_page {
                        cursor
                        items {
                            id
                            name
                            group {
                                id
                                title
                            }
                            column_values {
                                id
                                type
                                value
                                text
                            }
                        }
                    }
                }
            }
            """ % board_id_to_use

            payload = {"query": query}

            response = requests.post(self.base_url, json=payload, headers=self.headers)
            response.raise_for_status()

            data = response.json()

            if 'errors' in data:
                logger.error(f"Monday.com API errors: {data['errors']}")
                return []

            boards = data.get('data', {}).get('boards', [])
            if not boards:
                logger.warning("No boards found")
                return []

            items = boards[0].get('items_page', {}).get('items', [])
            logger.info(f"Retrieved {len(items)} job requisitions from Monday.com")

            return items

        except requests.RequestException as e:
            logger.error(f"Error fetching from Monday.com: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return []

    def parse_job_item(self, item: Dict) -> Dict:
        """
        Parse a Monday.com job item into our job format
        """
        try:
            job_data = {
                'monday_id': item['id'],
                'title': item['name'],
                'status': 'active'
            }

            metadata = {
                'group': item.get('group', {}).get('title'),
                'column_values': {}
            }

            # Parse column values to extract additional info
            for col in item.get('column_values', []):
                col_id = col.get('id', '')
                col_text = col.get('text', '')

                # Map specific columns
                if col_id == 'color_mkvy85b7' and col_text:  # Req Status
                    metadata['status'] = col_text
                    # Map Monday status to job status for compatibility
                    status_mapping = {
                        'Open': 'active',
                        'Submitted': 'active',
                        'Interviewing': 'active',
                        'Not Pursuing': 'inactive',
                        'Closed': 'closed'
                    }
                    job_data['status'] = status_mapping.get(col_text, 'active')
                elif col_id == 'color_mkw33brw' and col_text:  # Work Mode
                    metadata['work_mode'] = col_text
                elif col_id == 'color_mkvym9qm' and col_text:  # Employment Type
                    metadata['employment_type'] = col_text
                elif col_id == 'date_17' and col_text:  # Due date
                    metadata['due_date'] = col_text
                elif col_id == 'file_mkw32xnz' and col_text:  # SharePoint link
                    metadata['sharepoint_link'] = col_text
                elif col_id == 'link_mkvy6wjb' and col_text:
                    metadata['job_post_link'] = col_text
                elif col_id == 'text_mkw3tw0e' and col_text:
                    metadata['job_location'] = col_text

                # Store all column values for reference
                if col_text:
                    metadata['column_values'][col_id] = col_text

            job_data['monday_metadata'] = metadata

            return job_data

        except Exception as e:
            logger.error(f"Error parsing job item {item.get('id', 'unknown')}: {e}")
            return {}

    def sync_jobs(self, firestore_service) -> Dict:
        """
        Sync jobs from Monday.com to Firestore
        """
        try:
            # Fetch job requisitions from Monday.com
            monday_items = self.get_job_requisitions()

            if not monday_items:
                return {'success': False, 'message': 'No jobs found in Monday.com'}

            synced_jobs = []
            errors = []

            for item in monday_items:
                try:
                    job_data = self.parse_job_item(item)

                    if not job_data:
                        errors.append(f"Failed to parse item {item.get('id', 'unknown')}")
                        continue

                    # Check if job already exists (by monday_id)
                    existing_jobs = firestore_service.get_jobs_by_monday_id(job_data['monday_id'])

                    metadata = job_data.pop('monday_metadata', {})

                    if existing_jobs:
                        # Update existing job with limited fields
                        job_id = existing_jobs[0]['id']
                        update_data = {}

                        if 'status' in job_data and job_data['status']:
                            update_data['status'] = job_data['status']

                        if metadata:
                            update_data['monday_metadata'] = metadata

                        if 'title' in job_data and job_data['title']:
                            update_data['title'] = job_data['title']

                        if update_data:
                            firestore_service.update_job(job_id, update_data)

                        synced_jobs.append({
                            'action': 'updated',
                            'job_id': job_id,
                            'title': job_data.get('title') or existing_jobs[0].get('title')
                        })
                    else:
                        # Create new job - add required fields
                        new_job = {
                            'title': job_data.get('title', 'Untitled Job'),
                            'description': '',
                            'status': job_data.get('status', 'active'),
                            'monday_id': job_data['monday_id'],
                            'monday_metadata': metadata,
                            'created_at': firestore.SERVER_TIMESTAMP,
                            'created_by': 'monday_sync'
                        }

                        job_id = firestore_service.create_job(new_job)
                        synced_jobs.append({'action': 'created', 'job_id': job_id, 'title': new_job['title']})

                except Exception as e:
                    error_msg = f"Error syncing item {item.get('id', 'unknown')}: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)

            return {
                'success': True,
                'synced_jobs': synced_jobs,
                'total_synced': len(synced_jobs),
                'errors': errors
            }

        except Exception as e:
            logger.error(f"Error in sync_jobs: {e}")
            return {'success': False, 'message': f'Sync failed: {str(e)}'}
