# PeopleHub Integration Plan for Resume-Ranker

## Executive Summary

**Goal:** Integrate PeopleHub's LinkedIn search capabilities into Resume-Ranker to enable recruiters to find new candidates on LinkedIn in addition to searching existing resumes in SharePoint.

**Current State:**
- Resume-Ranker searches **existing resumes** stored in SharePoint/GCS using Vertex AI Search
- PeopleHub finds **new candidates** on LinkedIn using natural language queries

**Value Proposition:**
- **Complementary capabilities:** Resume storage search + Active LinkedIn recruitment
- **Natural language search:** "10 AI engineers in Israel with startup experience"
- **Cost efficiency:** 70-90% cost reduction through intelligent caching
- **Comprehensive profiles:** Automated research and due diligence reports

---

## Architecture Options

### Option 1: Microservice Integration ⭐ **RECOMMENDED**

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Resume-Ranker Frontend                    │
│                      (React/TypeScript)                      │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              Resume-Ranker Backend (Flask/Python)            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  New: PeopleHubService (Python HTTP client)           │  │
│  └───────────────────┬───────────────────────────────────┘  │
└────────────────────┬─┴───────────────────────────────────────┘
                     │                        │
         Existing    │                        │ New
         Vertex AI   │                        │ HTTP calls
         Search      │                        │
                     │                        ▼
                     │         ┌──────────────────────────────┐
                     │         │  PeopleHub Service           │
                     │         │  (Next.js/Node.js)           │
                     │         │  Deployed separately         │
                     │         └──────────────────────────────┘
                     │                        │
                     │                        ▼
                     │         ┌──────────────────────────────┐
                     │         │  Bright Data API             │
                     │         │  → LinkedIn Scraping         │
                     │         └──────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  Firestore Database  │
          │  - Job data          │
          │  - Candidates        │
          │  - LinkedIn profiles │
          └──────────────────────┘
```

**Pros:**
- ✅ Clean separation of concerns
- ✅ Each service in its native tech stack (Python/Node.js)
- ✅ Independent scaling and deployment
- ✅ Easier maintenance and updates
- ✅ Can reuse PeopleHub's caching infrastructure (Redis + PostgreSQL)

**Cons:**
- ❌ Requires deploying/maintaining separate service
- ❌ Additional infrastructure costs
- ❌ Network latency between services

**Implementation Complexity:** Medium

---

### Option 2: Direct Code Porting

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│              Resume-Ranker Backend (Flask/Python)            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Ported: LinkedInSearchService (Python)               │  │
│  │  - Query parser (Gemini API - already using!)        │  │
│  │  - Bright Data integration (Python SDK)              │  │
│  │  - Caching (Redis or Firestore)                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**What to Port:**
1. **Query Parser:** Already using Gemini! Just add parsing logic
2. **Bright Data Integration:** Use Python SDK instead of Node.js
3. **Caching:** Use Redis (add to Docker) or leverage Firestore
4. **Profile Storage:** Use existing Firestore structure

**Pros:**
- ✅ Single codebase
- ✅ No separate service to deploy
- ✅ Lower infrastructure complexity
- ✅ Already using Gemini (shared API quota)

**Cons:**
- ❌ Significant development effort
- ❌ Lose PeopleHub's Next.js optimizations
- ❌ Need to maintain ported code separately
- ❌ Bright Data Python SDK may have different features

**Implementation Complexity:** High

---

### Option 3: API-Only Integration (Hosted PeopleHub)

**Requirements:** PeopleHub must be hosted and accessible via public API

**Pros:**
- ✅ Zero infrastructure management
- ✅ Fastest implementation

**Cons:**
- ❌ Depends on external service availability
- ❌ May not exist (need to check if PeopleHub offers hosted API)

**Implementation Complexity:** Low (if API exists)

---

## Recommended Implementation: Option 1 (Microservice)

### Phase 1: Deploy PeopleHub Service

#### Step 1.1: Clone and Setup PeopleHub

```bash
# Clone PeopleHub repository
cd /path/to/services
git clone https://github.com/MeirKaD/pepolehub.git
cd pepolehub

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with required credentials:
# - GEMINI_API_KEY (can share with Resume-Ranker)
# - BRIGHT_DATA_API_KEY (new - need to obtain)
# - DATABASE_URL (PostgreSQL - can use existing or new)
# - REDIS_URL (for caching)
```

#### Step 1.2: Docker Configuration

Create `pepolehub/Dockerfile`:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### Step 1.3: Deploy to Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/cendien-sales-support-ai/peoplehub
gcloud run deploy peoplehub \
  --image gcr.io/cendien-sales-support-ai/peoplehub \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=$GEMINI_API_KEY,BRIGHT_DATA_API_KEY=$BRIGHT_DATA_API_KEY"
```

