// app/(site)/auth/access-denied/page.jsx
import Link from 'next/link';
import { checkAuth } from '@/core/auth/middleware';
import { loadPageDefinition } from '@/core/render/loadPage';
import { getAllSettings } from '@/core/sites/files';
import { resolveSite } from '@/core/sites/resolve';
import { getTheme } from '@/core/render/getTheme';

export default async function AccessDeniedPage() {
  const { host } = await resolveSite();

  // Load page configuration
  let pageData;
  try {
    pageData = await loadPageDefinition({
      params: { slug: ['auth', 'access-denied'] },
      searchParams: {}
    });
  } catch (error) {
    pageData = null;
  }

  // Load settings
  let settings = {};
  try {
    settings = await getAllSettings(host);
  } catch (error) {
    settings = {};
  }

  // Merge settings
  if (!pageData) {
    pageData = {
      domain: host,
      auth: settings.auth || {},
      theme: settings.theme || {}
    };
  } else {
    if (settings.auth) pageData.auth = { ...pageData.auth, ...settings.auth };
    if (settings.theme) pageData.theme = { ...pageData.theme, ...settings.theme };
  }

  const user = await checkAuth(pageData);
  const authSettings = pageData.auth || {};

  // Get theme
  const { mergedTheme, themeStyles } = getTheme(pageData.theme || {});
  const isDarkMode = mergedTheme.defaultColorScheme === 'dark';
  const primaryColor = mergedTheme.colors?.primary || '#E8673E';
  const backgroundColor = isDarkMode
    ? (mergedTheme.colors?.['bg-dark'] || '#1C1C1C')
    : (mergedTheme.colors?.background || '#F5F5F5');
  const cardSurface = mergedTheme.colors?.surface || '#FFFFFF';
  const textColor = mergedTheme.colors?.text || '#1A1A1A';
  const textSecondary = mergedTheme.colors?.['text-secondary'] || '#666666';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeStyles }} />

      <div
        className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor }}
      >
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div
              className="mx-auto h-24 w-24 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: primaryColor + '20' }}
            >
              <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: primaryColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>

            <h1
              className="text-3xl font-bold mb-4"
              style={{
                color: textColor,
                fontFamily: mergedTheme.typography?.['font-display'] || mergedTheme.typography?.headings?.fontFamily
              }}
            >
              Access Denied
            </h1>

            <p
              className="text-lg mb-8"
              style={{
                color: textSecondary,
                fontFamily: mergedTheme.typography?.['font-body'] || mergedTheme.typography?.fontFamily
              }}
            >
              You don't have permission to access this page.
            </p>

            {user && (
              <div
                className="rounded-lg shadow p-6 mb-8"
                style={{
                  backgroundColor: cardSurface,
                  borderColor: mergedTheme.colors?.['border-base'] || '#E0E0E0',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <h2
                  className="text-lg font-semibold mb-4"
                  style={{ color: textColor }}
                >
                  Current User
                </h2>
                <div className="space-y-2 text-left">
                  <div className="flex justify-between">
                    <span style={{ color: textSecondary }}>Username:</span>
                    <span className="font-medium" style={{ color: textColor }}>{user.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textSecondary }}>Role:</span>
                    <span className="font-medium capitalize" style={{ color: textColor }}>{user.role || 'user'}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <Link
                href="/"
                className="w-full flex justify-center py-3 px-4 rounded-md shadow-sm text-sm font-medium transition-colors"
                style={{
                  backgroundColor: primaryColor,
                  color: '#FFFFFF',
                  borderWidth: '0'
                }}
              >
                Go to Homepage
              </Link>

              {user ? (
                <Link
                  href="/auth/logout"
                  className="w-full flex justify-center py-3 px-4 rounded-md shadow-sm text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: cardSurface,
                    color: textColor,
                    borderColor: mergedTheme.colors?.['border-base'] || '#E0E0E0',
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  Sign Out
                </Link>
              ) : (
                <Link
                  href={authSettings.urls?.signIn || '/auth/login'}
                  className="w-full flex justify-center py-3 px-4 rounded-md shadow-sm text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: cardSurface,
                    color: textColor,
                    borderColor: mergedTheme.colors?.['border-base'] || '#E0E0E0',
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}