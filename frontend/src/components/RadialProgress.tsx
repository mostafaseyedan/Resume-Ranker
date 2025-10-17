import React from 'react';

interface RadialProgressProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
}

const RadialProgress: React.FC<RadialProgressProps> = ({
  score,
  size = 80,
  strokeWidth = 8,
  showLabel = true,
  className = ''
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#16a34a'; // green-600
    if (score >= 80) return '#22c55e'; // green-500
    if (score >= 70) return '#eab308'; // yellow-500
    if (score >= 60) return '#f97316'; // orange-500
    return '#ef4444'; // red-500
  };

  const getScoreTextColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-green-500';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const color = getScoreColor(score);
  const textColor = getScoreTextColor(score);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showLabel && (
        <div className={`absolute inset-0 flex items-center justify-center ${textColor} font-bold`}
          style={{ fontSize: size / 3.5 }}
        >
          {score}
        </div>
      )}
    </div>
  );
};

export default RadialProgress;
