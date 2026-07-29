import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export default function Logo({ className = "w-8 h-8", ...props }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      {...props}
      fill="none"
    >
      <path
        d="M50 90 C 50 90, 50 20, 50 10"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M50 70 C 80 70, 90 40, 70 30 C 50 20, 50 50, 50 50"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M50 55 C 20 55, 10 25, 30 15 C 50 5, 50 35, 50 35"
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  );
}
