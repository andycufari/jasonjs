// middleware.js
import { NextResponse } from 'next/server';
import securityMiddleware from './core/security/securityMiddleware.js';
import { getFunctionRewrite } from './core/routes/functionRewrites.js';
import { defaultDomain } from './core/sites/resolve.js';

// Private IP ranges that should be handled as health checks
const PRIVATE_IP_PATTERNS = [
  /^10\./,                    // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,              // 192.168.0.0/16
  /^127\./,                   // 127.0.0.0/8 (localhost)
  /^169\.254\./,              // 169.254.0.0/16 (link-local)
  /^::1$/,                    // IPv6 localhost
  /^::ffff:127\./,            // IPv6-mapped IPv4 localhost
  /^fe80:/                    // IPv6 link-local
];

function isPrivateIP(host) {
  // Extract IP without port
  const ip = host.split(':')[0];

  // Check for localhost variations
  if (ip === 'localhost' || ip === 'localhost.localdomain') {
    return true;
  }

  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(ip));
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();

  // Get the actual domain from the X-Forwarded-Host header
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host') || '';

  // Early return for health checks - no logging, no processing
  if (pathname === '/health') {
    return NextResponse.next();
  }

  // Handle private IP requests from load balancers (not localhost)
  const isLocalhost = host.includes('localhost') || host.startsWith('127.') || host.startsWith('::1') || host.startsWith('::ffff:127.');

  if (isPrivateIP(host) && !isLocalhost && pathname === '/') {
    // Redirect to health check endpoint
    url.pathname = '/api/health';
    return NextResponse.rewrite(url);
  }

  // Early return for static files - BEFORE rate limiting to avoid counting them
  // This prevents static assets (JS, CSS, images, fonts) from counting toward rate limits
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('/chunks/') ||
    pathname.includes('.js.map') ||
    pathname.includes('.css.map') ||
    /\.(js|css|map|json|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Reject server-side script extensions outright. JasonJS doesn't run PHP /
  // ASP / CGI etc., so any request for one of these is a vulnerability scan.
  // Returning 404 here keeps them out of dynamic-page detection (which would
  // otherwise log "Testing dynamic pattern: :slug" for every bot probe) and
  // avoids counting them against rate limits.
  if (/\.(php\d?|phtml|asp|aspx|cgi|jsp|jspx|do|action|pl|cfm|shtml)(\?|$)/i.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  // Handle sitemap.xml requests specially
  if (pathname === '/sitemap.xml') {
    const url = request.nextUrl.clone();
    url.pathname = '/api/sitemap';
    return NextResponse.rewrite(url);
  }

  // Handle rss.xml requests similarly
  if (pathname === '/rss.xml') {
    const url = request.nextUrl.clone();
    url.pathname = '/api/rss';
    return NextResponse.rewrite(url);
  }

  // Handle robots.txt — framework-generated with sitemap reference
  if (pathname === '/robots.txt') {
    const url = request.nextUrl.clone();
    url.pathname = '/api/robots.txt';
    return NextResponse.rewrite(url);
  }

  // Apply security middleware (only for non-private IPs and in production)
  // Now only applies to actual page/API requests, not static assets
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!isPrivateIP(host) && !isDevelopment) {
    // Skip security middleware for API routes when ?dev=true is present
    // Dev mode users need immediate access to newly added functions
    const hasDevParam = request.nextUrl.searchParams.get('dev') === 'true' ||
                        request.nextUrl.searchParams.get('dev') === '1';
    const isApiRoute = pathname.startsWith('/api');

    if (!(hasDevParam && isApiRoute)) {
      const securityResponse = await securityMiddleware(request);
      if (securityResponse) {
        // Request was blocked by security middleware
        return securityResponse;
      }
    }
  }

  // Check for function route rewrites before API passthrough
  // This allows clean URLs like /llm to execute functions/llm.js
  if (!pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
    // Resolve host for route lookup (strip port, handle localhost/tunnels)
    let resolvedHost = host.split(':')[0];
    if (resolvedHost === 'localhost' || resolvedHost === '127.0.0.1') {
      resolvedHost = defaultDomain() || resolvedHost;
    }

    const rewrite = await getFunctionRewrite(request, resolvedHost);
    if (rewrite) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = `/api/${rewrite.functionName}`;
      // Forward route params as query string
      for (const [key, value] of Object.entries(rewrite.params)) {
        if (key !== '*') {
          rewriteUrl.searchParams.set(key, value);
        }
      }
      return NextResponse.rewrite(rewriteUrl);
    }
  }

  // Allow API routes to pass through (after security checks)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Add security headers to all responses
  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response) {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (limit browser features)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  // Content Security Policy is set in next.config.js - don't override here

  // HSTS (Strict Transport Security) - only in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/health',
    '/sitemap.xml',
    '/rss.xml',
    '/robots.txt',
    // Exclude: _next internals, favicon, source maps, static assets
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon\\.ico|.*\\.ico$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.webp$|.*\\.js\\.map|.*\\.css\\.map|chunks/).*)',
    '/api/:path*'
  ],
}