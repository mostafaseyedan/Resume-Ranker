import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    // Add any additional headers if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface JobExtractedData {
  required_skills: string[];
  preferred_skills: string[];
  experience_requirements: string;
  education_requirements: string[];
  certifications: string[];
  key_responsibilities: string[];
  soft_skills: string[];
  other: string[];
}

export interface Job {
  id: string;
  title: string;
  description: string;
  status: string;
  requirements: any;
  skill_weights: any;
  extracted_data?: JobExtractedData;
  monday_metadata?: {
    group: string;
    status?: string;
    due_date?: string;
    sharepoint_link?: string;
    work_mode?: string;
    employment_type?: string;
    column_values: any;
  };
  created_by: string;
  created_at: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  resume_filename: string;
  job_id: string;
  // Analysis fields are at root level based on actual database structure
  overall_score: number;
  summary: string;
  strengths: Array<{
    strength: string;
    relevance: string;
    evidence: string;
  }>;
  weaknesses: Array<{
    weakness: string;
    importance: string;
    impact: string;
    recommendation: string;
  }>;
  skill_analysis: Array<{
    skill: string;
    required_level: string;
    candidate_level: string;
    evidence: string;
    score: number;
    weight: number;
  }>;
  experience_match: {
    total_years: number;
    relevant_years: number;
    role_progression: string;
    industry_match: string;
  };
  education_match: {
    degree_relevance: string;
    certifications: string[];
    continuous_learning: string;
  };
  uploaded_by: string;
  created_at: string;
}

export interface CreateJobRequest {
  title: string;
  description: string;
  status?: string;
}

export const apiService = {
  // Authentication
  async login(authCode: string, redirectUri: string) {
    const response = await apiClient.post('/auth/login', { code: authCode, redirect_uri: redirectUri });
    return response.data;
  },

  async logout() {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  async getUser() {
    const response = await apiClient.get('/auth/user');
    return response.data;
  },

  // Jobs
  async createJob(jobData: CreateJobRequest): Promise<{ success: boolean; job_id: string }> {
    const response = await apiClient.post('/jobs', jobData);
    return response.data;
  },

  async createJobFromPDF(title: string, file: File): Promise<{ success: boolean; job_id: string }> {
    const formData = new FormData();
    formData.append('job_pdf', file);
    formData.append('title', title);

    // Use a custom axios instance without the default Content-Type header for file uploads
    const response = await axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true,
    }).post('/jobs/upload-pdf', formData);
    return response.data;
  },

  async getAllJobs(): Promise<{ jobs: Job[] }> {
    const response = await apiClient.get('/jobs');
    return response.data;
  },

  async getJob(jobId: string): Promise<{ job: Job }> {
    const response = await apiClient.get(`/jobs/${jobId}`);
    return response.data;
  },

  async deleteJob(jobId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/jobs/${jobId}`);
    return response.data;
  },

  async syncJobsFromMonday(): Promise<{ success: boolean; message: string; synced_jobs: any[]; errors: string[] }> {
    const response = await apiClient.post('/jobs/sync-monday');
    return response.data;
  },

  // SharePoint integration
  async getJobSharePointFiles(jobId: string): Promise<{ success: boolean; job_files: any[]; resume_files: any[]; sharepoint_link: string }> {
    const response = await apiClient.get(`/jobs/${jobId}/sharepoint-files`);
    return response.data;
  },

  async downloadSharePointFile(downloadUrl: string, asBinary: boolean = false): Promise<{ success: boolean; content: string }> {
    const response = await apiClient.post('/sharepoint/download-file', { download_url: downloadUrl, as_binary: asBinary });
    return response.data;
  },

  async processSharePointJobFile(downloadUrl: string, fileName: string, jobId: string): Promise<{ success: boolean; job_info: any }> {
    const response = await apiClient.post('/sharepoint/process-job-file', { download_url: downloadUrl, file_name: fileName, job_id: jobId });
    return response.data;
  },

  // Candidates
  async uploadResume(jobId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('resume', file);

    const response = await apiClient.post(`/jobs/${jobId}/upload-resume`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getJobCandidates(jobId: string): Promise<{ candidates: Candidate[] }> {
    const response = await apiClient.get(`/jobs/${jobId}/candidates`);
    return response.data;
  },

  async getCandidateDetails(candidateId: string): Promise<{ candidate: Candidate }> {
    const response = await apiClient.get(`/candidates/${candidateId}`);
    return response.data;
  },

  async improveResume(candidateId: string): Promise<{ improved_resume: string }> {
    const response = await apiClient.post(`/candidates/${candidateId}/improve-resume`);
    return response.data;
  },

  async downloadImprovedResume(candidateId: string): Promise<Blob> {
    const response = await apiClient.post(`/candidates/${candidateId}/improve-resume`, {}, {
      responseType: 'blob'
    });
    return response.data;
  },

  async previewImprovedResume(candidateId: string): Promise<string> {
    const response = await apiClient.post(`/candidates/${candidateId}/resume-preview`, {}, {
      responseType: 'text'
    });
    return response.data;
  },

  async deleteCandidate(candidateId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/candidates/${candidateId}`);
    return response.data;
  },

  // Health check
  async healthCheck() {
    const response = await apiClient.get('/health');
    return response.data;
  },
};