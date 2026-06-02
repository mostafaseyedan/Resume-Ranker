import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { Button, IconButton } from '@vibe/core';
import { Retry } from '@vibe/icons';
import '@vibe/core/tokens';
import { panelShellClass } from '@/lib/radius';
import UserAvatar from './common/UserAvatar';
import { formatActivityMessage } from '@/utils/activityMessages';

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

  const formatTimestamp = (timestamp: string) => {
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
        <div className="text-lg text-gray-600 dark:text-ink-muted">Loading activity logs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 text-lg mb-2">Error loading activities</div>
          <div className="text-gray-600 dark:text-ink-muted mb-4">{error}</div>
          <Button onClick={loadActivities} kind="primary" size="small">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${panelShellClass} p-6`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-ink">Activity Logs</h2>
        <IconButton
          onClick={loadActivities}
          tooltipContent="Refresh"
          kind="tertiary"
          size="small"
          icon={Retry}
          className="text-gray-600 dark:text-ink-muted hover:text-gray-900 dark:hover:text-white"
        />
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-ink-muted">
          <h3 className="text-lg font-medium mb-2">No activities yet</h3>
          <p>User activities will appear here</p>
        </div>
      ) : (
        <div className="border-t border-gray-200 dark:border-line">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 py-3 px-4 border-b border-gray-100 dark:border-line hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
            >
              <UserAvatar
                userId={activity.user_email || activity.user_name}
                name={activity.user_name}
                size="small"
              />
              <span className="flex-1 text-sm text-gray-700 dark:text-ink">
                {formatActivityMessage(activity.action, activity.details)}
              </span>
              <span className="text-xs text-gray-500 dark:text-ink-muted whitespace-nowrap">
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