**Note:** Get the Cloud Run service URL for next steps.

---

### Phase 2: Backend Integration

#### Step 2.1: Create PeopleHub Service

Create `backend/services/peoplehub_service.py`:

```python
import logging
import requests
from typing import Dict, Any, List, Optional
import os

logger = logging.getLogger(__name__)

class PeopleHubService:
    def __init__(self, peoplehub_url: Optional[str] = None):
        """
        Initialize PeopleHub service client

        Args:
            peoplehub_url: URL of PeopleHub service (e.g., Cloud Run URL)
        """
        self.base_url = peoplehub_url or os.getenv('PEOPLEHUB_URL', 'http://localhost:3000')
        self.timeout = 120  # LinkedIn searches can take time

        logger.info(f"Initialized PeopleHub service with URL: {self.base_url}")

    def search_linkedin(self, query: str) -> Dict[str, Any]:
        """
        Search for candidates on LinkedIn using natural language query

        Args:
            query: Natural language query (e.g., "10 AI engineers in Israel")

        Returns:
            Dictionary with success status and search results
        """
        try:
            response = requests.post(
                f"{self.base_url}/api/search",
                json={"query": query},
                timeout=self.timeout
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'profiles': data.get('results', []),
                    'query': query,
                    'cached': data.get('cached', False)
                }
            else:
                logger.error(f"PeopleHub search failed: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'error': f"Search failed with status {response.status_code}"
                }

        except requests.Timeout:
            logger.error(f"PeopleHub search timeout for query: {query}")
            return {
                'success': False,
                'error': 'Search request timed out. LinkedIn searches can take up to 2 minutes.'
            }
        except Exception as e:
            logger.error(f"Error calling PeopleHub: {e}")
            return {
                'success': False,
                'error': f'Failed to search LinkedIn: {str(e)}'
            }

    def get_profile_details(self, profile_id: str) -> Dict[str, Any]:
        """
        Get detailed profile information from PeopleHub

        Args:
            profile_id: Profile ID from search results

        Returns:
            Dictionary with profile details
        """
        try:
            response = requests.get(
                f"{self.base_url}/api/profiles/{profile_id}",
                timeout=30
            )

            if response.status_code == 200:
                return {
                    'success': True,
                    'profile': response.json()
                }
            else:
                return {
                    'success': False,
                    'error': f"Failed to get profile: {response.status_code}"
                }

        except Exception as e:
            logger.error(f"Error getting profile {profile_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def generate_research_report(self, profile_id: str) -> Dict[str, Any]:
        """
        Generate automated research report for a candidate

        Args:
            profile_id: Profile ID to research

        Returns:
            Dictionary with research report
        """
        try:
            response = requests.post(
                f"{self.base_url}/api/research",
                json={"profile_id": profile_id},
                timeout=180  # Research can take longer
            )

            if response.status_code == 200:
                return {
                    'success': True,
                    'report': response.json()
                }
            else:
                return {
                    'success': False,
                    'error': f"Failed to generate report: {response.status_code}"
                }

        except Exception as e:
            logger.error(f"Error generating research report: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def health_check(self) -> bool:
        """Check if PeopleHub service is available"""
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=5)
            return response.status_code == 200
        except:
            return False
```

#### Step 2.2: Add API Endpoints

Add to `backend/app.py`:

