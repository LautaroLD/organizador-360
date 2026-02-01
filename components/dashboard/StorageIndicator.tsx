import React from 'react';
import { formatBytes } from '@/lib/subscriptionUtils';

interface StorageIndicatorProps {
  used: number;
  limit: number | null;
  className?: string;
}

export function StorageIndicator({ used, limit, className = '' }: StorageIndicatorProps) {
  const percentage = limit ? Math.min(Math.round((used / limit) * 100), 100) : 0;
  const isNearLimit = percentage >= 80;
  const isOverLimit = percentage >= 100;

  let colorClass = 'bg-blue-600';
  if (isOverLimit) colorClass = 'bg-red-600';
  else if (isNearLimit) colorClass = 'bg-yellow-500';

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between text-xs mb-1 text-gray-600 dark:text-gray-400">
        <span>Almacenamiento</span>
        <span>{formatBytes(used)} / {formatBytes(limit)}</span>
      </div>
      {limit !== null && (
        <>
          <div className="w-full bg-[var(--bg-primary)] border border-gray-500 rounded-full h-2.5  overflow-hidden">
            <div
              className={`h-2.5 rounded-full ${colorClass} transition-all duration-500`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          {isOverLimit && (
            <p className="text-xs text-red-500 mt-1">
              Has alcanzado el límite de almacenamiento.
            </p>
          )}
        </>
      )}
    </div>
  );
}
