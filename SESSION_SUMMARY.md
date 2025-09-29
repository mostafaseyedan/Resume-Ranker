# Session Summary: SharePoint & Monday.com Integration

## Overview
This session focused on integrating the AI Resume Evaluator with Monday.com for job management and SharePoint for file storage, creating a complete workflow from job requisition to candidate analysis.

## Major Features Implemented

### 1. Monday.com Integration ✅
- **Created `MondayService`** for API integration
- **Job sync endpoint** `/api/jobs/sync-monday` to import jobs from Monday.com boards
- **Automatic job creation** with Monday metadata
- **One-way sync** - Monday.com as source of truth, app syncs and updates based on that
- **Board migration** from old board (4374039553) to correct board (18004940852)
- **Group filtering** updated to fetch from all groups, not just "Active (Currently Open)"

### 2. SharePoint Integration ✅
- **Created `SharePointService`** using MSAL authentication
- **Multiple URL format support**:
  - Old format: `/:f:/r/sites/...`
  - New format: `?id=%2Fsites%2F...`
  - Sharing format: `/:f:/s/...`
- **File listing with categorization**:
  - Job description files (PDFs/Word docs)
  - Resume files (candidate documents)
- **Recursive folder browsing**
- **File download and processing** capabilities

### 3. Frontend Integration ✅
- **JobDetail component enhanced** with SharePoint files section
- **File categorization display**:
  - 📄 Job Description Files with "Process with AI" buttons
  - 👥 Available Resume Files for upload reference
- **Auto-loading** SharePoint files when Job Details tab is clicked
- **Direct SharePoint folder links**

### 4. API Endpoints Added ✅
- `GET /api/jobs/<job_id>/sharepoint-files` - List files from job's SharePoint folder
- `POST /api/sharepoint/download-file` - Download file content
- `POST /api/sharepoint/process-job-file` - Process job files with Gemini AI
- `POST /api/jobs/sync-monday` - Sync jobs from Monday.com
- `GET /api/jobs/<job_id>/debug-sharepoint` - Debug SharePoint integration

## Technical Implementation Details

### Monday.com Configuration
- **Board ID**: `18004940852` (Staffing Reqs)
- **Groups**: All groups (Active, Interviewing, Submitted, Engaged, Closed, Not Pursuing)
- **SharePoint Column**: `file_mkw32xnz`
- **API Key**: Stored in environment variables

### SharePoint Structure
- **Tenant**: `cendien.sharepoint.com`
- **Site**: `Cendien-SalesSupport`
- **Base Path**: `Shared Documents/General/08-Job Requisitions/`
- **Folder Structure**:
  - `001_Oakland Req/` - Contains numbered job folders
  - `002_Infor-Beeline Reqs/` - Contains Infor-specific jobs

### File Organization
Each job folder contains:
- **Job Description files**: PDFs with job requirements
- **Resume files**: Candidate documents
- **Formatted Resumes**: Subfolder with processed resumes

## Key Code Changes

### Backend Services
1. **`services/monday_service.py`** - Monday.com API integration
2. **`services/sharepoint_service.py`** - SharePoint file management
3. **`services/firestore_service.py`** - Added Monday ID tracking
4. **`app.py`** - New API endpoints for integration

### Frontend Components
1. **`components/JobDetail.tsx`** - SharePoint files display
2. **`services/apiService.ts`** - API methods for SharePoint
3. **`components/JobList.tsx`** - Monday sync button

### Configuration Updates
1. **`.env`** - Added Monday.com API key
2. **`requirements.txt`** - Added requests library

## User Workflow

### Job Management
1. **Sync from Monday** - Click "📋 Sync Monday" to import jobs
2. **View job details** - Each job shows its Monday.com metadata
3. **Access SharePoint files** - Job Details tab shows categorized files

### File Processing
1. **Job descriptions** - Click "Process with AI" to extract requirements
2. **Resume files** - Listed for easy reference and future upload integration
3. **Direct access** - Links to open SharePoint folders in browser

### Data Flow
```
Monday.com (Jobs) → App Database → SharePoint (Files) → Gemini AI (Processing)
```

## Issues Resolved

### SharePoint URL Parsing
- **Problem**: Multiple SharePoint URL formats not supported
- **Solution**: Enhanced parser to handle `:f:/r/`, `:f:/s/`, and `?id=` formats

### Board Configuration
- **Problem**: Wrong Monday.com board causing incorrect file access
- **Solution**: Updated to correct board ID and column mappings

### File Access
- **Problem**: All jobs showing same SharePoint files
- **Solution**: Job-specific folder matching and proper URL handling

### Group Filtering
- **Problem**: Only fetching from "Active" group
- **Solution**: Removed group filter to get jobs from all groups

## Next Steps (Not Implemented)

### Resume Upload Integration
- **Planned**: SharePoint resume files in Upload Resume tab
- **Feature**: Click to load SharePoint resumes into upload form
- **Benefit**: Streamlined candidate processing workflow

### Enhanced File Processing
- **Planned**: Bulk processing of multiple job description files
- **Feature**: Automatic job requirement extraction on sync
- **Benefit**: Reduced manual processing

### Advanced Filtering
- **Planned**: Filter jobs by Monday.com groups/status
- **Feature**: Show only active, interviewing, or closed jobs
- **Benefit**: Better job management organization

## Environment Setup

### Required Environment Variables
```env
# Monday.com Integration
MONDAY_API_KEY=your-monday-api-key

# Azure AD (for SharePoint)
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id

# Existing variables
GEMINI_API_KEY=your-gemini-api-key
FLASK_SECRET_KEY=your-flask-secret-key
FRONTEND_URL=http://localhost:3000
```

## Testing Commands

### SharePoint Access Test
```bash
python3 test_sharepoint.py
python3 test_specific_folder.py
python3 test_job_folder.py
```

### Monday.com API Test
```bash
curl -X POST "https://api.monday.com/v2" -H "Authorization: your-api-key" -d '{"query": "query { boards (ids: 18004940852) { name } }"}'
```

## Summary
Successfully implemented a complete integration between Monday.com (job management), SharePoint (file storage), and the AI Resume Evaluator (processing), creating a seamless workflow for job requisition management and candidate evaluation. The system now supports automatic job importing, file categorization, and AI-powered document processing.