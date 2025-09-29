# AI Resume Evaluator - Developer Guide

## Overview

The AI Resume Evaluator is a web application that helps IT staffing firms automate candidate evaluation by using Google's Gemini AI to analyze resumes against specific job requirements. The system provides intelligent scoring, ranking, and resume improvement suggestions.

## Technology Stack

### Backend
- **Framework**: Flask 3.1.1 (Python web framework)
- **AI**: Google GenAI SDK 1.39.0 with Gemini 2.5 Flash
- **PDF Generation**: WeasyPrint with Jinja2 templates for professional resume output
- **Database**: Firebase Firestore (NoSQL document database)
- **Authentication**: Azure AD with MSAL Node (server-side validation)
- **Document Parsing**: PyMuPDF (PDF) and python-docx (Word documents)
- **Data Validation**: Pydantic 2.11.9 for structured AI responses
- **Typography**: Carlito font (Calibri-compatible) for professional documents

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite 7.x (faster than Create React App)
- **Authentication**: MSAL Browser for Azure AD integration
- **Styling**: TailwindCSS 4.x with PostCSS
- **HTTP Client**: Axios for API communication
- **Routing**: React Router v7

### Infrastructure
- **Deployment**: Google Cloud Run (serverless containers)
- **Database**: Firebase Firestore in `cendien-sales-support-ai` project
- **Authentication**: Azure AD tenant integration

## Project Structure

```
ai-resume-evaluator/
├── backend/                          # Flask API server
│   ├── app.py                       # Main Flask application
│   ├── requirements.txt             # Python dependencies
│   ├── .env.example                # Environment variables template
│   └── services/                   # Business logic modules
│       ├── __init__.py
│       ├── firestore_service.py    # Database operations
│       ├── gemini_analyzer.py      # AI analysis with Pydantic models
│       ├── gemini_file_processor.py # PDF/DOCX text extraction with Gemini
│       ├── monday_service.py       # Monday.com integration
│       ├── sharepoint_service.py   # SharePoint integration
│       ├── resume_service.py       # Main resume improvement orchestrator
│       ├── resume_generator.py     # PDF generation with WeasyPrint
│       ├── resume_models.py        # Pydantic data models
│       └── resume_template.html    # Professional resume template
├── frontend/                       # React web application
│   ├── src/
│   │   ├── components/             # React components
│   │   │   ├── Login.tsx          # Azure AD login page
│   │   │   ├── Dashboard.tsx      # Main application view
│   │   │   ├── JobList.tsx        # Job management sidebar
│   │   │   ├── JobDetail.tsx      # Job details and tabs
│   │   │   ├── ResumeUpload.tsx   # File upload component
│   │   │   ├── CandidateList.tsx  # Ranked candidates display
│   │   │   └── CandidateDetail.tsx # Detailed analysis view
│   │   ├── config/                # Configuration files
│   │   │   ├── msalConfig.ts      # Azure AD MSAL settings
│   │   │   └── apiConfig.ts       # API endpoints configuration
│   │   ├── hooks/                 # Custom React hooks
│   │   │   └── useAuth.ts         # Authentication logic
│   │   ├── services/              # API service layer
│   │   │   └── apiService.ts      # HTTP client and API calls
│   │   ├── App.tsx                # Main application component
│   │   ├── index.tsx              # React application entry point
│   │   └── index.css              # Global styles with Tailwind
│   ├── public/                    # Static assets
│   │   ├── cendien_corp_logo.jpg  # Company logo
│   │   ├── team2.png              # Login page background
│   │   └── index.html             # HTML template
│   ├── package.json               # Node.js dependencies
│   ├── vite.config.ts             # Vite build configuration
│   ├── tailwind.config.js         # TailwindCSS configuration
│   ├── postcss.config.js          # PostCSS configuration
│   └── .env                       # Environment variables (Vite format)
└── config/                        # Shared configuration
    └── firebase-setup.md           # Firebase setup instructions
```

## Database Schema (Firestore)

