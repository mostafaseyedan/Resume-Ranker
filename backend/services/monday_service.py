import requests
import logging
import os
import json
import threading
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from google.cloud import firestore

logger = logging.getLogger(__name__)

class MondayService:
    def __init__(self, api_key: str, board_id: Optional[str] = None, cache_ttl_seconds: int = 60):
        self.api_key = api_key
        self.board_id: str = board_id or os.getenv('MONDAY_BOARD_ID', '18004940852')
        self.base_url = "https://api.monday.com/v2"
        self.headers = {
            "Authorization": api_key,
            "Content-Type": "application/json"
        }
        self.cache_ttl_seconds = max(int(cache_ttl_seconds or 0), 0)
        self._cache: Dict[str, Dict[str, any]] = {}
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

    def _cache_set(self, key: str, data: any):
        if self.cache_ttl_seconds <= 0:
            return
        with self._cache_lock:
            self._cache[key] = {
                'data': data,
                'expires_at': datetime.utcnow() + timedelta(seconds=self.cache_ttl_seconds)
            }

    def clear_cache(self) -> None:
        with self._cache_lock:
            self._cache.clear()

    def get_board_data(self, board_id: Optional[str] = None, use_cache: bool = True) -> Dict:
        """
        Fetch board data including items and columns settings (for colors)
        """
        try:
            # Use instance board_id if not provided
            board_id_to_use = board_id if board_id is not None else self.board_id
            cache_key = f"board:{board_id_to_use}"
            if use_cache:
                cached = self._cache_get(cache_key)
                if cached is not None:
                    return cached

            query = """
            query {
                boards (ids: %s) {
                    columns {
                        id
                        settings_str
                    }
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
                return {}

            boards = data.get('data', {}).get('boards', [])
            if not boards:
                logger.warning("No boards found")
                return {}
            
            board = boards[0]
            if use_cache:
                self._cache_set(cache_key, board)
            return board

        except requests.RequestException as e:
            logger.error(f"Error fetching from Monday.com: {e}")
            return {}
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return {}

    def parse_column_colors(self, columns: List[Dict]) -> Dict[str, Dict[str, str]]:
        """
        Parse column settings to get text-to-color mapping.
        Returns: { column_id: { label_text: hex_color } }
        """
        color_map = {}
        for col in columns:
            try:
                if not col.get('settings_str'):
                    continue
                    
                settings = json.loads(col['settings_str'])
                if 'labels' in settings and 'labels_colors' in settings:
                    col_map = {}
                    labels = settings['labels']
                    colors = settings['labels_colors']
                    
                    # labels is dict of { index: label_text }
                    # labels_colors is dict of { index: { color: hex, ... } }
                    for idx, label_text in labels.items():
                        if idx in colors and 'var_name' in colors[idx]:
                            col_map[label_text] = colors[idx]['var_name']
                        elif idx in colors and 'color' in colors[idx]:
                             # Fallback to color if var_name missing (though less useful for Vibe)
                             col_map[label_text] = colors[idx]['color']
                    
                    if col_map:
                        color_map[col['id']] = col_map
            except Exception as e:
                logger.warning(f"Failed to parse settings for column {col.get('id')}: {e}")
                
        return color_map

    def get_job_requisitions(self, board_id: Optional[str] = None, use_cache: bool = True) -> List[Dict]:
        """
        Legacy wrapper for backward compatibility or simple item fetching
        """
        data = self.get_board_data(board_id, use_cache=use_cache)
        return data.get('items_page', {}).get('items', [])

    def parse_job_item(self, item: Dict, color_map: Dict[str, Dict[str, str]] = None) -> Dict:
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

                # Debug log to find column IDs
                if col_text and col_id not in ['name', 'subitems', 'mirror']:
                    logger.info(f"Column ID: {col_id} | Text: {col_text}")

                # Map specific columns
                if col_id == 'color_mkvy85b7' and col_text:  # Req Status
                    metadata['status'] = col_text
                    if color_map and col_id in color_map and col_text in color_map[col_id]:
                        metadata['status_color'] = color_map[col_id][col_text]
                        
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
                    if color_map and col_id in color_map and col_text in color_map[col_id]:
                        metadata['work_mode_color'] = color_map[col_id][col_text]
                elif col_id == 'color_mkvym9qm' and col_text:  # Employment Type
                    metadata['employment_type'] = col_text
                    if color_map and col_id in color_map and col_text in color_map[col_id]:
                        metadata['employment_type_color'] = color_map[col_id][col_text]
                elif col_id == 'date_17' and col_text:  # Due date
                    metadata['due_date'] = col_text
                elif col_id == 'date_mkvyd9rn' and col_text:  # Open Date
                    metadata['open_date'] = col_text
                elif col_id == 'date_mkvyd3ye' and col_text:  # Close Date
                    metadata['close_date'] = col_text
                elif col_id == 'file_mkw32xnz' and col_text:  # SharePoint link
                    metadata['sharepoint_link'] = col_text
                elif col_id == 'link_mkvy6wjb' and col_text:
                    metadata['job_post_link'] = col_text
                elif col_id == 'text_mkw3tw0e' and col_text:  # Client column
                    metadata['client'] = col_text

                # Store all column values for reference
                if col_text:
                    metadata['column_values'][col_id] = col_text

            job_data['monday_metadata'] = metadata

            return job_data

        except Exception as e:
            logger.error(f"Error parsing job item {item.get('id', 'unknown')}: {e}")
            return {}

    def sync_jobs(self, firestore_service, use_cache: bool = True) -> Dict:
        """
        Sync jobs from Monday.com to Firestore
        """
        try:
            # Fetch board data
            board_data = self.get_board_data(use_cache=use_cache)
            if not board_data:
                return {'success': False, 'message': 'No data found in Monday.com'}
            
            monday_items = board_data.get('items_page', {}).get('items', [])
            columns = board_data.get('columns', [])
            
            # Parse colors
            color_map = self.parse_column_colors(columns)

            if not monday_items:
                return {'success': False, 'message': 'No jobs found in Monday.com'}

            def process_item(item: Dict):
                try:
                    job_data = self.parse_job_item(item, color_map)

                    if not job_data:
                        return {'error': f"Failed to parse item {item.get('id', 'unknown')}"}

                    existing_jobs = firestore_service.get_jobs_by_monday_id(job_data['monday_id'])
                    metadata = job_data.pop('monday_metadata', {})

                    if existing_jobs:
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

                        return {
                            'action': 'updated',
                            'job_id': job_id,
                            'title': job_data.get('title') or existing_jobs[0].get('title')
                        }

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
                    return {'action': 'created', 'job_id': job_id, 'title': new_job['title']}

                except Exception as e:
                    return {'error': f"Error syncing item {item.get('id', 'unknown')}: {e}"}

            synced_jobs = []
            errors = []
            max_workers = min(8, len(monday_items)) or 1
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [executor.submit(process_item, item) for item in monday_items]
                for future in as_completed(futures):
                    result = future.result()
                    if 'error' in result:
                        logger.error(result['error'])
                        errors.append(result['error'])
                    else:
                        synced_jobs.append(result)

            return {
                'success': True,
                'synced_jobs': synced_jobs,
                'total_synced': len(synced_jobs),
                'errors': errors
            }

        except Exception as e:
            logger.error(f"Error in sync_jobs: {e}")
            return {'success': False, 'message': f'Sync failed: {str(e)}'}
