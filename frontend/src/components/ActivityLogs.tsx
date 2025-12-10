import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

interface Activity {
  id: string;
  user_email: string;
  user_name: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
}

const ActivityLogs: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const response = await apiService.getActivities();
      setActivities(response.activities);
      setError(null);
    } catch (err: any) {
      setError('Failed to load activities: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const formatActivityMessage = (activity: Activity): string => {
    const { user_name, action, details } = activity;

    switch (action) {
      case 'login':
        return `${user_name} logged in`;
      case 'job_created':
        return `${user_name} created job '${details.job_title}'`;
      case 'candidate_analyzed':
        return `${user_name} analyzed candidate '${details.candidate_name}' for job '${details.job_title}'`;
      case 'resume_improved':
        return `${user_name} improved resume for candidate '${details.candidate_name}' using template '${details.template_used}'`;
      case 'job_deleted':
        return `${user_name} deleted job '${details.job_title}'`;
      case 'candidate_deleted':
        return `${user_name} deleted candidate '${details.candidate_name}'`;
      default:
        return `${user_name} performed action: ${action}`;
    }
  };


  const getActionIcon = (action: string): JSX.Element => {
    switch (action) {
      case 'login':
        return (
          <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'job_created':
        return (
          <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        );
      case 'candidate_analyzed':
        return (
          <svg className="h-4 w-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'resume_improved':
        return (
          <svg className="h-4 w-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'potential_candidates_search':
        return (
          <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case 'job_deleted':
      case 'candidate_deleted':
        return (
          <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        );
      default:
        return (
          <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading activity logs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-2">Error loading activities</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button
            onClick={loadActivities}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Activity Logs</h2>
        <button
          onClick={loadActivities}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Refresh"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-gray-500">

          <h3 className="text-lg font-medium mb-2">No activities yet</h3>
          <p>User activities will appear here</p>
        </div>
      ) : (
        <div className="border-t border-gray-200">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 py-3 px-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                {getActionIcon(activity.action)}
              </div>
              <span className="flex-1 text-sm text-gray-700">
                {formatActivityMessage(activity)}
              </span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {formatTimestamp(activity.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;
