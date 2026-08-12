import React from 'react';
import { renderPage } from '@/core/render/page';
import { generateMetadata } from '@/core/render/metadata';
import { createLogger } from '@/core/utils/logger';
import HtmlPage from '@/components/system/HtmlPage';

const logger = createLogger('Page');

export { generateMetadata };

export default async function Page({ params, searchParams }) {
  // Await params and searchParams as required by Next.js 15
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  // Early return for Next.js internal paths and static files
  const firstSegment = resolvedParams.slug[0];
  const lastSegment = resolvedParams.slug[resolvedParams.slug.length - 1];

  if (
    firstSegment === '_next' ||
    firstSegment === 'static' ||
    resolvedParams.slug.includes('chunks') ||
    /\.(js|css|map|json|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot)$/i.test(lastSegment)
  ) {
    return null;
  }

  const slug = resolvedParams.slug?.join('/') || 'home';
  logger.debug(`Rendering page: /${slug}`, {
    params: resolvedParams,
    searchParams: resolvedSearchParams
  });

  const WrappedContent = await renderPage({ params: resolvedParams, searchParams: resolvedSearchParams });

  // Raw HTML page: strip outer <html>/<head>/<body> wrappers so the content
  // can be embedded inside the Next.js RootLayout without hydration mismatches.
  if (typeof WrappedContent === 'string') {
    return <HtmlPage html={WrappedContent} />;
  }

  return WrappedContent;
}