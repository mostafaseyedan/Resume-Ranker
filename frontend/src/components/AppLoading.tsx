import React from 'react';
import BrandLogo from './BrandLogo';

const AppLoading: React.FC = () => (
  <div
    className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 dark:bg-canvas"
    role="status"
    aria-live="polite"
    aria-label="Loading TalentMax"
  >
    <BrandLogo size={48} />
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    <p className="text-sm text-gray-500 dark:text-ink-muted">Loading...</p>
  </div>
);

export default AppLoading;
