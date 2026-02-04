import React from 'react';
import { IconButton } from '@vibe/core';
import { useTheme } from '../context/ThemeContext';
import '@vibe/core/tokens';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <IconButton
      onClick={toggleTheme}
      tooltipContent={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      kind="tertiary"
      size="small"
      icon={() => (
        theme === 'light' ? (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        )
      )}
      className="text-gray-600 dark:text-[#d5d8df] hover:text-gray-900 dark:hover:text-white"
    />
  );
};

export default ThemeToggle;