### Collection Structure
```
resume-evaluator/                   # Main collection (dedicated namespace)
├── jobs/                          # Jobs subcollection
│   └── jobs/                     # Actual job documents
│       └── {jobId}/
│           ├── id: string
│           ├── title: string
│           ├── description: string
│           ├── department: string
│           ├── status: "active" | "closed"
│           ├── requirements: JobRequirements
│           ├── skill_weights: Record<string, number>
│           ├── created_by: string (email)
│           ├── created_at: timestamp
│           └── candidates/        # Subcollection for ranking
│               └── {candidateId}/
│                   ├── candidate_id: string
│                   ├── name: string
│                   ├── email: string
│                   ├── overall_score: number
│                   ├── summary: string
│                   ├── created_at: timestamp
│                   └── uploaded_by: string
└── candidates/                   # Candidates subcollection
    └── candidates/               # Actual candidate documents
        └── {candidateId}/
            ├── id: string
            ├── name: string (extracted from resume)
            ├── email: string (extracted)
            ├── phone: string (extracted)
            ├── resume_filename: string
            ├── resume_text: string (parsed content)
            ├── job_id: string (reference)
            ├── analysis: ResumeAnalysis (structured AI output)
            ├── uploaded_by: string (user email)
            └── created_at: timestamp
```

## Environment Configuration

### Backend (.env)
```bash
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Azure AD Configuration
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT_ID=your_tenant_id
AZURE_AUTHORITY=https://login.microsoftonline.com/your_tenant_id

# Flask Configuration
FLASK_SECRET_KEY=your_secure_random_key
FLASK_DEBUG=True

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env)
```bash
# Azure AD Configuration (VITE_ prefix required)
VITE_AZURE_CLIENT_ID=your_client_id
VITE_AZURE_TENANT_ID=your_tenant_id
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/your_tenant_id
VITE_REDIRECT_URI=http://localhost:3000/auth/callback

# API Configuration
VITE_API_BASE_URL=http://localhost:5000/api

# Environment
NODE_ENV=development
```

## Key Features & Workflows

### 1. Authentication Flow
1. User clicks "Continue with Microsoft" on login page
2. MSAL redirects to Azure AD for authentication
3. After successful login, frontend acquires access token
4. Token sent to backend `/api/auth/login` endpoint
5. Backend creates session for subsequent API calls

### 2. Job Management
1. Create job positions with detailed descriptions
2. AI automatically extracts requirements and assigns skill weights
3. Jobs stored in Firestore with structured data

### 3. Resume Analysis Pipeline
1. Upload PDF/DOCX resume files
2. Backend parses document using PyMuPDF or python-docx
3. Cleaned text sent to Gemini 2.5 Pro with job description
4. AI returns structured analysis using Pydantic models
5. Results stored in Firestore with denormalized ranking data

### 4. Candidate Ranking
1. Candidates automatically ranked by overall score
2. Real-time updates via Firestore listeners
3. Detailed analysis available on candidate click

### 5. Resume Improvement & PDF Generation
1. AI generates comprehensive improved resume based on job requirements
2. Creates detailed professional experience sections with:
   - Summary (4-8 lines overview)
   - Notable Projects (2-6 projects with detailed explanations)
   - Responsibilities (4-12 bullet points)
   - Accomplishments (4-10 quantifiable achievements)
   - Environment (technology stack listing)
3. Adds relevant certifications based on industry standards
4. Includes education relevance explanations for job alignment
5. Generates professional PDF using WeasyPrint with:
   - Legal paper size format
   - Professional typography (Carlito font)
   - Company branding and footer
   - Proper page break handling

## AI Integration (Gemini)

### Pydantic Models
The system uses structured output with Pydantic models to ensure reliable AI responses:

```python
class JobAnalysis(BaseModel):
    requirements: JobRequirements
    skill_weights: dict[str, float]
    position_level: str
    key_responsibilities: List[str]

class ResumeAnalysis(BaseModel):
    candidate_name: str
    candidate_email: str
    candidate_phone: str
    overall_score: int  # 0-100
    summary: str
    strengths: List[Strength]
    weaknesses: List[Weakness]
    skill_analysis: List[SkillAnalysis]
    experience_match: ExperienceMatch
    education_match: EducationMatch
```

### Configuration
- Model: `gemini-2.5-pro`
- Response format: `application/json` with schema validation
- No fallback parsing needed - guaranteed structured output

## Development Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- Firebase project access
- Azure AD app registration
- Google Gemini API key

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Configure environment variables
python app.py
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
# Configure environment variables
npm run dev
```

