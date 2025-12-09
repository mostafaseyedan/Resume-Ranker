import requests
import os
import json
import logging
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load env vars from root .env
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

MONDAY_API_KEY = os.getenv('MONDAY_API_KEY')
MONDAY_BOARD_ID = os.getenv('MONDAY_BOARD_ID', '18004940852')

if not MONDAY_API_KEY:
    print("Error: MONDAY_API_KEY not found in environment variables")
    exit(1)

print(f"Using Board ID: {MONDAY_BOARD_ID}")
print(f"API Key present: {bool(MONDAY_API_KEY)}")

class DebugMondayService:
    def __init__(self, api_key, board_id):
        self.api_key = api_key
        self.board_id = board_id
        self.base_url = "https://api.monday.com/v2"
        self.headers = {
            "Authorization": api_key,
            "Content-Type": "application/json"
        }

    def get_board_columns(self):
        query = """
        query {
            boards (ids: %s) {
                columns {
                    id
                    title
                    settings_str
                }
            }
        }
        """ % self.board_id

        try:
            response = requests.post(self.base_url, json={"query": query}, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            
            if 'errors' in data:
                print("API Errors:", data['errors'])
                return None
                
            boards = data.get('data', {}).get('boards', [])
            if not boards:
                print("No boards found")
                return None
                
            return boards[0].get('columns', [])
            
        except Exception as e:
            print(f"Exception: {e}")
            return None

    def parse_colors(self, columns):
        print("\n--- Parsing Column Colors ---\n")
        for col in columns:
            if not col.get('settings_str'):
                continue
                
            try:
                settings = json.loads(col['settings_str'])
                if 'labels' in settings and 'labels_colors' in settings:
                    print(f"Column: {col['title']} (ID: {col['id']})")
                    labels = settings['labels']
                    colors = settings['labels_colors']
                    
                    found_colors = False
                    for idx, label_text in labels.items():
                        if idx in colors:
                            color_data = colors[idx]
                            hex_color = color_data.get('color')
                            var_name = color_data.get('var_name')
                            print(f"  - {label_text}: {hex_color} (var: {var_name})")
                            found_colors = True
                    
                    if not found_colors:
                        print("  (No colors found in settings)")
                    print("")
            except Exception as e:
                print(f"Error parsing {col['id']}: {e}")

def main():
    service = DebugMondayService(MONDAY_API_KEY, MONDAY_BOARD_ID)
    columns = service.get_board_columns()
    
    if columns:
        service.parse_colors(columns)
    else:
        print("Failed to fetch columns")

if __name__ == "__main__":
    main()
