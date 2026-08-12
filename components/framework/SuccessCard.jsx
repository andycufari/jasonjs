import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';

/**
 * Professional success state display
 * Use this for successful operations and confirmations
 */
export default function SuccessCard({ 
  title = "Success!",
  message = "Your action was completed successfully",
  className = "max-w-md mx-auto"
}) {
  return (
    <Card className={`border-green-200 bg-green-50 dark:bg-green-950 ${className}`}>
      <CardContent className="p-6 text-center">
        <Check className="mx-auto h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">{title}</h3>
        <p className="text-green-600 dark:text-green-300">{message}</p>
      </CardContent>
    </Card>
  );
}

SuccessCard.displayName = 'SuccessCard';
SuccessCard.isFrameworkComponent = true;