```python
# Add at top with other service initializations
from services.peoplehub_service import PeopleHubService

# Initialize PeopleHub service
peoplehub_service = PeopleHubService(os.getenv('PEOPLEHUB_URL'))
logger.info("PeopleHub service initialized")

# Add these endpoints after existing routes

@app.route('/api/jobs/<job_id>/search-linkedin', methods=['POST'])
def search_linkedin_candidates(job_id):
    """
    Search for candidates on LinkedIn based on job requirements

    Expects JSON body with:
    - query: Natural language search query (optional, will auto-generate from job)
    """
    try:
        # Get job details
        job = firestore_service.get_job(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        data = request.get_json() or {}

        # Use provided query or generate from job description
        if data.get('query'):
            search_query = data['query']
        else:
            # Auto-generate query from job requirements
            job_title = job.get('title', 'candidates')
            location = job.get('location', '')
            requirements = job.get('requirements', {})

            # Extract key skills
            mandatory_skills = requirements.get('mandatory_skills', [])
            skill_str = ', '.join(mandatory_skills[:3]) if mandatory_skills else ''

            # Build natural language query
            search_query = f"10 {job_title}"
            if location:
                search_query += f" in {location}"
            if skill_str:
                search_query += f" with {skill_str} skills"

        logger.info(f"Searching LinkedIn for job {job_id} with query: {search_query}")

        # Search via PeopleHub
        result = peoplehub_service.search_linkedin(search_query)

        if not result['success']:
            return jsonify(result), 500

        # Store LinkedIn profiles in Firestore
        profiles = result['profiles']
        linkedin_candidates = []

        for profile in profiles:
            # Create candidate record from LinkedIn profile
            candidate_data = {
                'source': 'linkedin',
                'linkedin_url': profile.get('profile_url', ''),
                'name': profile.get('name', 'Unknown'),
                'headline': profile.get('headline', ''),
                'location': profile.get('location', ''),
                'company': profile.get('current_company', ''),
                'experience': profile.get('experience', []),
                'education': profile.get('education', []),
                'skills': profile.get('skills', []),
                'search_query': search_query,
                'cached_result': result.get('cached', False)
            }

            linkedin_candidates.append(candidate_data)

        # Update job with LinkedIn search results
        firestore_service.update_job(job_id, {
            'linkedin_search_query': search_query,
            'linkedin_search_results': linkedin_candidates,
            'linkedin_search_timestamp': firestore.SERVER_TIMESTAMP
        })

        # Log activity
        user_email = session.get('user_email', 'unknown')
        activity_logger.log_activity(
            user_email=user_email,
            action='linkedin_search',
            details={
                'job_id': job_id,
                'job_title': job.get('title'),
                'query': search_query,
                'results_count': len(linkedin_candidates)
            }
        )

        return jsonify({
            'success': True,
            'query': search_query,
            'candidates': linkedin_candidates,
            'count': len(linkedin_candidates),
            'cached': result.get('cached', False)
        })

    except Exception as e:
        logger.error(f"Error searching LinkedIn: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/linkedin/profiles/<profile_id>/research', methods=['POST'])
def generate_linkedin_research(profile_id):
    """Generate automated research report for a LinkedIn candidate"""
    try:
        result = peoplehub_service.generate_research_report(profile_id)

        if not result['success']:
            return jsonify(result), 500

        # Log activity
        user_email = session.get('user_email', 'unknown')
        activity_logger.log_activity(
            user_email=user_email,
            action='linkedin_research',
            details={'profile_id': profile_id}
        )

        return jsonify(result)

    except Exception as e:
        logger.error(f"Error generating research: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/peoplehub/health', methods=['GET'])
def peoplehub_health():
    """Check PeopleHub service health"""
    is_healthy = peoplehub_service.health_check()
    return jsonify({
        'healthy': is_healthy,
        'service_url': peoplehub_service.base_url
    }), 200 if is_healthy else 503
```

#### Step 2.3: Update Requirements

Add to `backend/requirements.txt`:
```
requests>=2.31.0
```

---

### Phase 3: Frontend Integration

#### Step 3.1: Update API Service

Add to `frontend/src/services/apiService.ts`:

```typescript
// LinkedIn Search APIs
export const searchLinkedInCandidates = async (
  jobId: string,
  query?: string
): Promise<{
  success: boolean;
  query: string;
  candidates: any[];
  count: number;
  cached: boolean;
}> => {
  const response = await api.post(`/jobs/${jobId}/search-linkedin`, { query });
  return response.data;
};

export const generateLinkedInResearch = async (profileId: string) => {
  const response = await api.post(`/linkedin/profiles/${profileId}/research`);
  return response.data;
};

export const checkPeopleHubHealth = async () => {
  const response = await api.get('/peoplehub/health');
  return response.data;
};
```

