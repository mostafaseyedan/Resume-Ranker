import React from 'react';

// Cendien corporate red — the signature diagonal accent from the parent brand.
export const CENDIEN_RED = '#E2231A';

interface BrandLogoProps {
  /** Pixel size of the square mark. */
  size?: number;
  /** Render the "TalentMax" wordmark next to the mark. */
  showWordmark?: boolean;
  className?: string;
}

/**
 * TalentMax brand lockup, inspired by the Cendien corporate logo:
 * a black field, a bold sans wordmark, and the signature red diagonal
 * parallelogram accent (the slash above the "I" in CENDIEN).
 */
const BrandLogo: React.FC<BrandLogoProps> = ({ size = 32, showWordmark = true, className = '' }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="TalentMax"
      className="shrink-0 shadow-elev-1 rounded-[22%]"
    >
      {/* Black field */}
      <rect width="40" height="40" rx="9" fill="#0A0A0B" />
      {/* White "T" */}
      <g fill="#ffffff">
        <rect x="11" y="14" width="18" height="3.6" rx="1" />
        <rect x="17.5" y="14" width="5" height="16" rx="1" />
      </g>
      {/* Cendien-style red diagonal accent */}
      <polygon points="24.5,7 30,7 27.5,13 22,13" fill={CENDIEN_RED} />
    </svg>
    {showWordmark && (
      <span
        className="leading-none text-gray-900 dark:text-white"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 300,
          fontSize: size * 0.56,
          letterSpacing: '0.02em',
        }}
      >
        Talent<span style={{ color: CENDIEN_RED, fontWeight: 400 }}>Max</span>
      </span>
    )}
  </div>
);

export default BrandLogo;
