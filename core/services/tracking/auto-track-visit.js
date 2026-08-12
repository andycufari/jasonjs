// core/services/tracking/auto-track-visit.js
// Server-side, cookieless page-view tracker.
// Fired from core/render/page.js on every real request (fire-and-forget).
// NEVER throws — analytics must not break page rendering.

import analyticsTracker from './analytics.js';
import { hashVisitor } from './salt-manager.js';

/**
 * Skip prefetch and RSC payload requests. Bot recon (PHP/CMS probes) is
 * already filtered upstream in core/render/page.js — trackVisit is only
 * fired for requests that resolved to a real page, so this function only
 * needs to worry about Next.js internal traffic duplicating real visits.
 */
function shouldSkip(headersList) {
  if (!headersList) return true;
  const get = (name) => headersList.get?.(name);

  // Next.js App Router prefetches
  if (get('next-router-prefetch') === '1') return true;
  if (get('purpose') === 'prefetch') return true;
  if (get('x-middleware-prefetch') === '1') return true;

  // RSC (React Server Component) payload — same URL already rendered as HTML
  if (get('rsc') === '1') return true;
  if (get('next-router-state-tree')) return true;

  return false;
}

// Lightweight server-side UA parser.
// Intentionally duplicated from core/services/analytics.js (which is 'use client')
// so this module stays server-safe to import.
function parseBrowser(ua = '') {
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  return 'Unknown';
}

function parseOS(ua = '') {
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS') || ua.includes('Macintosh')) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iOS')) return 'iOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}

function parseDevice(ua = '') {
  if (ua.includes('iPad') || ua.includes('Tablet')) return 'tablet';
  if (ua.includes('Mobile') || ua.includes('Android')) return 'mobile';
  return 'desktop';
}

/**
 * Record a page-view visit. Fire-and-forget — callers should NOT await,
 * or at minimum should not let this block page rendering.
 *
 * @param {object} args
 * @param {string} args.host - The site host (domain)
 * @param {string} args.pagePath - The URL path, e.g. "/about"
 * @param {object} args.headersList - Next.js headers() result
 * @param {string|null} args.clientIp - Client IP from getClientIp()
 * @param {string} [args.pageType] - 'page' | 'not-found' | 'error' | 'html'
 */
export async function trackVisit({ host, pagePath, headersList, clientIp, pageType = 'page' }) {
  try {
    if (!host) {
      console.warn('[auto-track-visit] Skipped: no host');
      return;
    }
    if (shouldSkip(headersList)) {
      // Intentionally silent — prefetches and RSC payloads are very frequent.
      return;
    }

    const userAgent = headersList?.get?.('user-agent') || '';
    const referrer = headersList?.get?.('referer') || undefined;

    // Compute visitor hash when we have an IP. When we don't (typically local
    // dev where Next.js doesn't set x-forwarded-for), we still record the
    // visit — the `visitorHash` field will simply be absent, so unique-visitor
    // dedup won't count it. Total page view counts still work.
    const visitorHash = clientIp
      ? await hashVisitor(clientIp, userAgent, host)
      : null;

    // Pass `visitorHash` as a regular property — the tracker promotes it to
    // a top-level field so it can be indexed (MongoDB rejects $-prefixed
    // field names in index key specs, so we deliberately do NOT prefix it).
    // When null, the tracker omits it entirely (absent, not null).
    await analyticsTracker.track(host, '$page_view', {
      $page: pagePath,
      $referrer: referrer,
      $browser: parseBrowser(userAgent),
      $os: parseOS(userAgent),
      $device: parseDevice(userAgent),
      $pageType: pageType,
      ...(visitorHash ? { visitorHash } : {}),
    });
  } catch (err) {
    // Analytics must never break page rendering.
    console.error('[auto-track-visit] Failed to track visit:', err.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(err.stack);
    }
  }
}
