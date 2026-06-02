import { useState, useRef, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { IconButton, Button, Icon } from '@vibe/core';
import { Notifications } from '@vibe/icons';
import '@vibe/core/tokens';
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
        className="text-gray-600 dark:text-ink hover:text-gray-900 dark:hover:text-white"
      />

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 sm:w-[28rem] origin-top-right rounded-md bg-white dark:bg-surface shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-gray-200 dark:border-line">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-line">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-ink">Recent Activity</h3>
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
              <div className="px-4 py-8 text-center text-gray-500 dark:text-ink-muted">
                <p className="text-sm">Loading...</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-ink-muted">
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-line">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        userId={activity.user_email || activity.user_name}
                        name={activity.user_name}
                        size="small"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-ink">
                          {formatActivityMessage(activity.action, activity.details)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end min-w-[60px]">
                        <span className="text-[10px] text-gray-400 dark:text-ink-muted">
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