#### Step 3.2: Update JobDetail Component

Add to `frontend/src/components/JobDetail.tsx`:

```typescript
// Add state for LinkedIn search
const [linkedinSearching, setLinkedinSearching] = useState(false);
const [linkedinResults, setLinkedinResults] = useState<any[]>([]);
const [customQuery, setCustomQuery] = useState('');

// Add LinkedIn search handler
const handleLinkedInSearch = async () => {
  setLinkedinSearching(true);
  try {
    const result = await searchLinkedInCandidates(
      jobId,
      customQuery || undefined
    );

    if (result.success) {
      setLinkedinResults(result.candidates);
      toast.success(
        `Found ${result.count} candidates on LinkedIn${result.cached ? ' (cached)' : ''}`
      );
    } else {
      toast.error('LinkedIn search failed');
    }
  } catch (error) {
    console.error('LinkedIn search error:', error);
    toast.error('Failed to search LinkedIn');
  } finally {
    setLinkedinSearching(false);
  }
};

// Add new tab in the existing tabs section
// Inside the Tabs component, add:

<Tab label="LinkedIn Candidates" value="linkedin">
  <div className="p-6 space-y-4">
    {/* Search Input */}
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-lg font-semibold mb-3">
        Search LinkedIn for Candidates
      </h3>

      <div className="flex gap-2">
        <input
          type="text"
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
          placeholder="e.g., '10 AI engineers in Israel' (leave empty for auto-generation)"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
        />

        <button
          onClick={handleLinkedInSearch}
          disabled={linkedinSearching}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {linkedinSearching ? (
            <>
              <Loader2 className="animate-spin inline mr-2" size={16} />
              Searching...
            </>
          ) : (
            'Search LinkedIn'
          )}
        </button>
      </div>

      <p className="text-sm text-gray-500 mt-2">
        Searches may take 30-120 seconds depending on cache status
      </p>
    </div>

    {/* Results Display */}
    {linkedinResults.length > 0 && (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h4 className="font-semibold mb-4">
          Search Results ({linkedinResults.length})
        </h4>

        <div className="space-y-4">
          {linkedinResults.map((candidate, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h5 className="font-semibold text-lg">
                    {candidate.name}
                  </h5>
                  <p className="text-gray-600">{candidate.headline}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {candidate.location} • {candidate.company}
                  </p>

                  {/* Skills */}
                  {candidate.skills && candidate.skills.length > 0 && (
                    <div className="mt-3">
                      <span className="text-sm font-medium">Skills: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {candidate.skills.slice(0, 5).map((skill: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                          >
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 5 && (
                          <span className="text-xs text-gray-500">
                            +{candidate.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <a
                    href={candidate.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    View Profile
                  </a>

                  <button
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                    onClick={() => {
                      // TODO: Implement analyze functionality
                      // Could generate AI analysis of LinkedIn profile
                      toast.info('Analysis feature coming soon');
                    }}
                  >
                    Analyze
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
</Tab>
```

---

### Phase 4: Environment Configuration

#### Step 4.1: Update Backend .env

Add to `backend/.env`:
```bash
# PeopleHub Integration
PEOPLEHUB_URL=https://peoplehub-xxxx-uc.a.run.app
```

#### Step 4.2: Update Docker Configuration

If using Docker Compose, update `docker-compose.yml`:
```yaml
services:
  backend:
    environment:
      - PEOPLEHUB_URL=${PEOPLEHUB_URL}
```

---

### Phase 5: Firestore Schema Extension

Update Firestore structure to include LinkedIn data:

```
resume-evaluator/
  └── jobs/
      └── jobs/
          └── {job_id}/
              ├── title: string
              ├── description: string
              ├── linkedin_search_query: string       # NEW
              ├── linkedin_search_results: array      # NEW
              │   └── {
              │       source: 'linkedin',
              │       name: string,
              │       linkedin_url: string,
              │       headline: string,
              │       location: string,
              │       company: string,
              │       skills: array,
              │       experience: array,
              │       education: array,
              │       search_query: string,
              │       cached_result: boolean
              │   }
              └── linkedin_search_timestamp: timestamp # NEW
```

---

## Cost Analysis

### PeopleHub Deployment Costs

