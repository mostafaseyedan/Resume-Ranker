import { useState, useRef, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { IconButton, Button } from '@vibe/core';
import { Notifications } from '@vibe/icons';
import '@vibe/core/tokens';

interface Activity {
  id: string;
  user_email: string;
  user_name: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
}

interface ActivityNotificationDropdownProps {
  onViewAll: () => void;
}

const ActivityNotificationDropdown: React.FC<ActivityNotificationDropdownProps> = ({ onViewAll }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && activities.length === 0) {
      loadActivities();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const response = await apiService.getActivities(5);
      setActivities(response.activities);
    } catch (err) {
      console.error('Failed to load activities:', err);
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
        return `${user_name} improved resume for candidate '${details.candidate_name}'`;
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

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 1000 * 60) {
      return 'Just now';
    }

    if (diff < 1000 * 60 * 60) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    }

    if (diff < 1000 * 60 * 60 * 24) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      return `${hours}h ago`;
    }

    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <IconButton
        onClick={() => setIsOpen(!isOpen)}
        tooltipContent="Activity Notifications"
        kind="tertiary"
        size="small"
        icon={Notifications}
        className="text-gray-600 hover:text-gray-900"
      />

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 sm:w-[28rem] origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
            <Button
              onClick={() => {
                onViewAll();
                setIsOpen(false);
              }}
              kind="tertiary"
              size="xs"
            >
              View all
            </Button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <p className="text-sm">Loading...</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center">
                        {getActionIcon(activity.action)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {formatActivityMessage(activity)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end min-w-[60px]">
                        <span className="text-[10px] text-gray-400">
                          {formatTime(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityNotificationDropdown;
