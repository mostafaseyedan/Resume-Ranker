# Firebase Firestore Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `ai-resume-evaluator`
4. Disable Google Analytics (not needed)
5. Create project

## Step 2: Enable Firestore Database

1. In the Firebase console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode"
4. Select your preferred region (same as Cloud Run)
5. Click "Enable"

## Step 3: Generate Service Account Key for Backend

1. Go to Project Settings > Service accounts
2. Click "Generate new private key"
3. Download the JSON file
4. This will be used in Cloud Run environment variables

## Step 4: Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Jobs collection - allow all operations (internal app)
    match /jobs/{jobId} {
      allow read, write: if true;

      // Candidates subcollection
      match /candidates/{candidateId} {
        allow read, write: if true;
      }
    }

    // Main candidates collection
    match /candidates/{candidateId} {
      allow read, write: if true;
    }
  }
}
```

## Database Collections Structure

### jobs
```
jobs/{jobId}
├── id: string (auto-generated)
├── title: string
├── description: string
├── department: string
├── status: string ("active", "closed")
├── requirements: object (AI-extracted)
├── skill_weights: object (AI-assigned weights)
├── created_by: string (user email)
└── created_at: timestamp
```

### candidates
```
candidates/{candidateId}
├── id: string (auto-generated)
├── name: string (extracted from resume)
├── email: string (extracted from resume)
├── phone: string (extracted from resume)
├── resume_filename: string
├── resume_text: string (parsed content)
├── job_id: string (reference to job)
├── analysis: object
│   ├── overall_score: number (0-100)
│   ├── summary: string
│   ├── strengths: array of objects
│   ├── weaknesses: array of objects
│   ├── skill_analysis: array of objects
│   ├── experience_match: object
│   └── education_match: object
├── uploaded_by: string (user email)
└── created_at: timestamp
```

### jobs/{jobId}/candidates (subcollection for ranking)
```
jobs/{jobId}/candidates/{candidateId}
├── candidate_id: string (reference)
├── name: string
├── email: string
├── overall_score: number
├── summary: string
├── created_at: timestamp
└── uploaded_by: string
```

## Cloud Run Environment Variables

Set these in your Cloud Run service:

```bash
# Firebase
FIREBASE_CREDENTIALS_JSON='{"type": "service_account", "project_id": "..."}'

# Or use service account file path
FIREBASE_CREDENTIALS_PATH=/app/config/firebase-credentials.json

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# Azure AD
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT_ID=your_tenant_id
AZURE_AUTHORITY=https://login.microsoftonline.com/your_tenant_id

# Flask
FLASK_SECRET_KEY=your_secure_secret_key
FLASK_ENV=production

# CORS
FRONTEND_URL=https://your-frontend-domain.com
```

## No Client-Side Firebase Config Needed

Since we're only using Firestore on the backend, the React frontend doesn't need Firebase configuration. All Firebase operations go through the Flask API.