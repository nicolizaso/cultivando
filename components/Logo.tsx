import React from 'react';

export default function Logo({ className = "w-6 h-6", strokeWidth = 2 }: { className?: string, strokeWidth?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21a9 9 0 0 0 9-9c0-5-3.5-9-9-9S3 7 3 12a9 9 0 0 0 9 9z" strokeOpacity="0.2"/>
      <path d="M12 21c-4.5 0-7-4-7-9 0-4 2.5-7 7-7" />
      <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="15" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 11l5 4" />
      <path d="M12 11l-5 4" />
      <path d="M7 15l10 0" strokeOpacity="0.3" strokeDasharray="2 2" />
    </svg>
  );
}