### Firebase Setup
1. Use existing `cendien-sales-support-ai` project
2. Firestore uses default service account in Cloud Run
3. No client-side Firebase config needed

## API Endpoints

### Authentication
- `POST /api/auth/login` - Exchange MSAL token for session
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/user` - Get current user info

### Jobs
- `POST /api/jobs` - Create job position
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/{id}` - Get specific job

### Candidates
- `POST /api/jobs/{id}/upload-resume` - Upload and analyze resume
- `GET /api/jobs/{id}/candidates` - Get ranked candidates for job
- `GET /api/candidates/{id}` - Get detailed candidate analysis
- `POST /api/candidates/{id}/improve-resume` - Generate improved resume

### Health
- `GET /api/health` - API health check

## Deployment

### Cloud Run Deployment
The application is designed for Google Cloud Run deployment:

1. **Backend**: Containerized Flask application
2. **Frontend**: Static build deployed to hosting service
3. **Database**: Firebase Firestore (managed service)
4. **Authentication**: Azure AD (managed service)

### Environment Variables (Cloud Run)
```bash
GEMINI_API_KEY=xxx
AZURE_CLIENT_ID=xxx
AZURE_CLIENT_SECRET=xxx
AZURE_TENANT_ID=xxx
AZURE_AUTHORITY=https://login.microsoftonline.com/{tenant}
FLASK_SECRET_KEY=xxx
FRONTEND_URL=https://your-frontend-domain.com
```

## Testing

### Backend Testing
```bash
cd backend
python -m pytest tests/
```

### Frontend Testing
```bash
cd frontend
npm test
```

### Manual Testing Checklist
- [ ] Login with Azure AD works
- [ ] Create job position
- [ ] Upload PDF resume
- [ ] Upload DOCX resume
- [ ] View candidate ranking
- [ ] View detailed analysis
- [ ] Generate improved resume
- [ ] Logout functionality

## Common Issues & Solutions

### 1. JSON Parsing Errors
- **Cause**: AI returning unstructured text
- **Solution**: Use Pydantic models with structured output

### 2. Authentication 401 Errors
- **Cause**: Frontend not sending session token
- **Solution**: Ensure useAuth hook completes before API calls

### 3. Vite Environment Variables Not Loading
- **Cause**: Wrong prefix (REACT_APP_ vs VITE_)
- **Solution**: Use VITE_ prefix and import.meta.env

### 4. TailwindCSS Not Working
- **Cause**: Wrong PostCSS plugin for v4
- **Solution**: Use @tailwindcss/postcss plugin

### 5. File Upload Failures
- **Cause**: Unsupported file types or size limits
- **Solution**: Validate file types (.pdf, .docx) and size (10MB max)

## Performance Considerations

### Database Optimization
- Denormalized candidate summaries in job subcollections
- Indexed queries for ranking (overall_score DESC)
- Automatic document IDs prevent hotspots

### AI Response Caching
- Consider caching job analysis results
- Resume analysis is unique per candidate

### Frontend Optimization
- Vite for fast development and builds
- Code splitting for large components
- Real-time listeners for live updates

## Security Notes

### Current Implementation (Internal Tool)
- Trusted Azure AD authentication
- No input sanitization (internal use)
- Basic session management

### Production Recommendations
- Validate Azure AD tokens server-side
- Implement input sanitization
- Add rate limiting for AI API calls
- Use HTTPS everywhere
- Implement proper error handling without information disclosure

## Contributing

### Code Style
- **Python**: Follow PEP 8 with Black formatting
- **TypeScript**: Prettier with standard config
- **Git**: Conventional commit messages

### Pull Request Process
1. Create feature branch from main
2. Implement changes with tests
3. Update documentation if needed
4. Submit PR with clear description

## Support & Troubleshooting

### Logs
- **Backend**: Flask console logs
- **Frontend**: Browser developer console
- **Database**: Firestore console logs

### Useful Commands
```bash
# Backend logs
python app.py

# Frontend development
npm run dev

# Build frontend
npm run build

# Check dependencies
pip list
npm list
```

### Contact
- Technical Lead: [Contact Information]
- Project Repository: [Repository URL]
- Issue Tracker: [Issues URL]