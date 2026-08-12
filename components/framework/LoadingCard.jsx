import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Professional loading card with skeleton content
 * Use this for data loading states instead of basic spinners
 */
export default function LoadingCard({ 
  className = "max-w-md mx-auto",
  lines = 3,
  showAvatar = false 
}) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="animate-pulse space-y-4">
          {showAvatar && (
            <div className="flex items-center space-x-4">
              <div className="rounded-full bg-muted h-10 w-10"></div>
              <div className="h-4 bg-muted rounded w-1/4"></div>
            </div>
          )}
          {Array.from({ length: lines }, (_, i) => (
            <div 
              key={i}
              className={`h-4 bg-muted rounded ${
                i === 0 ? 'w-3/4' : 
                i === lines - 1 ? 'w-1/2' : 
                'w-full'
              }`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

LoadingCard.displayName = 'LoadingCard';
LoadingCard.isFrameworkComponent = true;