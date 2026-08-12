'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Fires gtag('event', 'page_view') on every Next.js App Router navigation.
// Required because the GA snippet's auto pageview only fires on hard load,
// so SPA navigations (Link clicks, router.push) would otherwise go untracked.
// Pairs with `send_page_view: false` in the gtag config script.
function GAPageviewsInner({ measurementId }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSent = useRef(null);

  useEffect(() => {
    if (!measurementId || typeof window === 'undefined') return;
    if (typeof window.gtag !== 'function') return;

    const qs = searchParams?.toString();
    const path = qs ? `${pathname}?${qs}` : pathname;
    if (lastSent.current === path) return;
    lastSent.current = path;

    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
      send_to: measurementId,
    });
  }, [pathname, searchParams, measurementId]);

  return null;
}

// Suspense boundary required because useSearchParams() forces dynamic
// rendering of any ancestor that doesn't already provide one.
export default function GAPageviews({ measurementId }) {
  return (
    <Suspense fallback={null}>
      <GAPageviewsInner measurementId={measurementId} />
    </Suspense>
  );
}