**Option A: Shared Infrastructure**
- Use existing Cloud Run, Firestore
- Add Redis (Cloud Memorystore): ~$50-100/month
- PostgreSQL (Cloud SQL): ~$30-50/month for small instance
- **Total: ~$80-150/month**

**Option B: Full Separation**
- Dedicated Cloud Run: ~$20-50/month
- Separate PostgreSQL: ~$30-50/month
- Separate Redis: ~$50-100/month
- **Total: ~$100-200/month**

### Bright Data API Costs
- LinkedIn profile search: ~$1-5 per search (depending on volume)
- PeopleHub's caching reduces this by 70-90%
- Estimate: ~$50-200/month depending on usage

**Total Additional Cost: $130-400/month**

---

## Testing Plan

### Unit Tests
1. Test PeopleHubService methods
2. Test API endpoints
3. Test error handling

### Integration Tests
1. Test end-to-end search flow
2. Test caching behavior
3. Test timeout handling
4. Test result storage in Firestore

### UI Tests
1. Test LinkedIn search button
2. Test results display
3. Test error states
4. Test loading states

---

## Rollout Strategy

### Phase 1: Internal Testing (Week 1-2)
- Deploy PeopleHub to staging
- Implement backend service
- Manual testing with small dataset

### Phase 2: Beta (Week 3-4)
- Add frontend UI
- Test with real LinkedIn searches
- Gather feedback

### Phase 3: Production (Week 5+)
- Deploy to production
- Monitor costs and performance
- Iterate based on usage

---

## Alternative: Simpler MVP Approach

If full PeopleHub integration is too complex, consider a **simpler MVP**:

### Lightweight LinkedIn Search Integration

**Use Bright Data API directly** without deploying full PeopleHub:

```python
# backend/services/linkedin_search_service.py
import requests
import os

class LinkedInSearchService:
    def __init__(self):
        self.api_key = os.getenv('BRIGHT_DATA_API_KEY')
        self.base_url = 'https://api.brightdata.com/datasets/v3'

    def search_profiles(self, keywords: str, location: str = None, limit: int = 10):
        """Simple LinkedIn search using Bright Data API"""
        params = {
            'keywords': keywords,
            'limit': limit
        }
        if location:
            params['location'] = location

        response = requests.post(
            f"{self.base_url}/trigger",
            json={
                'dataset_id': 'gd_linkedin_people_search',
                'parameters': params
            },
            headers={'Authorization': f'Bearer {self.api_key}'}
        )

        return response.json()
```

**Pros:**
- Much simpler to implement
- Lower infrastructure costs
- Still gets LinkedIn search capability

**Cons:**
- No intelligent caching (higher API costs)
- No natural language query parsing
- No automated research reports
- Manual integration work

---

## Recommendation

**Start with Option 1 (Microservice Integration) using a phased approach:**

1. **Week 1-2:** Deploy PeopleHub to Cloud Run, test basic connectivity
2. **Week 3:** Implement backend PeopleHubService and API endpoints
3. **Week 4:** Add frontend UI for LinkedIn search
4. **Week 5:** Beta testing with real users
5. **Week 6+:** Monitor, optimize, and iterate

**Alternative:** If resources are constrained, start with the **Lightweight MVP** approach to validate user demand, then upgrade to full PeopleHub integration if usage justifies it.

---

## Next Steps

1. **Decision:** Choose integration approach (full PeopleHub vs. lightweight MVP)
2. **Obtain API Keys:** Sign up for Bright Data API
3. **Deploy:** Set up PeopleHub service (if going with full integration)
4. **Implement:** Follow phase-by-phase implementation plan
5. **Test:** Comprehensive testing before production deployment
6. **Monitor:** Track costs and usage metrics

---

## Questions to Answer

1. **Budget:** What's the monthly budget for LinkedIn search features?
2. **Volume:** How many LinkedIn searches per month are expected?
3. **Infrastructure:** Preference for separate service vs. monolithic?
4. **Timeline:** When does this feature need to be live?
5. **API Access:** Do we have Bright Data API access already?

---

## Contact Points

- **PeopleHub GitHub:** https://github.com/MeirKaD/pepolehub
- **Bright Data API:** https://brightdata.com/products/datasets/linkedin
- **Resume-Ranker Current Branch:** `claude/integrate-pepolehub-search-01VZyWvpTsXbfbmicdZTiv4T`
