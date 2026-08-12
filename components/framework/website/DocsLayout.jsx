'use client';

import React from 'react';
import DocsSidebar from './DocsSidebar';

export default function DocsLayout({ 
  children, 
  className = "",
  showSidebar = true 
}) {
  return (
    <div className={`min-h-screen bg-gray-900 ${className}`}>
      <div className="flex">
        {showSidebar && (
          <DocsSidebar className="w-80 h-screen sticky top-0 overflow-y-auto" />
        )}
        
        <main className={`flex-1 ${showSidebar ? 'ml-0' : ''}`}>
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

DocsLayout.displayName = 'DocsLayout';