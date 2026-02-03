import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { Button, IconButton, Icon } from '@vibe/core';
import { LogIn, Add, Check, Delete, Send, Reply, Prompt, Search, Retry } from '@vibe/icons';
import '@vibe/core/tokens';

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
      case 'potential_candidates_search':
        return `${user_name} searched for potential candidates for job '${details.job_title}'`;
      case 'external_candidates_search':
        return `${user_name} searched external candidates for job '${details.job_title}'`;
      case 'skill_search':
        return `${user_name} searched by skill for job '${details.job_title}'`;
      case 'candidate_verified':
        return `${user_name} verified candidate '${details.candidate_name}'`;
      case 'job_deleted':
        return `${user_name} deleted job '${details.job_title}'`;
      case 'candidate_deleted':
        return `${user_name} deleted candidate '${details.candidate_name}'`;
      case 'external_candidate_reach_out':
        return `${user_name} reached out to '${details.candidate_name}' for job '${details.job_title}'`;
      case 'conversation_reply':
        return `${user_name} sent a reply to '${details.candidate_name}' for job '${details.job_title}'`;
      case 'followup_generated':
        return `${user_name} generated follow-up message for '${details.candidate_name}'`;
      case 'connection_checked':
        return `${user_name} checked LinkedIn connection status (${details.connection_status})`;
      default:
        return `${user_name} performed action: ${action}`;
    }
  };


  const getActionIcon = (action: string): JSX.Element => {
    switch (action) {
      case 'login':
        return <Icon icon={LogIn} iconSize={16} className="text-blue-500" />;
      case 'job_created':
        return <Icon icon={Add} iconSize={16} className="text-green-500" />;
      case 'candidate_analyzed':
        return <Icon icon={Check} iconSize={16} className="text-purple-500" />;
      case 'resume_improved':
        return <Icon icon={Check} iconSize={16} className="text-yellow-500" />;
      case 'potential_candidates_search':
      case 'external_candidates_search':
      case 'skill_search':
        return <Icon icon={Search} iconSize={16} className="text-indigo-500" />;
      case 'candidate_verified':
        return <Icon icon={Check} iconSize={16} className="text-green-500" />;
      case 'job_deleted':
      case 'candidate_deleted':
        return <Icon icon={Delete} iconSize={16} className="text-red-500" />;
      case 'external_candidate_reach_out':
        return <Icon icon={Send} iconSize={16} className="text-blue-500" />;
      case 'conversation_reply':
        return <Icon icon={Reply} iconSize={16} className="text-teal-500" />;
      case 'followup_generated':
        return <Icon icon={Prompt} iconSize={16} className="text-purple-500" />;
      case 'connection_checked':
        return <Icon icon={Check} iconSize={16} className="text-cyan-500" />;
      default:
        return <Icon icon={Check} iconSize={16} className="text-gray-500" />;
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
          <Button
            onClick={loadActivities}
            kind="primary"
            size="small"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Activity Logs</h2>
        <IconButton
          onClick={loadActivities}
          tooltipContent="Refresh"
          kind="tertiary"
          size="small"
          icon={Retry}
          className="text-gray-600 hover:text-gray-900"
        />
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
