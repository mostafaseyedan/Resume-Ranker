import { useState, useRef, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { IconButton, Button, Icon } from '@vibe/core';
import { Notifications, LogIn, Add, Check, Delete, Send, Reply, Prompt, Search } from '@vibe/icons';
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
      case 'potential_candidates_search':
        return `${user_name} searched for potential candidates`;
      case 'external_candidates_search':
        return `${user_name} searched external candidates`;
      case 'skill_search':
        return `${user_name} searched by skill`;
      case 'candidate_verified':
        return `${user_name} verified candidate '${details.candidate_name}'`;
      case 'job_deleted':
        return `${user_name} deleted job '${details.job_title}'`;
      case 'candidate_deleted':
        return `${user_name} deleted candidate '${details.candidate_name}'`;
      case 'external_candidate_reach_out':
        return `${user_name} reached out to '${details.candidate_name}'`;
      case 'conversation_reply':
        return `${user_name} sent a reply to '${details.candidate_name}'`;
      case 'followup_generated':
        return `${user_name} generated follow-up message for '${details.candidate_name}'`;
      case 'connection_checked':
        return `${user_name} checked LinkedIn connection status`;
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
