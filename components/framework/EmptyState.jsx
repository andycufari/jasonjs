import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Professional empty state display
 * Use this when data arrays are empty or no content exists
 */
export default function EmptyState({ 
  icon = "📭",
  title = "No items found",
  description = "Start by adding your first item",
  actionText = "Add Item",
  onAction,
  className = "max-w-md mx-auto"
}) {
  return (
    <Card className={className}>
      <CardContent className="p-8 text-center">
        <div className="text-muted-foreground text-4xl mb-4">{icon}</div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">{description}</p>
        {onAction && actionText && (
          <Button onClick={onAction}>{actionText}</Button>
        )}
      </CardContent>
    </Card>
  );
}

EmptyState.displayName = 'EmptyState';
EmptyState.isFrameworkComponent = true;