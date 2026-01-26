export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  USER: '/auth/user',

  // Jobs
  JOBS: '/jobs',
  JOB: (id: string) => `/jobs/${id}`,
  JOB_CHAT: (id: string) => `/jobs/${id}/chat`,

  // Candidates
  UPLOAD_RESUME: (jobId: string) => `/jobs/${jobId}/upload-resume`,
  JOB_CANDIDATES: (jobId: string) => `/jobs/${jobId}/candidates`,
  CANDIDATE: (id: string) => `/candidates/${id}`,
  IMPROVE_RESUME: (candidateId: string) => `/candidates/${candidateId}/improve-resume`,

  // Health
  HEALTH: '/health',
};
