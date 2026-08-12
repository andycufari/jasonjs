import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Professional error display card
 * Use this for error states in data loading or operations
 */
export default function ErrorCard({ 
  title = "Something went wrong",
  message = "An unexpected error occurred",
  onRetry,
  retryText = "Try Again",
  className = "max-w-md mx-auto"
}) {
  return (
    <Card className={`border-destructive ${className}`}>
      <CardContent className="p-6 text-center">
        <div className="text-destructive text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-destructive mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">{message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            {retryText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

ErrorCard.displayName = 'ErrorCard';
ErrorCard.isFrameworkComponent = true;