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

  const getActionIcon = (action: string): string => {
    switch (action) {
      case 'login':
        return '🔐';
      case 'job_created':
        return '📋';
      case 'candidate_analyzed':
        return '📊';
      case 'resume_improved':
        return '✨';
      case 'job_deleted':
        return '🗑️';
      case 'candidate_deleted':
        return '❌';
      default:
        return '📌';
    }
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'login':
        return 'bg-blue-50 border-blue-200';
      case 'job_created':
        return 'bg-green-50 border-green-200';
      case 'candidate_analyzed':
        return 'bg-purple-50 border-purple-200';
      case 'resume_improved':
        return 'bg-yellow-50 border-yellow-200';
      case 'job_deleted':
      case 'candidate_deleted':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
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
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Activity Logs</h2>
        <button
          onClick={loadActivities}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium mb-2">No activities yet</h3>
          <p>User activities will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`p-4 rounded-lg border ${getActionColor(activity.action)} transition-all hover:shadow-sm`}
            >
              <div className="flex items-start space-x-3">
                <div className="text-2xl">{getActionIcon(activity.action)}</div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 font-medium">
                    {formatActivityMessage(activity)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;
