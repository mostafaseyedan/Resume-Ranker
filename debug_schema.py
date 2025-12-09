
import sys
import os
import json
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from services.gemini_analyzer import JobAnalysis

schema = JobAnalysis.model_json_schema()
print(json.dumps(schema, indent=2))
