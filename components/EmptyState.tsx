import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className = ""
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface p-8 text-center ${className}`}
    >
      <span
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-[color:var(--brand-text)]"
        aria-hidden="true"
      >
        <Icon className="h-6 w-6" />
      </span>

      <h3 className="font-title text-base font-semibold text-fg">{title}</h3>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">{description}</p>

      {action && <div className="mt-5 flex w-full justify-center">{action}</div>}
    </div>
  );
}
