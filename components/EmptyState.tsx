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
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-card-border bg-background/50 backdrop-blur-sm ${className}`}>
      <div className="bg-brand-primary/10 p-4 rounded-full mb-4">
        <Icon className="w-8 h-8 text-brand-primary opacity-80" />
      </div>
      <h3 className="text-lg font-bold font-title text-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted font-body max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {action && (
        <div className="mt-2 w-full flex justify-center">
          {action}
        </div>
      )}
    </div>
  );
}
