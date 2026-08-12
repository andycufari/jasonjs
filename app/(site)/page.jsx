// app/(site)/page.jsx
import React from 'react';
import { renderPage } from '@/core/render/page';
import { generateMetadata } from '@/core/render/metadata';
import { headers } from 'next/headers';

export { generateMetadata };

// Helper to check if host is a private IP
function isPrivateIP(host) {
  const ip = host.split(':')[0];
  const patterns = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./
  ];
  return patterns.some(pattern => pattern.test(ip));
}

export default async function Page({ params, searchParams }) {
  // Await params and searchParams before using them (Next.js 15 requirement)
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  // Check if this is from a private IP (health check)
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
  const shouldLog = !isPrivateIP(host);

  if (shouldLog) {
    console.log("Page component - params:", resolvedParams, "searchParams:", resolvedSearchParams);
  }

  // renderPage now returns JSX content
  const result = await renderPage({ params, searchParams });

  if (shouldLog) {
    console.log("Page component returning JSX");
  }
  // Return the JSX result directly
  return result;
}