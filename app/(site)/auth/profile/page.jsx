// app/(site)/auth/profile/page.jsx
import { redirect } from 'next/navigation';
import { loadPageDefinition } from '@/core/render/loadPage';
import { getAllSettings, getSite } from '@/core/sites/files';
import { getServerSession } from 'next-auth';
import { createAuthOptions } from '@/core/auth/options';
import { resolveSite } from '@/core/sites/resolve';
import { getSiteInfo } from '@/core/utils/getSiteInfo';
import { getTheme } from '@/core/render/getTheme';
import UserProfile from '@/components/framework/auth/UserProfile';

export default async function ProfilePage({ searchParams }) {
  // Await searchParams as required by Next.js 15
  const resolvedSearchParams = await searchParams;
  const { host } = await resolveSite();
  
  // Load page configuration first
  let pageData;
  try {
    pageData = await loadPageDefinition({ 
      params: { slug: ['auth', 'profile'] }, 
      searchParams: resolvedSearchParams 
    });
  } catch (error) {
    pageData = null;
  }
  
  // Load all settings (including auth) from the proper source (database or files)
  let settings = {};
  try {
    settings = await getAllSettings(host);
  } catch (error) {
    console.log('Error loading settings:', error);
    settings = {};
  }
  
  // If no page configuration exists, create default structure
  if (!pageData) {
    console.log('No auth page configuration found, using defaults with settings');
    pageData = {
      domain: host,
      auth: settings.auth || {
        providers: {
          credentials: { enabled: true }
        },
        ui: {
          showProtectedBy: false
        }
      },
      theme: settings.theme || {
        colors: {
          primary: '#6366f1',
          secondary: '#8b5cf6'
        }
      }
    };
  } else {
    // Merge auth settings from database into page data
    if (settings.auth) {
      pageData.auth = { 
        ...pageData.auth, 
        ...settings.auth 
      };
    }
    if (settings.theme) {
      pageData.theme = { 
        ...pageData.theme, 
        ...settings.theme 
      };
    }
  }
  
  // Get site information for branding with fallback
  let siteInfo;
  try {
    siteInfo = await getSiteInfo(pageData.domain);
  } catch (error) {
    console.log('No site info found, using generic defaults');
    siteInfo = {
      name: null,
      logo: null,
      branding: {}
    };
  }
  
  // Use auth UI defaultName if available, otherwise fallback to site info
  if (pageData.auth?.ui?.defaultName) {
    siteInfo.name = pageData.auth.ui.defaultName;
  }

  const authOptions = await createAuthOptions(pageData);

  // Check existing session - redirect if not authenticated
  const session = await getServerSession(authOptions);
  if (!session) {
    const signInUrl = pageData.auth?.urls?.signIn || '/auth/login';
    redirect(`${signInUrl}?callbackUrl=${encodeURIComponent('/auth/profile')}`);
  }

  // Process fonts and theme using a simpler approach to avoid hydration issues
  const fontCss = getFontCss(settings.fonts || {});
  const { mergedTheme, themeStyles } = getTheme(pageData.theme || settings.theme || {});
  
  // Combine font and theme styles
  const combinedStyles = `
    ${fontCss}
    ${themeStyles}
  `;
  
  // Only pass necessary theme and auth config to client
  const clientData = {
    startup_id: pageData.startup_id,
    theme: mergedTheme,
    user: session.user,
    auth: {
      providers: pageData.auth?.providers || { credentials: { enabled: true } },
      methods: pageData.auth?.methods || [],
      ui: pageData.auth?.ui || {},
      terms: pageData.auth?.terms,
      redirects: pageData.auth?.redirects || { afterSignOut: '/' },
      isAuthenticated: true
    }
  };

  // Create dynamic gradient background from theme colors
  const primaryColor = mergedTheme.colors?.primary || '#6366f1';
  const secondaryColor = mergedTheme.colors?.secondary || '#8b5cf6';
  const backgroundColor = mergedTheme.colors?.background || '#0f172a';
  
  // Use theme background if specified, otherwise create gradient
  const gradientStyle = {
    background: mergedTheme.colors?.background 
      ? mergedTheme.colors.background
      : `linear-gradient(135deg, ${backgroundColor} 0%, ${primaryColor}15 25%, ${secondaryColor}15 75%, ${backgroundColor} 100%)`,
    minHeight: '100vh',
    fontFamily: mergedTheme.typography?.fontFamily || "'Inter', system-ui, sans-serif"
  };

  return (
    <>
      {/* Inject combined font and theme styles */}
      <style dangerouslySetInnerHTML={{ __html: combinedStyles }} />
      
      <div 
        className="min-h-screen p-4 relative overflow-hidden"
        style={{
          ...gradientStyle,
          color: mergedTheme.colors?.text || '#f8fafc'
        }}
      >
        {/* Animated background elements - using theme colors */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"
            style={{ backgroundColor: primaryColor }}
          ></div>
          <div 
            className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"
            style={{ backgroundColor: secondaryColor }}
          ></div>
          <div 
            className="absolute top-40 left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-25 animate-blob animation-delay-4000"
            style={{ backgroundColor: primaryColor }}
          ></div>
        </div>
        
        <div className="relative z-10">
          <UserProfile 
            options={{
              afterSignOutUrl: pageData.auth?.redirects?.afterSignOut || '/',
              labels: pageData.auth?.ui?.labels
            }}
          />
        </div>
      </div>
    </>
  );
}

// Simple approach: Include Google Fonts directly in CSS to avoid hydration issues
function getFontCss(fonts = {}) {
  const fontImports = Object.values(fonts)
    .filter(font => font.src && font.src.includes('googleapis'))
    .map(font => `@import url('${font.src}');`)
    .join('\n');
  
  return fontImports;
}